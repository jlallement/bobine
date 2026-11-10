/**
 * Journal de consommation (fiche 130, ADR-0025) : suit le flux des évènements du gestionnaire de
 * conversations et écrit une ligne par tour terminé dans `usage.sqlite`.
 *
 * Il tient son propre état, sans lire le fil : un tour commence au `user-message` (profil, dossier
 * et mère lus à ce moment, modèle et mode portés par l'évènement), compte ses outils par genre et
 * ses sous-agents, retient le contexte et le coût cumulé annoncés (`usage_update`,
 * `usage-report`), et finit au `turn-end`, au `turn-error`, ou quand l'agent s'arrête en plein tour.
 * Le coût d'un tour est la différence du coût cumulé de la session entre son début et sa fin, comme
 * dans le fil (fiche 109) ; annoncé après la fin (Bob), il réécrit la ligne du même tour. Rien n'est
 * jamais supprimé : ni la suppression d'une conversation, ni le passage à un autre agent n'effacent
 * ses lignes.
 */
import type { Usage } from '../../shared/acp-sdk.mts'
import type { AgentEvent, ConversationEvent } from '@shared/agent'
import type { Cost, TurnRow, TurnTokens, UsageDb } from './usage-db'

/** Ce que le journal sait d'une conversation au début d'un tour. */
export interface TurnContext {
  profileId: string
  profileLabel?: string
  workspace?: string
  parentId?: string
}

export interface UsageJournalOptions {
  db: Pick<UsageDb, 'upsert'>
  /** Conversation au début d'un tour ; `undefined` si elle est inconnue (aucune ligne). */
  describe: (conversationId: string) => TurnContext | undefined
  /**
   * Coût cumulé de la session déjà connu (conversation rouverte, fil gardé) : lu au premier tour
   * d'une conversation que le journal n'a pas encore suivie, sinon le premier tour compterait
   * toute la session.
   */
  knownCost?: (conversationId: string) => Cost | undefined
  /** Racine du dépôt d'un dossier (`repo-root.ts`). */
  repoRoot?: (folder: string) => string | undefined
  now?: () => number
}

interface Turn {
  row: TurnRow
  /** Coût cumulé de la session au début du tour. */
  costStart?: Cost
  toolIds: Set<string>
  /** Coût de chaque sous-agent, par carte (`undefined` tant qu'il n'est pas connu). */
  subagents: Map<string, Cost | undefined>
}

interface Track {
  /** Dernier coût cumulé de la session annoncé. */
  cost?: Cost
  /** Le coût de départ est connu (déjà suivi, ou nouvelle session après une bascule). */
  costKnown: boolean
  open?: Turn
  /** Dernier tour écrit : un coût ou un sous-agent annoncés après sa fin le réécrivent. */
  last?: Turn
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

const count = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined

/** Jetons d'un tour tels que l'agent les donne ; ce qu'il ne donne pas reste absent. */
export function tokensOf(usage: Usage | undefined): TurnTokens {
  if (!usage) return {}
  const tokens: TurnTokens = {
    input: count(usage.inputTokens),
    output: count(usage.outputTokens),
    cachedRead: count(usage.cachedReadTokens),
    cachedWrite: count(usage.cachedWriteTokens),
    thought: count(usage.thoughtTokens),
    total: count(usage.totalTokens)
  }
  return Object.fromEntries(Object.entries(tokens).filter(([, v]) => v !== undefined))
}

/** Coût d'un tour : différence des coûts cumulés, dans la même unité, jamais négatif. */
export function costBetween(start: Cost | undefined, end: Cost | undefined): Cost | undefined {
  if (!end) return undefined
  if (start && start.currency !== end.currency) return undefined
  const amount = round6(end.amount - (start?.amount ?? 0))
  return amount >= 0 ? { amount, currency: end.currency } : undefined
}

/** Total des coûts connus des sous-agents, s'ils sont tous dans la même unité. */
function subagentTotal(costs: Iterable<Cost | undefined>): Cost | undefined {
  const known = [...costs].filter((c): c is Cost => !!c)
  const currency = known[0]?.currency
  if (currency === undefined || known.some((c) => c.currency !== currency)) return undefined
  return { amount: round6(known.reduce((n, c) => n + c.amount, 0)), currency }
}

/** États d'un agent qui ne travaille plus : un tour encore ouvert ne finira pas normalement. */
const STOPPED = new Set(['exited', 'error', 'idle', 'read-only'])

export class UsageJournal {
  private readonly tracks = new Map<string, Track>()
  private readonly options: UsageJournalOptions
  private readonly now: () => number

  constructor(options: UsageJournalOptions) {
    this.options = options
    this.now = options.now ?? Date.now
  }

  onEvent({ conversationId, event }: ConversationEvent): void {
    const track = this.track(conversationId)
    switch (event.type) {
      case 'user-message':
        return this.start(conversationId, track, event)
      case 'update':
        return this.onUpdate(track, event.update)
      case 'usage-report':
        return this.setCost(track, event.cost)
      case 'subagent-run':
        return this.onSubagent(track, event.toolCallId, event.run.cost)
      case 'turn-end':
        return this.finish(track, event.stopReason, event.at, event.usage)
      case 'turn-error':
        return this.finish(track, 'error')
      case 'status':
        if (track.open && STOPPED.has(event.snapshot.status)) this.finish(track, 'interrupted')
        return
      case 'handover':
        // Nouvelle session chez l'autre agent : son coût cumulé part de zéro (ADR-0024).
        this.finish(track, 'interrupted')
        this.tracks.set(conversationId, { costKnown: true })
        return
      default:
        return
    }
  }

  /**
   * Après « Remettre à zéro » (fiche 137) : les tours déjà écrits sont oubliés, un coût annoncé
   * après coup ne recrée pas leur ligne. Les tours en cours restent suivis et seront écrits.
   */
  forgetWritten(): void {
    for (const track of this.tracks.values()) delete track.last
  }

  /** Départ de l'app : les tours encore ouverts sont écrits, interrompus. */
  close(): void {
    for (const track of this.tracks.values()) this.finish(track, 'interrupted')
  }

  private track(id: string): Track {
    let track = this.tracks.get(id)
    if (!track) {
      track = { costKnown: false }
      this.tracks.set(id, track)
    }
    return track
  }

  private start(
    conversationId: string,
    track: Track,
    event: Extract<AgentEvent, { type: 'user-message' }>
  ): void {
    // Un tour resté ouvert (agent coupé sans fin de tour) : écrit, interrompu.
    this.finish(track, 'interrupted')
    const context = this.options.describe(conversationId)
    if (!context) return
    if (!track.costKnown) {
      track.cost = this.options.knownCost?.(conversationId) ?? track.cost
      track.costKnown = true
    }
    const startedAt = event.at ?? this.now()
    const workspace = context.workspace || undefined
    const repoRoot = workspace ? this.options.repoRoot?.(workspace) : undefined
    const row: TurnRow = {
      id: `${conversationId}:${startedAt}`,
      conversationId,
      ...(context.parentId ? { parentId: context.parentId } : {}),
      startedAt,
      profileId: context.profileId,
      ...(context.profileLabel ? { profileLabel: context.profileLabel } : {}),
      ...(event.model ? { model: { id: event.model.id, name: event.model.name } } : {}),
      ...(event.mode ? { mode: { id: event.mode.id, name: event.mode.name } } : {}),
      ...(workspace ? { workspace } : {}),
      ...(repoRoot ? { repoRoot } : {}),
      tokens: {},
      tools: {},
      subagents: 0
    }
    track.open = {
      row,
      ...(track.cost ? { costStart: track.cost } : {}),
      toolIds: new Set(),
      subagents: new Map()
    }
  }

  private onUpdate(track: Track, update: Extract<AgentEvent, { type: 'update' }>['update']): void {
    if (update.sessionUpdate === 'tool_call') {
      const turn = track.open
      if (!turn || turn.toolIds.has(update.toolCallId)) return
      turn.toolIds.add(update.toolCallId)
      const kind = update.kind ?? 'other'
      turn.row.tools = { ...turn.row.tools, [kind]: (turn.row.tools[kind] ?? 0) + 1 }
    } else if (update.sessionUpdate === 'usage_update') {
      const size = count(update.size)
      if (track.open && size) track.open.row.context = { used: count(update.used) ?? 0, size }
      const cost = update.cost
      if (cost && typeof cost.currency === 'string' && count(cost.amount) !== undefined) {
        this.setCost(track, { amount: cost.amount, currency: cost.currency })
      }
    }
  }

  /** Coût cumulé annoncé ; hors d'un tour, il revient au dernier tour écrit (Bob, après coup). */
  private setCost(track: Track, cost: Cost): void {
    track.cost = { amount: cost.amount, currency: cost.currency }
    track.costKnown = true
    const last = track.last
    if (track.open || !last) return
    const next = costBetween(last.costStart, track.cost)
    if (JSON.stringify(next) === JSON.stringify(last.row.cost)) return
    last.row = { ...last.row, ...(next ? { cost: next } : {}) }
    if (!next) delete last.row.cost
    this.options.db.upsert(last.row)
  }

  /** Sous-agent suivi (fiche 053) : rattaché au tour qui l'a lancé, même s'il finit après lui. */
  private onSubagent(track: Track, toolCallId: string, cost: Cost | undefined): void {
    const lastHasIt = track.last?.subagents.has(toolCallId)
    const turn = lastHasIt || !track.open ? track.last : track.open
    if (!turn) return
    turn.subagents.set(toolCallId, cost ?? turn.subagents.get(toolCallId))
    turn.row.subagents = turn.subagents.size
    const total = subagentTotal(turn.subagents.values())
    if (total) turn.row.subagentCost = total
    else delete turn.row.subagentCost
    if (turn === track.last && turn !== track.open) this.options.db.upsert(turn.row)
  }

  private finish(track: Track, stopReason: string, at?: number, usage?: Usage): void {
    const turn = track.open
    if (!turn) return
    track.open = undefined
    const cost = costBetween(turn.costStart, track.cost)
    turn.row = {
      ...turn.row,
      endedAt: at ?? this.now(),
      stopReason,
      tokens: tokensOf(usage),
      ...(cost ? { cost } : {})
    }
    track.last = turn
    this.options.db.upsert(turn.row)
  }
}
