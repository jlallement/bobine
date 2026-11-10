/**
 * Premier lancement (fiche 188) : l'agent est-il installé, connecté, répond-il ? Un agent lancé
 * pour l'occasion (`short-lived-agent.ts`), dans un dossier donné :
 *
 * - `connect` : `initialize` puis `session/new`, **sans appel au modèle** — refus de connexion,
 *   licence ou dossier reconnus comme à l'ouverture d'une conversation (`sessionBlocker`) ;
 * - `reply` : en plus, un message court ; connexion expirée au message (D10, `turnAuthBlocker`),
 *   panne réseau ou limite de débit (`classifyTurnFailure`), coût s'il est annoncé (`usage_update`).
 *
 * Garanties : chaque étape a son délai ; l'annulation envoie `session/cancel` puis arrête l'agent ;
 * le processus est toujours arrêté ; la session d'essai est supprimée si l'agent sait le faire ;
 * aucune autorisation d'outil n'est donnée. Rien de propre à un agent : tout vient du profil
 * (ADR-0011). N'importe pas `electron`.
 */
import { mkdtempSync, type rmSync } from 'node:fs'
import { removeQuietly } from './scratch'
import { join } from 'node:path'
import type { AgentBlocker, ApiKeyInfo } from '@shared/agent'
import {
  PROBE_PROMPT,
  REPLY_TIMEOUT_SECONDS,
  type AgentReadiness,
  type ReadinessCost,
  type ReadinessLevel
} from '@shared/onboarding'

export { PROBE_PROMPT }
import { methods, type Usage } from '../../shared/acp-sdk.mts'
import { tokensOf } from '../usage/journal'
import type { TurnTokens } from '../usage/usage-db'
import type { EnvChanges } from '../agent-config/api-keys'
import { authMethodsOf } from '../agent/announced'
import { AgentTimeout, errorMessage, race } from '../agent/process-utils'
import { findExecutable, type AgentProfile } from '../agent/profiles'
import { sessionBlocker } from '../agent/session-blocker'
import { buildControls, currentModel } from '../agent/session-controls'
import {
  AgentCancelled,
  AgentExited,
  withAgent,
  type ClientBuilder,
  type Connected
} from '../agent/short-lived-agent'
import { classifyTurnFailure } from '../agent/turn-failure'
import { turnAuthBlocker } from '../agent/turn-auth'
import { t } from 'i18next'

/** Au-delà, la réponse est tronquée (l'essai n'en montre que le début). */
export const MAX_REPLY_CHARS = 280

export interface ReadinessTimeouts {
  /** Lancement et `initialize`. */
  startMs: number
  /** `session/new` (Bob peut ouvrir le navigateur pour le SSO : on ne l'attend pas). */
  sessionMs: number
  /** Réponse au message d'essai. */
  replyMs: number
  /** Suppression de la session d'essai (au mieux). */
  cleanupMs: number
  /** Coût écrit par l'agent après sa réponse (`costSource` du profil) : attente au plus. */
  costWaitMs: number
}

export const DEFAULT_TIMEOUTS: ReadinessTimeouts = {
  startMs: 30_000,
  sessionMs: 30_000,
  replyMs: REPLY_TIMEOUT_SECONDS * 1000,
  cleanupMs: 5_000,
  costWaitMs: 3_000
}

/** Relecture du coût écrit par l'agent hors protocole. */
const COST_POLL_MS = 250

/** Connexion par le navigateur (SSO) : le temps de se connecter. */
const AUTHENTICATE_MS = 5 * 60_000

/** Le processus est-il mort juste après une erreur de connexion ? On l'attend un peu. */
const EXIT_GRACE_MS = 300

export interface ReadinessOptions {
  profile: AgentProfile
  level: ReadinessLevel
  /** Dossier où lancer l'agent : le dossier réservé de l'app, jamais un projet. */
  cwd: string
  /**
   * Dossier de l'app où créer le dossier jetable, vide, de la session d'essai (supprimé après) :
   * l'essai ne tourne jamais dans un projet de l'utilisateur (relecture du tech lead, 2026-11-07).
   */
  scratchParent: string
  /** Session d'essai ouverte (à noter avant le message), puis supprimée chez l'agent. */
  onSession?: (sessionId: string) => void
  onSessionRemoved?: (sessionId: string) => void
  /** Reçoit l'arrêt immédiat de l'agent (fermeture de l'app pendant l'essai). */
  onStop?: (stop: () => void) => void
  /** Tour d'essai fini (toute issue), avant la suppression de la session : son coût, ses jetons. */
  onTrialTurn?: (turn: TrialTurn) => void
  /** Suppression du dossier jetable (remplaçable par les tests). */
  removeFolder?: typeof rmSync
  credentials?: EnvChanges
  /** Clé d'API du profil, proposée sur la carte de connexion. */
  apiKey?: ApiKeyInfo
  /** Méthode de connexion à lancer avant d'ouvrir la session (SSO : l'agent ouvre le navigateur). */
  authenticate?: string
  clientVersion?: string
  /** PATH où chercher la commande (celui du shell de l'utilisateur). */
  pathEnv: string | undefined
  signal?: AbortSignal
  timeouts?: Partial<ReadinessTimeouts>
  /** Horloge (essais). */
  now?: () => number
}

/** Ce que l'agent a dit pendant l'essai. */
interface Heard {
  text: string
  cost?: ReadinessCost
  /** L'agent a demandé un outil : refusé, et le tour annulé. */
  toolRefused?: boolean
  /** Branché une fois la session ouverte : annule le tour. */
  onToolRequest?: () => void
}

export async function checkAgent(options: ReadinessOptions): Promise<AgentReadiness> {
  const { profile } = options
  if (options.signal?.aborted) return { state: 'cancelled' }
  if (!findExecutable(profile.command, options.pathEnv)) {
    const reason = t('profiles.commandMissing', { command: profile.command })
    return {
      state: 'missing',
      reason: profile.installHint ? `${reason} ${profile.installHint}` : reason
    }
  }
  const timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
  const now = options.now ?? Date.now
  const started = now()
  const heard: Heard = { text: '' }
  let stderr = () => ''
  // Dossier jetable de la session d'essai : supprimé une fois l'agent arrêté, sans jamais lever.
  // Dossier de données pas inscriptible : un échec dit, pas une exception.
  let scratch: string
  try {
    scratch = mkdtempSync(join(options.scratchParent, 'essai-'))
  } catch (error) {
    return { state: 'failed', message: errorMessage(error) }
  }
  try {
    return await withAgent(
      {
        profile,
        cwd: options.cwd,
        timeoutMs: timeouts.startMs,
        setup: (builder) => listen(builder, heard),
        ...(options.credentials ? { credentials: options.credentials } : {}),
        ...(options.clientVersion ? { clientVersion: options.clientVersion } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.onStop ? { onStop: options.onStop } : {})
      },
      async (connected) => {
        stderr = connected.stderr
        return await probe(connected, options, timeouts, heard, () => now() - started, scratch)
      }
    )
  } catch (error) {
    return outcomeOf(error, stderr())
  } finally {
    removeQuietly(scratch, options.removeFolder)
  }
}

/**
 * Ce que le client répond à l'agent pendant l'essai : tout écouté, rien d'autorisé. Une demande
 * d'outil est refusée et le tour annulé (`session/cancel`) : l'essai ne touche jamais au dossier.
 */
function listen(builder: ClientBuilder, heard: Heard): ClientBuilder {
  return builder
    .onRequest(methods.client.session.requestPermission, () => {
      heard.toolRefused = true
      heard.onToolRequest?.()
      return { outcome: { outcome: 'cancelled' as const } }
    })
    .onRequest(methods.client.elicitation.create, () => ({ action: 'decline' as const }))
    .onNotification(methods.client.elicitation.complete, () => {})
    .onNotification(methods.client.session.update, ({ params }) => {
      const update = params.update
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        if (heard.text.length < MAX_REPLY_CHARS * 2) heard.text += update.content.text
      } else if (update.sessionUpdate === 'usage_update') {
        const cost = update.cost
        if (cost && typeof cost.currency === 'string' && Number.isFinite(cost.amount)) {
          heard.cost = { amount: cost.amount, currency: cost.currency }
        }
      }
    })
}

type Ready = Extract<AgentReadiness, { state: 'ready' }>

/** Session ouverte pour l'essai, dans le dossier jetable. */
interface TrialSession {
  sessionId: string
  model?: { id: string; name: string }
}

/** Le tour d'essai fini, quelle qu'en soit l'issue : pour le journal de consommation. */
export interface TrialTurn {
  startedAt: number
  endedAt: number
  /** `stopReason` ACP, `cancelled`, `interrupted` (délai, arrêt) ou `error`. */
  stopReason: string
  tokens: TurnTokens
  cost?: ReadinessCost
  model?: { id: string; name: string }
}

async function probe(
  connected: Connected,
  options: ReadinessOptions,
  timeouts: ReadinessTimeouts,
  heard: Heard,
  elapsed: () => number,
  scratch: string
): Promise<AgentReadiness> {
  const { init } = connected
  const blockerOf = blockerFor(connected, options)
  if (options.authenticate) {
    // Seulement une méthode que l'agent annonce (le renderer ne choisit rien d'autre).
    if (!authMethodsOf(init).some((m) => m.id === options.authenticate)) {
      return { state: 'failed', message: t('onboarding.unknownMethod') }
    }
    await authenticate(connected, options.authenticate)
  }
  return probeIn(connected, options, timeouts, heard, elapsed, blockerOf, scratch)
}

async function probeIn(
  connected: Connected,
  options: ReadinessOptions,
  timeouts: ReadinessTimeouts,
  heard: Heard,
  elapsed: () => number,
  blockerOf: (error: unknown) => AgentBlocker | undefined,
  scratch: string
): Promise<AgentReadiness> {
  const { init } = connected
  const opened = await openSession(connected, options, timeouts, blockerOf, scratch)
  if ('state' in opened) return opened
  const agentInfo = init.agentInfo
    ? {
        name: init.agentInfo.title ?? init.agentInfo.name,
        ...(init.agentInfo.version ? { version: init.agentInfo.version } : {})
      }
    : undefined
  const ready = (extra: Partial<Ready> = {}): Ready => ({
    state: 'ready',
    level: options.level,
    ms: elapsed(),
    ...(agentInfo ? { agentInfo } : {}),
    ...(opened.model ? { model: opened.model.name } : {}),
    ...extra
  })
  try {
    if (options.level === 'connect') return ready()
    return await sendTrial(connected, options, timeouts, heard, opened, ready, blockerOf)
  } finally {
    await removeSession(connected, opened.sessionId, timeouts.cleanupMs, options)
  }
}

/** Refus de session reconnus comme à l'ouverture d'une conversation (fiche 022). */
function blockerFor({ init }: Connected, options: ReadinessOptions) {
  const { profile } = options
  return (error: unknown) =>
    sessionBlocker(error, {
      profile,
      authMethods: authMethodsOf(init),
      apiKey: options.apiKey,
      step: (id) => {
        const step = profile.terminalSteps?.[id]
        return step ? { id, ...step } : undefined
      },
      // L'essai ne relance jamais l'agent avec une option de confiance.
      extraArgs: true
    })
}

/** Connexion lancée par l'agent (SSO : il ouvre le navigateur), avant la session. */
async function authenticate({ connection, failed }: Connected, methodId: string): Promise<void> {
  await race(
    failed,
    AUTHENTICATE_MS,
    t('onboarding.timeout.authenticate'),
    connection.agent.request(methods.agent.authenticate, { methodId })
  )
}

/**
 * `session/new` dans le dossier jetable. Notée aussitôt (`onSession`) : app quittée ou suppression
 * ratée, elle reste masquée et sa suppression est retentée au lancement suivant. Refusée,
 * annulée ou trop lente : une réponse qui arrive quand même dans le délai de nettoyage donne la
 * session, supprimée elle aussi.
 */
async function openSession(
  connected: Connected,
  options: ReadinessOptions,
  timeouts: ReadinessTimeouts,
  blockerOf: (error: unknown) => AgentBlocker | undefined,
  scratch: string
): Promise<TrialSession | AgentReadiness> {
  const { connection, failed, init } = connected
  // Notée seulement si l'agent sait la supprimer : sinon rien à retenter, et elle est déjà
  // écartée de « Reprendre une session » (son dossier jetable a disparu).
  const canDelete = !!init.agentCapabilities?.sessionCapabilities?.delete
  const note = (sessionId: string) => {
    if (canDelete) options.onSession?.(sessionId)
  }
  const request = connection.agent.request(methods.agent.session.new, {
    cwd: scratch,
    mcpServers: []
  })
  try {
    const session = await race(failed, timeouts.sessionMs, t('agentHost.timeout.session'), request)
    note(session.sessionId)
    const model = currentModel(buildControls(session.modes, session.configOptions))
    return { sessionId: session.sessionId, ...(model ? { model } : {}) }
  } catch (error) {
    if (error instanceof AgentCancelled || error instanceof AgentTimeout) {
      const late = await within(request, timeouts.cleanupMs)
      if (late) {
        note(late.sessionId)
        await removeSession(connected, late.sessionId, timeouts.cleanupMs, options)
      }
    }
    const cause = await realCause(error, failed)
    const blocker = ordinary(cause) ? blockerOf(cause) : undefined
    if (blocker) return { state: blocker.kind, blocker } as AgentReadiness
    throw cause
  }
}

/** La promesse si elle aboutit dans le délai, sinon `undefined` (jamais d'exception). */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms)
  })
  try {
    return await Promise.race([promise.catch(() => undefined), late])
  } finally {
    clearTimeout(timer)
  }
}

/** Le message d'essai, et ce qu'il en ressort. */
async function sendTrial(
  { connection, failed }: Connected,
  options: ReadinessOptions,
  timeouts: ReadinessTimeouts,
  heard: Heard,
  opened: TrialSession,
  ready: (extra?: Partial<Ready>) => Ready,
  blockerOf: (error: unknown) => AgentBlocker | undefined
): Promise<AgentReadiness> {
  const { sessionId } = opened
  const cancel = () => {
    void connection.agent.notify(methods.agent.session.cancel, { sessionId }).catch(() => {})
  }
  heard.onToolRequest = cancel
  options.signal?.addEventListener('abort', cancel, { once: true })
  const startedAt = Date.now()
  // Ce que le tour a coûté, rapporté une fois qu'il est fini, quelle qu'en soit l'issue, et avant
  // la suppression de la session (chez Bob, elle efface aussi sa ligne de coût).
  const turn: { stopReason: string; usage?: Usage | null; cost?: ReadinessCost } = {
    stopReason: 'interrupted'
  }
  const prompt = connection.agent.request(methods.agent.session.prompt, {
    sessionId,
    prompt: [{ type: 'text', text: PROBE_PROMPT }]
  })
  try {
    try {
      const response = await race(failed, timeouts.replyMs, t('onboarding.timeout.reply'), prompt)
      turn.stopReason = response.stopReason
      turn.usage = response.usage
    } catch (error) {
      // Annulé ou trop lent : la suppression attend la fin du tour annulé (bornée), sinon un agent
      // qui enregistre sa session en fin de tour la recréerait après `session/delete`.
      if (error instanceof AgentCancelled || error instanceof AgentTimeout) {
        turn.stopReason = error instanceof AgentCancelled ? 'cancelled' : 'interrupted'
        cancel()
        await within(prompt, timeouts.cleanupMs)
      } else turn.stopReason = 'error'
      const cause = await realCause(error, failed)
      if (ordinary(cause)) {
        const blocker = turnAuthBlocker(cause, blockerOf, options.profile)
        if (blocker) return { state: 'auth', blocker }
      }
      throw cause
    } finally {
      options.signal?.removeEventListener('abort', cancel)
      heard.onToolRequest = undefined
    }
    if (options.signal?.aborted) return { state: 'cancelled' }
    const reply = heard.text.trim()
    // Outil demandé : refusé, tour annulé ; ce que l'agent a déjà écrit dit qu'il répond.
    if (turn.stopReason === 'refusal' || !reply) {
      const message = heard.toolRefused
        ? t('onboarding.toolRefused')
        : t('onboarding.noReply', { reason: turn.stopReason })
      return { state: 'failed', message }
    }
    // L'agent qui écrit son coût après sa réponse (Bob, dans sa base) : on l'attend un peu.
    turn.cost = heard.cost ?? (await profileCost(options, sessionId, timeouts.costWaitMs))
    const usage = turn.usage
    const tokens =
      usage && typeof usage.inputTokens === 'number' && typeof usage.outputTokens === 'number'
        ? { input: usage.inputTokens, output: usage.outputTokens }
        : undefined
    return ready({
      reply: truncate(reply),
      ...(turn.cost ? { cost: turn.cost } : {}),
      ...(tokens ? { tokens } : {}),
      ...(heard.toolRefused ? { toolRefused: true as const } : {})
    })
  } finally {
    const cost = turn.cost ?? heard.cost ?? (await profileCost(options, sessionId, 0))
    options.onTrialTurn?.({
      startedAt,
      endedAt: Date.now(),
      stopReason: turn.stopReason,
      tokens: tokensOf(turn.usage ?? undefined),
      ...(cost ? { cost } : {}),
      ...(opened.model ? { model: opened.model } : {})
    })
  }
}

/**
 * Coût de la session lu hors protocole, comme pour une conversation (`costSource` du profil, Bob :
 * sa base locale) : attendu `waitMs` au plus, l'agent l'écrivant juste après sa réponse. Jamais
 * d'exception ; rien si le profil n'en déclare pas.
 */
async function profileCost(
  options: Pick<ReadinessOptions, 'profile'>,
  sessionId: string,
  waitMs: number
): Promise<ReadinessCost | undefined> {
  const source = options.profile.costSource
  if (!source) return undefined
  const read = () => {
    try {
      return source.session(sessionId)
    } catch {
      return undefined
    }
  }
  const deadline = Date.now() + waitMs
  let amount = read()
  while (amount === undefined && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, COST_POLL_MS))
    amount = read()
  }
  return amount === undefined ? undefined : { amount, currency: source.currency }
}

/**
 * La vraie cause d'une erreur : quand l'agent meurt, la connexion se ferme parfois avant que le
 * processus ait fini (« ACP connection closed ») ; on attend un peu sa fin pour dire « plantage »
 * plutôt que « réseau ».
 */
async function realCause(error: unknown, failed: Promise<never>): Promise<unknown> {
  if (!ordinary(error)) return error
  const exited = await Promise.race([
    failed.then(
      () => undefined,
      (reason: unknown) => (reason instanceof AgentExited ? reason : undefined)
    ),
    new Promise<undefined>((resolve) => setTimeout(resolve, EXIT_GRACE_MS))
  ])
  return exited ?? error
}

/** Erreur de l'agent lui-même (réponse JSON-RPC) : ni délai, ni annulation, ni mort. */
function ordinary(error: unknown): boolean {
  return !(
    error instanceof AgentTimeout ||
    error instanceof AgentCancelled ||
    error instanceof AgentExited
  )
}

/**
 * Session d'essai supprimée si l'agent sait le faire ; jamais bloquant. Son propre délai, pas
 * celui de l'essai : après une annulation, un délai dépassé ou un outil refusé, l'agent tourne
 * encore (il n'est arrêté qu'après), et la suppression part quand même. Supprimée : oubliée.
 */
async function removeSession(
  { connection, init }: Connected,
  sessionId: string,
  ms: number,
  options: Pick<ReadinessOptions, 'onSessionRemoved'>
): Promise<void> {
  if (!init.agentCapabilities?.sessionCapabilities?.delete) return
  const done = await within(
    connection.agent.request(methods.agent.session.delete, { sessionId }).then(() => true),
    ms
  )
  if (done) options.onSessionRemoved?.(sessionId)
}

/** L'issue d'une erreur sortie de l'essai. */
export function outcomeOf(error: unknown, stderr: string): AgentReadiness {
  if (error instanceof AgentCancelled) return { state: 'cancelled' }
  if (error instanceof AgentTimeout) return { state: 'timeout', message: error.message }
  if (error instanceof AgentExited) {
    const tail = stderr.trim()
    return { state: 'crashed', message: error.message, ...(tail ? { stderr: tail } : {}) }
  }
  const message = errorMessage(error)
  const cause = classifyTurnFailure(error, stderr)
  if (cause !== 'other') return { state: 'network', cause, message }
  return { state: 'failed', message }
}

function truncate(text: string): string {
  return text.length > MAX_REPLY_CHARS ? `${text.slice(0, MAX_REPLY_CHARS - 1)}…` : text
}
