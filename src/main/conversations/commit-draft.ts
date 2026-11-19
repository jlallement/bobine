/**
 * Message de commit rédigé par l'agent (fiche 246, ADR-0056) : une session ACP jetable du même
 * agent, dans le dossier du commit, comme l'aparté (fiche 180) — son propre processus, lecture
 * seule (mode plan, toute autorisation refusée, élicitations déclinées, ni outils de l'app), une
 * seule demande, puis session supprimée et processus arrêté **dans tous les cas** : réponse, délai
 * dépassé, « Arrêter », nouvelle demande, conversation supprimée, sortie de l'app. Rien n'arrive
 * dans le fil ; le coût est ajouté à celui de la conversation.
 *
 * Coût (fiche 254, D1) : lu **avant** la suppression de la session. Un agent qui l'écrit après sa
 * réponse hors protocole (Bob : sa base, où `session/delete` efface la ligne de la tâche) est
 * attendu jusqu'à ce que la relecture de l'hôte (`SessionCost` : fin du tour, veille de la source,
 * relectures tardives) l'annonce, dans une borne ; puis le coût est posé, puis la session supprimée.
 *
 * N'importe pas `electron` : testable sous Vitest contre l'agent factice.
 */
import type { AgentEvent, AgentStatus } from '@shared/agent'
import {
  commitDraftPrompt,
  draftFromReply,
  DRAFT_LIMITS,
  DRAFT_TIMEOUT_MS,
  fallbackCommitMessage,
  boundedText,
  type CommitDraftInput,
  type CommitDraftPlace,
  type CommitDraftReason,
  type CommitDraftRequest,
  type CommitDraftResult
} from '@shared/commit-draft'
import { messageOf } from '@shared/errors'
import { reduceTranscript, type TranscriptItem, type TranscriptState } from '@shared/transcript'
import { AgentHost, type AgentHostOptions } from '../agent/agent-host'
import { draftFiles, redactLines } from '../changes/commit-diff'
import { log } from '../log'
import type { Run } from '../simulator/run'
import { asideHostOptions, LATE_COST_MS, type AsideConversations, type AsideHost } from './aside'

/**
 * Attente au plus du coût écrit par l'agent après sa réponse (`costSource` du profil, Bob), avant
 * de supprimer la session. Finie dès que le coût arrive : la borne ne sert qu'à un agent qui n'écrit
 * rien. Au-delà de la dernière relecture à heure fixe de `SessionCost` (5 s), sa veille de la source
 * prend le relais.
 */
export const DRAFT_COST_WAIT_MS = 15_000

/** Ce que la rédaction demande aux conversations : celles de l'aparté, plus le titre. */
export interface CommitDraftConversations extends AsideConversations {
  title(id: string): string
}

export interface CommitDraftsOptions {
  conversations: CommitDraftConversations
  /** Dossier où les chemins des fichiers valent, et où la session est ouverte. */
  cwdFor: (id: string, place: CommitDraftPlace) => Promise<string>
  /** Souvenirs approuvés pour ce dossier ; vide si la mémoire est désactivée. */
  memories: (cwd: string) => Promise<CommitDraftInput['memories']>
  /** Réglage « Message de commit rédigé par l'agent ». */
  enabled: () => boolean
  run: Run
  createHost?: (options: AgentHostOptions) => AsideHost
  timeoutMs?: number
  /**
   * Attente au plus du coût après la réponse, finie dès qu'il arrive : `DRAFT_COST_WAIT_MS` pour un
   * agent dont le profil lit le coût hors protocole, `LATE_COST_MS` sinon.
   */
  lateCostMs?: number
  now?: () => number
}

interface Draft {
  id: string
  host: AsideHost
  profileId: string
  agentLabel: string
  text: string
  /** Fil de la session jetable : son coût (`usage`), comme pour l'aparté. */
  state: TranscriptState
  /** Le tour est allé au bout : le coût peut encore arriver un instant après. */
  turnEnded: boolean
  /** Le profil lit le coût hors protocole (`costSource`) : il arrive après la réponse. */
  lateCost: boolean
  /** Un coût est arrivé après la fin du tour : l'attente de `end` s'arrête. */
  costAfterTurn: boolean
  /** Réveil de l'attente du coût (`end`). */
  onCost?: () => void
  finish: (outcome: Outcome) => void
  done: boolean
}

type Outcome = { message: string } | { reason: CommitDraftReason; detail?: string }

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Premier message de l'utilisateur dans le fil, borné et sans secret. */
function firstRequest(items: readonly TranscriptItem[]): string | undefined {
  const first = items.find((i): i is Extract<TranscriptItem, { kind: 'user' }> => i.kind === 'user')
  if (!first?.text.trim()) return undefined
  return redactLines(boundedText(first.text.trim(), DRAFT_LIMITS.firstMessageChars))
}

/** Une rédaction au plus par conversation. */
export class CommitDrafts {
  private readonly drafts = new Map<string, Draft>()
  /** Agents des rédactions finies, en train de fermer leur session (coût relu, suppression). */
  private readonly ending = new Map<AsideHost, Draft>()
  private readonly options: CommitDraftsOptions

  constructor(options: CommitDraftsOptions) {
    this.options = options
    options.conversations.subscribe({
      deleted: (id) => this.stop(id),
      stopped: () => this.stopAll()
    })
  }

  /** Rédactions en cours ou en train de finir (essais : aucune ne doit survivre). */
  get active(): number {
    return this.drafts.size + this.ending.size
  }

  /** Rédige le message ; ne lève jamais : le repli porte la raison. */
  async draft(id: string, request: CommitDraftRequest): Promise<CommitDraftResult> {
    const fallback = (
      reason: CommitDraftReason,
      extra: { agentLabel?: string; detail?: string; timeoutMs?: number } = {}
    ) =>
      ({
        source: 'fallback',
        message: fallbackCommitMessage(request.files),
        reason,
        ...extra
      }) as const
    // Une nouvelle demande arrête la précédente (cases changées, « Rédiger à nouveau »).
    this.stop(id)
    if (!this.options.enabled()) return fallback('disabled')
    const started = this.now()
    let input: CommitDraftInput
    let cwd: string
    try {
      cwd = await this.options.cwdFor(id, request.place)
      const [files, memories] = await Promise.all([
        draftFiles(this.options.run, cwd, request.files),
        this.options.memories(cwd).catch(() => [])
      ])
      const firstMessage = firstRequest(this.options.conversations.view(id).transcript.items)
      input = {
        title: this.options.conversations.title(id),
        ...(firstMessage ? { firstMessage } : {}),
        memories,
        files
      }
    } catch (error) {
      return fallback('failed', { detail: messageOf(error) })
    }
    const outcome = await this.ask(id, cwd, commitDraftPrompt(input))
    if ('message' in outcome) {
      return {
        source: 'agent',
        message: outcome.message,
        agentLabel: outcome.agentLabel ?? '',
        ms: this.now() - started,
        withMemory: input.memories.length > 0
      }
    }
    return fallback(outcome.reason, {
      ...(outcome.agentLabel ? { agentLabel: outcome.agentLabel } : {}),
      ...(outcome.detail ? { detail: outcome.detail } : {}),
      ...(outcome.reason === 'timeout'
        ? { timeoutMs: this.options.timeoutMs ?? DRAFT_TIMEOUT_MS }
        : {})
    })
  }

  /** « Arrêter » : la rédaction en cours finit en repli (`stopped`), l'agent est arrêté. */
  stop(id: string): void {
    this.drafts.get(id)?.finish({ reason: 'stopped' })
  }

  /** Sortie de l'app : toutes les rédactions s'arrêtent, leurs agents aussi. */
  stopAll(): void {
    for (const draft of [...this.drafts.values()]) draft.finish({ reason: 'stopped' })
    // Pas d'attente possible en quittant : le coût déjà connu est compté tout de suite, et les
    // agents qui ferment leur session s'arrêtent net.
    for (const [host, draft] of this.ending) {
      draft.onCost?.()
      host.stop()
    }
    this.ending.clear()
  }

  private ask(
    id: string,
    cwd: string,
    prompt: string
  ): Promise<(Outcome & { agentLabel?: string }) | { message: string; agentLabel: string }> {
    const holder: { draft?: Draft } = {}
    const base = this.options.conversations.asideHost(id, (event) => {
      if (holder.draft) this.onEvent(holder.draft, event)
    })
    const host = (this.options.createHost ?? ((o) => new AgentHost(o)))({
      ...asideHostOptions({ ...base, workspace: cwd }, base.emit),
      // Double garde : en plus du refus d'office plus bas, l'hôte refuse toute écriture.
      readOnly: true
    })
    return new Promise((resolve) => {
      const draft: Draft = {
        id,
        host,
        profileId: base.profile.id,
        agentLabel: base.profile.label,
        text: '',
        state: { items: [], nextId: 1 },
        turnEnded: false,
        lateCost: !!base.profile.costSource,
        costAfterTurn: false,
        done: false,
        finish: (outcome) => {
          if (draft.done) return
          draft.done = true
          clearTimeout(timer)
          if (this.drafts.get(id) === draft) this.drafts.delete(id)
          resolve({ ...outcome, agentLabel: draft.agentLabel } as Outcome & { agentLabel: string })
          void this.end(draft)
        }
      }
      holder.draft = draft
      this.drafts.set(id, draft)
      const timer = setTimeout(
        () => draft.finish({ reason: 'timeout' }),
        this.options.timeoutMs ?? DRAFT_TIMEOUT_MS
      )
      timer.unref?.()
      void (async () => {
        try {
          await host.start()
          if (draft.done) return
          // Démarrage manqué (connexion, licence, confiance, commande introuvable) : le statut
          // l'a déjà dit (`onEvent`) ; sinon, l'hôte n'est pas prêt.
          if (host.currentSessionId === undefined) {
            draft.finish({ reason: 'needs-action' })
            return
          }
          await host.prompt(prompt)
        } catch (error) {
          draft.finish({ reason: 'failed', detail: messageOf(error) })
        }
      })()
    })
  }

  private onEvent(draft: Draft, event: AgentEvent): void {
    if (draft.done) {
      // Arrêtée : plus rien n'est accordé, même après coup.
      if (event.type === 'permission-request') draft.host.respondPermission(event.requestId, null)
      // Mais le coût, lui, arrive souvent après la fin du tour (Bob : relu dans sa base, D1).
      else if (isCost(event)) {
        draft.state = reduceTranscript(draft.state, event)
        if (draft.turnEnded) {
          draft.costAfterTurn = true
          draft.onCost?.()
        }
      }
      return
    }
    draft.state = reduceTranscript(draft.state, event)
    switch (event.type) {
      case 'status':
        this.onStatus(draft, event.snapshot.status, event.snapshot.detail)
        if (event.snapshot.info.agentName) draft.agentLabel = event.snapshot.info.agentName
        break
      case 'update': {
        const update = event.update
        if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
          draft.text += update.content.text
        }
        break
      }
      case 'permission-request': {
        // Lecture seule : jamais d'autorisation ; « refuser » si l'agent le propose, sinon annuler.
        const reject =
          event.options.find((o) => o.kind === 'reject_once') ??
          event.options.find((o) => o.kind === 'reject_always')
        draft.host.respondPermission(event.requestId, reject?.optionId ?? null)
        break
      }
      case 'elicitation-request':
        draft.host.respondElicitation(event.requestId, { action: 'decline' })
        break
      case 'turn-end':
        draft.turnEnded = true
        draft.finish(draftFromReply(draft.text, event.stopReason))
        break
      case 'turn-error':
        draft.finish({ reason: 'failed', detail: event.message })
        break
    }
  }

  private onStatus(draft: Draft, status: AgentStatus, detail: string | undefined): void {
    if (status === 'needs-action') draft.finish({ reason: 'needs-action' })
    else if (status === 'error' || status === 'exited') {
      draft.finish({ reason: 'failed', ...(detail ? { detail } : {}) })
    }
  }

  /** Tour arrêté, coût compté, session supprimée (ou fermée et retenue), agent arrêté. */
  private async end(draft: Draft): Promise<void> {
    const { host } = draft
    const sessionId = host.currentSessionId
    this.ending.set(host, draft)
    try {
      if (draft.turnEnded) await this.costAfterTurn(draft)
      this.postCost(draft)
      if (sessionId) {
        if (host.sessionSupport.delete) {
          await withTimeout(host.deleteSession(), 3_000)
        } else {
          if (host.sessionSupport.close) await withTimeout(host.closeSession(), 3_000)
          this.options.conversations.noteAsideSession(draft.id, draft.profileId, sessionId)
        }
      }
    } catch (error) {
      log.warn(`Session de rédaction non supprimée (${draft.id}) :`, messageOf(error))
    } finally {
      // Toujours : le processus de l'agent (et ce qu'il a lancé) ne survit jamais à la rédaction.
      this.ending.delete(host)
      host.stop()
    }
  }

  /**
   * Attend le coût annoncé après la fin du tour (relecture de l'hôte), au plus la borne. Sans source
   * hors protocole, le coût par ACP est déjà là : la courte attente d'un `usage_update` tardif.
   */
  private async costAfterTurn(draft: Draft): Promise<void> {
    if (draft.costAfterTurn) return
    const bound = this.options.lateCostMs ?? (draft.lateCost ? DRAFT_COST_WAIT_MS : LATE_COST_MS)
    if (bound <= 0) return
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, bound)
      timer.unref()
      draft.onCost = () => {
        clearTimeout(timer)
        resolve()
      }
    })
    delete draft.onCost
  }

  private postCost(draft: Draft): void {
    const cost = draft.state.usage?.cost
    if (!cost || cost.amount <= 0) return
    try {
      this.options.conversations.post(draft.id, {
        type: 'aside-cost',
        cost: { amount: round6(cost.amount), currency: cost.currency }
      })
    } catch (error) {
      log.warn(`Coût de rédaction non compté (${draft.id}) :`, messageOf(error))
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)()
  }
}

/** Évènement qui porte le coût de la session (hors protocole ou par ACP). */
function isCost(event: AgentEvent): boolean {
  return (
    event.type === 'usage-report' ||
    (event.type === 'update' && event.update.sessionUpdate === 'usage_update')
  )
}

/** Promesse abandonnée au bout de `ms` (session à supprimer chez un agent qui ne répond plus). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms).unref?.())
  ])
}
