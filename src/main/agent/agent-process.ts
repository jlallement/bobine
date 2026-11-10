/**
 * Processus d'un agent ACP et son journal (fiche 080) : lancement, fin de la sortie d'erreur,
 * lignes d'`agents.log` (sortie d'erreur, échanges ACP relevés par `AcpLog` au fil des flux, copiés
 * pour l'onglet « Échanges ACP » d'une conversation : fiche 135), arrêt
 * noté dans `main.log`, et `failed`, rejetée à la mort du processus. Rien de la session : c'est
 * l'affaire d'`AgentHost`. N'importe pas `electron`.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import { withEnvChanges, type EnvChanges } from '../agent-config/api-keys'
import { agentLog, log, logs, type LogScope } from '../log'
import { addSecret, excerpt } from '../log-redact'
import { trackChild } from '../process-registry'
import { acpExchanges } from './acp-exchanges'
import { AcpLog, formatDuration, type Direction } from './acp-log'
import { spawnError } from './process-utils'
import type { AgentProfile } from './profiles'
import { t } from 'i18next'

/** Fin de la sortie d'erreur gardée pour expliquer une panne. */
const STDERR_TAIL = 2000

/**
 * Lance l'agent d'un profil dans `cwd`, avec les clés d'API de l'app posées dans son environnement.
 * Propre groupe de processus : un Ctrl+C dans le terminal ne tue pas l'agent dans le dos de l'app,
 * et killTree() arrête toute la chaîne (ex. npx → adaptateur → agent).
 */
export function spawnAgent(
  profile: AgentProfile,
  options: { cwd: string; extraArgs?: string[]; credentials?: EnvChanges }
): ChildProcessWithoutNullStreams {
  const args = [...profile.args, ...(options.extraArgs ?? [])]
  const child = spawn(profile.command, args, {
    cwd: options.cwd,
    // Journal sur Trace : celui de l'agent aussi, si son profil sait le régler (fiche 165).
    env: withEnvChanges(
      { ...process.env, ...profile.env, ...(logs('trace') ? profile.traceEnv : {}) },
      options.credentials ?? {}
    ),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true
  })
  // Noté pour être arrêté au prochain démarrage si le main plante (fiche 138).
  trackChild(child, [profile.command, ...args])
  return child
}

export interface LaunchOptions {
  profile: AgentProfile
  cwd: string
  /** Arguments ajoutés pour ce lancement (ex. `--trust`). */
  extraArgs: string[]
  /** Clés d'API posées ou retirées dans l'environnement de l'agent ; masquées dans le journal. */
  credentials: EnvChanges
  /** D'où viennent les lignes d'`agents.log`. */
  scope: LogScope
  /** Désignation de l'agent dans `main.log`, ex. « (mock, 1a2b3c4d) ». */
  label: string
  /** Octets reçus de l'agent : sert à repérer un agent qui se tait pendant un tour. */
  onActivity: () => void
}

/** Agent lancé : son processus, ses flux pour la connexion ACP, et de quoi expliquer sa fin. */
export interface AgentProcess {
  readonly child: ChildProcessWithoutNullStreams
  readonly startedAt: number
  /** Vers l'agent (son entrée standard), relevé dans `agents.log`. */
  readonly toAgent: WritableStream<Uint8Array>
  /** Depuis l'agent (sa sortie standard), relevé dans `agents.log`. */
  readonly fromAgent: ReadableStream<Uint8Array>
  /** Relevé des échanges ACP (les morceaux de texte regroupés sont écrits par `flush`). */
  readonly acpLog: AcpLog
  /**
   * Rejetée quand le processus meurt ou n'a pas pu être lancé (commande introuvable…) ; jamais
   * résolue. Un rejet non attendu n'est pas signalé comme non géré.
   */
  readonly failed: Promise<never>
  /** Dernières lignes de la sortie d'erreur, précédées d'un saut de ligne ; vide sinon. */
  stderrHint(): string
  /** Repère dans la sortie d'erreur, pour en relire la suite (`stderrSince`, fiche 142). */
  stderrMark(): number
  /** Sortie d'erreur écrite depuis le repère (dans la limite de ce qui est gardé). */
  stderrSince(mark: number): string
}

/**
 * Lance l'agent et branche son journal. Synchrone : `failed` existe avant le premier `await` de
 * l'appelant, et ses écouteurs `exit` (journal, puis `failed`) passent avant ceux qu'il ajoute.
 */
export function launchAgent(options: LaunchOptions): AgentProcess {
  const { profile, cwd, extraArgs, credentials, scope, label } = options
  // Les clés données à l'agent ne s'écrivent jamais dans le journal (fiche 080).
  for (const value of Object.values(credentials)) if (typeof value === 'string') addSecret(value)
  const child = spawnAgent(profile, { cwd, extraArgs, credentials })
  const startedAt = Date.now()
  log.info(
    `Agent lancé ${label} : ${[profile.command, ...profile.args, ...extraArgs].join(' ')} dans ${cwd} (pid ${child.pid ?? '?'})`
  )
  let stderr = ''
  let stderrLine = ''
  let stderrTotal = 0
  child.stderr.on('data', (data: Buffer) => {
    const text = data.toString()
    stderrTotal += text.length
    stderr = (stderr + text).slice(-STDERR_TAIL)
    if (!logs('detailed')) return
    // Sortie d'erreur de l'agent, ligne à ligne, dans agents.log.
    const lines = (stderrLine + text).split('\n')
    stderrLine = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) agentLog.line(scope, `stderr ${excerpt(line)}`)
  })
  const conversation = scope.conversation
  const acpLog = new AcpLog({
    write: (text) => agentLog.line(scope, text),
    detailed: () => logs('detailed'),
    trace: () => logs('trace'),
    // Copie en mémoire, à tout niveau du journal (pas pour un agent lancé hors conversation).
    ...(conversation
      ? {
          lines: (direction: Direction, line: string) =>
            acpExchanges.line(conversation, direction, line)
        }
      : {})
  })
  child.once('exit', (code, signal) => {
    acpLog.flush()
    log.info(
      `Agent arrêté ${label} : ${signal ?? `code ${code}`} après ${formatDuration(Date.now() - startedAt)}`
    )
  })
  // Chaque ligne JSON-RPC passe par le relevé (fiche 080) ; l'activité de l'agent est notée.
  const tap = (direction: Direction) =>
    new TransformStream<Uint8Array, Uint8Array>({
      transform: (chunk, controller) => {
        if (direction === 'in') options.onActivity()
        acpLog.bytes(direction, chunk)
        controller.enqueue(chunk)
      }
    })
  const toAgent = tap('out')
  toAgent.readable.pipeTo(Writable.toWeb(child.stdin) as WritableStream<Uint8Array>).catch(() => {})
  const fromAgent = (Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>).pipeThrough(
    tap('in')
  )

  const failed = new Promise<never>((_, reject) => {
    child.once('error', (error) => reject(spawnError(error, profile.command)))
    child.once('exit', (code, signal) =>
      reject(
        new Error(
          t('agentHost.exit.ended', {
            status: signal ?? t('agentHost.exit.code', { code: String(code) })
          })
        )
      )
    )
  })
  failed.catch(() => {}) // Évite un rejet non géré si le démarrage réussit.

  return {
    child,
    startedAt,
    toAgent: toAgent.writable,
    fromAgent,
    acpLog,
    failed,
    stderrHint: () => {
      const tail = stderr.trim().split('\n').slice(-5).join('\n')
      return tail ? `\n${tail}` : ''
    },
    stderrMark: () => stderrTotal,
    stderrSince: (mark) => stderr.slice(stderr.length - Math.min(stderrTotal - mark, stderr.length))
  }
}
