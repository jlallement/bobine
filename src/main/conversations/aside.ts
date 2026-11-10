/**
 * Aparté (fiche 180) : une question à côté d'une conversation, posée au même agent dans une session
 * neuve (ADR-0030) d'un hôte à part — son propre processus, pour ne rien croiser du tour en cours
 * (file d'attente, rejeu, réglages). Rien n'arrive dans le fil de la conversation, sauf le coût de
 * l'aparté (`aside-cost`, compté avec les autres sessions, fiche 164).
 *
 * Lecture seule : mode plan de l'agent s'il en a un, consigne jointe, aucune autorisation accordée
 * (refus d'office), ni outils de l'app ni outils « toujours autorisés ». À la fermeture, la session
 * est supprimée chez l'agent s'il le permet ; sinon fermée et retenue par la conversation, pour ne
 * pas reparaître dans « Reprendre une session… ».
 *
 * N'importe pas `electron` : testable sous Vitest contre l'agent factice.
 */
import { t } from 'i18next'
import type { AgentEvent, AgentStatus } from '@shared/agent'
import {
  asideContext,
  asideExcerpt,
  type AsideExchange,
  type AsideRequest,
  type AsideStatus,
  type AsideView
} from '@shared/aside'
import { messageOf } from '@shared/errors'
import { reduceTranscript, type TranscriptItem, type TranscriptState } from '@shared/transcript'
import { AgentHost, type AgentHostOptions } from '../agent/agent-host'
import { delay } from '../delay'
import { log } from '../log'

/** Le coût d'un agent qui l'écrit après sa réponse (Bob) est relu jusqu'à 1,5 s plus tard. */
export const LATE_COST_MS = 2_000

/** Ce que l'aparté utilise de l'hôte d'agent : son API publique, rien de plus (fiche 181). */
export type AsideHost = Pick<
  AgentHost,
  | 'start'
  | 'prompt'
  | 'cancel'
  | 'respondPermission'
  | 'respondElicitation'
  | 'deleteSession'
  | 'closeSession'
  | 'stop'
  | 'currentSessionId'
  | 'sessionSupport'
>

/** Ce que l'aparté demande au gestionnaire des conversations. */
export interface AsideConversations {
  /** Options de l'hôte de la conversation (profil, dossier, clés, réglages retenus). */
  asideHost(id: string, emit: AgentHostOptions['emit']): AgentHostOptions
  /** Contenu de la conversation (son fil, pour la fin jointe à la demande). */
  view(id: string): { transcript: { items: readonly TranscriptItem[] } }
  /** Évènement posé dans la conversation (le coût de l'aparté). */
  post(id: string, event: AgentEvent): void
  /** Session d'aparté que l'agent garde (il ne sait pas la supprimer) : à ne pas proposer. */
  noteAsideSession(id: string, profileId: string, sessionId: string): void
  /** Conversation supprimée, sortie de l'app : l'aparté se ferme. */
  subscribe(listeners: { deleted?: (id: string) => void; stopped?: () => void }): () => void
}

export interface AsidesOptions {
  conversations: AsideConversations
  emit: (view: AsideView) => void
  /** Remplaçable en test ; un vrai `AgentHost` sinon. */
  createHost?: (options: AgentHostOptions) => AsideHost
  now?: () => number
  /** Attente du coût relu après la réponse (`LATE_COST_MS`), raccourcie en test. */
  lateCostMs?: number
}

interface Run {
  id: string
  profileId: string
  host: AsideHost
  state: TranscriptState
  status: AsideStatus
  agentLabel?: string
  error?: string
  /** Question en route, pas encore dans le fil de l'aparté. */
  pending?: string
  /** Refus d'office, par question. */
  refused: number[]
  /** Coût déjà ajouté à la conversation. */
  posted: number
  turnEndedAt: number
  closed: boolean
}

/**
 * Options d'hôte d'un aparté : celles de la conversation, sans outils de l'app, sans contexte joint
 * (bascule, filles, session), sans outils « toujours autorisés » ni session à rouvrir ; mode plan.
 */
export function asideHostOptions(
  base: AgentHostOptions,
  emit: AgentHostOptions['emit']
): AgentHostOptions {
  return {
    profile: base.profile,
    workspace: base.workspace,
    emit,
    ...(base.clientVersion ? { clientVersion: base.clientVersion } : {}),
    ...(base.openExternal ? { openExternal: base.openExternal } : {}),
    ...(base.initialControls ? { initialControls: base.initialControls } : {}),
    ...(base.credentials ? { credentials: base.credentials } : {}),
    ...(base.apiKeyInfo ? { apiKeyInfo: base.apiKeyInfo } : {}),
    ...(base.onAnnounced ? { onAnnounced: base.onAnnounced } : {}),
    ...(base.contextText ? { contextText: base.contextText } : {}),
    ...(base.network ? { network: base.network } : {}),
    ...(base.retryDelaysMs ? { retryDelaysMs: base.retryDelaysMs } : {}),
    ...(base.timeouts ? { timeouts: base.timeouts } : {}),
    initialMode: 'plan'
  }
}

/** Questions et réponses, d'après le fil de l'aparté (un message de l'utilisateur par question). */
export function asideExchanges(
  items: readonly TranscriptItem[],
  refused: readonly number[]
): AsideExchange[] {
  const exchanges: AsideExchange[] = []
  for (const item of items) {
    if (item.kind === 'user') {
      exchanges.push({ question: item.text, answer: '', refused: 0, tools: 0 })
      continue
    }
    const current = exchanges.at(-1)
    if (!current) continue
    if (item.kind === 'agent')
      current.answer = current.answer ? `${current.answer}\n\n${item.text}` : item.text
    else if (item.kind === 'tool') current.tools++
  }
  return exchanges.map((e, i) => ({ ...e, refused: refused[i] ?? 0 }))
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Un aparté au plus par conversation. */
export class Asides {
  private readonly runs = new Map<string, Run>()
  private readonly options: AsidesOptions

  constructor(options: AsidesOptions) {
    this.options = options
    options.conversations.subscribe({
      deleted: (id) => void this.close(id),
      stopped: () => this.stopAll()
    })
  }

  /** Pose une question : ouvre l'aparté s'il ne l'est pas, sinon la pose dans la même session. */
  async ask(id: string, request: AsideRequest): Promise<void> {
    const question = request.question.trim()
    if (!question) return
    let run = this.runs.get(id)
    if (run && (run.status === 'starting' || run.status === 'answering' || run.pending)) {
      throw new Error(t('aside.error.busy'))
    }
    if (run?.status === 'error') {
      this.runs.delete(id)
      void this.end(run)
      run = undefined
    }
    run ??= this.open(id)
    run.pending = question
    delete run.error
    this.emitView(run)
    const excerpt = request.withContext
      ? asideExcerpt(this.options.conversations.view(id).transcript.items)
      : undefined
    try {
      await run.host.start()
      if (run.closed) return
      await run.host.prompt(question, [], { context: asideContext(excerpt) })
    } catch (error) {
      if (run.closed) return
      run.error = messageOf(error)
      log.warn(`Aparté en échec (${id}) :`, run.error)
    } finally {
      delete run.pending
      if (!run.closed) this.emitView(run)
    }
  }

  /** Ferme l'aparté : tour arrêté, coût compté, session supprimée (ou fermée), agent arrêté. */
  async close(id: string): Promise<void> {
    const run = this.runs.get(id)
    if (!run) return
    this.runs.delete(id)
    this.options.emit({ conversationId: id, status: 'closed', exchanges: [] })
    await this.end(run)
  }

  /** Aparté ouvert d'une conversation (la carte qui se rouvre après un changement de conversation). */
  view(id: string): AsideView | null {
    const run = this.runs.get(id)
    return run ? this.viewOf(run) : null
  }

  /** Sortie de l'app : coût compté tout de suite, agents arrêtés (pas d'attente possible). */
  stopAll(): void {
    for (const run of this.runs.values()) {
      run.closed = true
      this.postCost(run)
      run.host.stop()
    }
    this.runs.clear()
  }

  private open(id: string): Run {
    const holder: { run?: Run } = {}
    const options = this.options.conversations.asideHost(id, (event) => {
      if (holder.run) this.onEvent(holder.run, event)
    })
    const host = (this.options.createHost ?? ((o) => new AgentHost(o)))(
      asideHostOptions(options, options.emit)
    )
    const run: Run = {
      id,
      profileId: options.profile.id,
      host,
      state: { items: [], nextId: 1 },
      status: 'starting',
      agentLabel: options.profile.label,
      refused: [],
      posted: 0,
      turnEndedAt: 0,
      closed: false
    }
    holder.run = run
    this.runs.set(id, run)
    return run
  }

  private onEvent(run: Run, event: AgentEvent): void {
    run.state = reduceTranscript(run.state, event)
    switch (event.type) {
      case 'status':
        run.agentLabel = event.snapshot.info.agentName ?? event.snapshot.info.profileLabel
        this.setStatus(run, event.snapshot.status, event.snapshot.detail)
        break
      case 'user-message':
        delete run.pending
        run.refused.push(0)
        break
      case 'permission-request': {
        // Lecture seule : jamais d'autorisation ; « refuser » si l'agent le propose, sinon annuler.
        const reject =
          event.options.find((o) => o.kind === 'reject_once') ??
          event.options.find((o) => o.kind === 'reject_always')
        run.host.respondPermission(event.requestId, reject?.optionId ?? null)
        const last = run.refused.length - 1
        if (last >= 0) run.refused[last] = (run.refused[last] ?? 0) + 1
        break
      }
      case 'elicitation-request':
        run.host.respondElicitation(event.requestId, { action: 'decline' })
        break
      case 'turn-end':
        run.turnEndedAt = this.now()
        break
      case 'turn-error':
        run.error = event.message
        break
    }
    // Pendant un tour, le coût bouge à chaque `usage_update` : compté une fois le tour fini.
    if (run.status !== 'answering') this.postCost(run)
    if (!run.closed) this.emitView(run)
  }

  private setStatus(run: Run, status: AgentStatus, detail: string | undefined): void {
    if (status === 'busy') run.status = 'answering'
    else if (status === 'ready') run.status = 'ready'
    else if (status === 'idle' || status === 'starting') run.status = 'starting'
    else {
      run.status = 'error'
      run.error =
        status === 'needs-action'
          ? t('aside.error.needsAction', { agent: run.agentLabel ?? '' })
          : (detail ?? t('aside.error.stopped'))
    }
  }

  /** Coût de la session d'aparté pas encore compté : ajouté à la conversation. */
  private postCost(run: Run): void {
    const cost = run.state.usage?.cost
    if (!cost || cost.amount <= run.posted) return
    const amount = round6(cost.amount - run.posted)
    run.posted = cost.amount
    try {
      this.options.conversations.post(run.id, {
        type: 'aside-cost',
        cost: { amount, currency: cost.currency }
      })
    } catch (error) {
      // Conversation supprimée entre-temps : rien où compter.
      log.warn(`Coût d'aparté non compté (${run.id}) :`, messageOf(error))
    }
  }

  private async end(run: Run): Promise<void> {
    run.closed = true
    if (run.status === 'answering') await run.host.cancel().catch(() => {})
    const wait = run.turnEndedAt + (this.options.lateCostMs ?? LATE_COST_MS) - this.now()
    if (run.turnEndedAt > 0 && wait > 0) await delay(wait, { unref: true })
    this.postCost(run)
    await this.endSession(run)
    run.host.stop()
  }

  private async endSession(run: Run): Promise<void> {
    const sessionId = run.host.currentSessionId
    if (!sessionId) return
    const support = run.host.sessionSupport
    try {
      if (support.delete) {
        await run.host.deleteSession()
        return
      }
      if (support.close) await run.host.closeSession()
    } catch (error) {
      log.warn(`Session d'aparté non supprimée (${run.id}) :`, messageOf(error))
    }
    try {
      this.options.conversations.noteAsideSession(run.id, run.profileId, sessionId)
    } catch {
      // Conversation supprimée : rien à retenir.
    }
  }

  private viewOf(run: Run): AsideView {
    const exchanges = asideExchanges(run.state.items, run.refused)
    if (run.pending) exchanges.push({ question: run.pending, answer: '', refused: 0, tools: 0 })
    const cost = run.state.usage?.cost
    return {
      conversationId: run.id,
      status: run.pending && run.status === 'ready' ? 'answering' : run.status,
      ...(run.agentLabel ? { agentLabel: run.agentLabel } : {}),
      exchanges,
      ...(cost && cost.amount > 0 ? { cost } : {}),
      ...(run.error ? { error: run.error } : {})
    }
  }

  private emitView(run: Run): void {
    this.options.emit(this.viewOf(run))
  }

  private now(): number {
    return (this.options.now ?? Date.now)()
  }
}
