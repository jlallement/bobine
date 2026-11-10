/**
 * Sous-agents suivis en direct (fiche 053) : début au premier `in_progress`, fin à `completed` /
 * `failed` ou à la fin du tour. Pour un agent qui l'écrit hors protocole (Bob : `costs`), le coût
 * de chaque sous-agent est relu toutes les `pollMs` tant qu'il travaille, puis une dernière fois à
 * la fin. Ne reçoit que les mises à jour en direct, jamais le rejeu d'une session.
 *
 * Quand l'agent relaie le travail de ses sous-agents dans le flux de la conversation (OpenCode 2,
 * fiche 078), `cardFor` dit sous quelle carte le ranger.
 *
 * Un sous-agent lancé en arrière-plan (fiche 122 : son outil rend la main tout de suite) reste en
 * cours après le tour : sa session est relue (`follow`) jusqu'à ce qu'elle se termine par une
 * réponse, deux fois de suite sans travail relayé entre-temps ; cette réponse part avec la fin.
 */
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { subagentMarkOf, type SubagentRun } from '@shared/subagent'
import type { TranscriptItem } from '@shared/transcript'
import type { ChildSession, SubagentCost } from './adapters'

export interface SubagentTrackerOptions {
  emit: (toolCallId: string, run: SubagentRun) => void
  /** Sous-agents de la conversation chez l'agent, et la devise de leur coût (`costSource`). */
  costs?: { read: () => SubagentCost[] | undefined; currency: string }
  /** Appelé à chaque relecture des coûts (pour relire aussi celui de la conversation). */
  onPoll?: () => void
  /** L'agent sait rejouer la session d'un sous-agent (profil `subagentReplay`). */
  replay?: boolean
  now?: () => number
  pollMs?: number
  /** Dernière relecture après la fin : l'agent enregistre parfois le coût juste après. */
  settleMs?: number
  /** L'outil d'un sous-agent rend la main alors qu'il travaille encore (profil, fiche 122). */
  background?: (update: SessionUpdate) => boolean
  /** Relit la session d'un sous-agent, comme « Voir son travail » : suit ceux en arrière-plan. */
  follow?: (sessionId: string) => Promise<TranscriptItem[]>
}

/** Sous-agent en arrière-plan suivi par relecture de sa session (fiche 122). */
interface Detached {
  sessionId: string
  /** Réponse lue à la dernière relecture (fin si elle se répète). */
  answer?: string
  checks: number
  /** Travail relayé en direct (`cardFor`), et sa valeur à la dernière relecture. */
  activity: number
  seen: number
  timer?: ReturnType<typeof setTimeout>
}

interface Tracked {
  toolCallId: string
  task: string
  seenAt: number
  startedAt?: number
  endedAt?: number
  rowId?: string
  cost?: number
  /** Session du sous-agent dont le travail arrive en direct (OpenCode 2). */
  childId?: string
  detached?: Detached
}

const POLL_MS = 2000
const SETTLE_MS = 1500
/** Marge entre l'apparition de la carte et la création de la ligne chez l'agent. */
const ROW_SLACK_MS = 2000
/** Relectures d'un sous-agent en arrière-plan : vite au début, puis toutes les 30 s. */
const FOLLOW_MS = [2000, 3000, 5000, 8000, 13_000, 20_000, 30_000]

/**
 * Réponse finale d'une session de sous-agent relue, ou `undefined` s'il travaille encore : elle
 * finit par un message (réflexion mise à part), sans outil en attente ou en cours.
 */
export function finalAnswer(items: readonly TranscriptItem[]): string | undefined {
  const shown = items.filter((i) => i.kind === 'agent' || i.kind === 'tool')
  if (
    shown.some((i) => i.kind === 'tool' && (i.status === 'pending' || i.status === 'in_progress'))
  )
    return undefined
  const last = shown.at(-1)
  return last?.kind === 'agent' && last.text.trim() ? last.text.trim() : undefined
}

export class SubagentTracker {
  private readonly options: SubagentTrackerOptions
  private readonly tracked = new Map<string, Tracked>()
  /** Session d'un sous-agent → carte sous laquelle ranger son travail. */
  private readonly children = new Map<string, string>()
  private timer: ReturnType<typeof setInterval> | undefined
  private readonly settleTimers = new Set<ReturnType<typeof setTimeout>>()

  constructor(options: SubagentTrackerOptions) {
    this.options = options
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  /** Mise à jour reçue en direct (après qu'elle a été ajoutée au fil). */
  note(update: SessionUpdate): void {
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') return
    const { toolCallId } = update
    // Sous-agent reconnu par le format du profil, marqué par l'hôte (`subagent-marks.ts`).
    const mark = subagentMarkOf(update)
    let item = this.tracked.get(toolCallId)
    if (!item) {
      if (!mark?.subagent) return
      item = { toolCallId, task: mark.subagent.task, seenAt: this.now() }
      this.tracked.set(toolCallId, item)
    }
    const status = update.status
    if (status === 'in_progress' && item.startedAt === undefined && item.endedAt === undefined) {
      item.startedAt = this.now()
      this.options.emit(toolCallId, { startedAt: item.startedAt })
    }
    if ((status === 'completed' || status === 'failed') && item.endedAt === undefined) {
      const sessionId = this.options.replay ? mark?.sessionId : undefined
      if (item.detached) {
        // Déjà suivi en arrière-plan.
      } else if (status === 'completed' && sessionId && this.options.background?.(update)) {
        this.detach(item, sessionId)
      } else {
        this.end(item)
        if (sessionId) this.options.emit(toolCallId, { sessionId })
      }
    }
    this.schedule()
  }

  /**
   * Carte sous laquelle ranger le travail de ce sous-agent : celle déjà choisie pour lui (ou pour
   * le sous-agent qui l'a lancé) ; sinon une carte en cours sans sous-agent, de même consigne
   * (OpenCode titre la session avec la description), à défaut la plus ancienne. `undefined` : aucune.
   */
  cardFor(child: ChildSession): string | undefined {
    const known = this.children.get(child.id) ?? this.children.get(child.parentId)
    if (known) {
      this.children.set(child.id, known)
      const detached = this.tracked.get(known)?.detached
      if (detached) detached.activity++
      return known
    }
    const open = [...this.tracked.values()]
      .filter((item) => item.endedAt === undefined && item.childId === undefined)
      .sort((a, b) => a.seenAt - b.seenAt)
    const title = child.title?.trim()
    const item = open.find((i) => title !== undefined && i.task.trim() === title) ?? open[0]
    if (!item) return undefined
    item.childId = child.id
    this.children.set(child.id, item.toolCallId)
    // Sa session se rejoue aussi (« Voir son travail »), avant même la fin.
    if (this.options.replay) this.options.emit(item.toolCallId, { sessionId: child.id })
    return item.toolCallId
  }

  /** Fin du tour (ou arrêt) : les sous-agents encore en cours sont terminés avec lui, sauf ceux en arrière-plan. */
  settle(): void {
    for (const item of this.tracked.values()) {
      if (item.endedAt === undefined && !item.detached) this.end(item)
    }
    this.schedule()
  }

  /** Nouvelle session ou agent arrêté : plus rien n'est suivi. */
  reset(): void {
    // Sous-agents en arrière-plan pas encore finis : plus personne ne les suit.
    for (const item of this.tracked.values()) {
      if (!item.detached || item.endedAt !== undefined) continue
      clearTimeout(item.detached.timer)
      this.options.emit(item.toolCallId, { lost: true })
    }
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    for (const t of this.settleTimers) clearTimeout(t)
    this.settleTimers.clear()
    this.tracked.clear()
    this.children.clear()
  }

  /** Son outil a rendu la main mais il travaille encore : sa session est relue jusqu'à sa fin. */
  private detach(item: Tracked, sessionId: string): void {
    if (item.startedAt === undefined) {
      item.startedAt = this.now()
      this.options.emit(item.toolCallId, { startedAt: item.startedAt })
    }
    item.detached = { sessionId, checks: 0, activity: 0, seen: 0 }
    // Sa session est connue : son travail relayé va à sa carte, même après un autre message, et
    // un sous-agent d'un tour suivant ne la prend pas pour la sienne (D25, fiche 127).
    item.childId ??= sessionId
    if (!this.children.has(sessionId)) this.children.set(sessionId, item.toolCallId)
    this.options.emit(item.toolCallId, { sessionId, background: true })
    this.followLater(item, item.detached)
  }

  private followLater(item: Tracked, detached: Detached): void {
    const delay = FOLLOW_MS[Math.min(detached.checks, FOLLOW_MS.length - 1)]
    detached.timer = setTimeout(() => void this.check(item, detached), delay)
    detached.timer.unref?.()
  }

  /** Relit la session : fini quand la même réponse revient sans travail relayé entre-temps. */
  private async check(item: Tracked, detached: Detached): Promise<void> {
    const follow = this.options.follow
    if (!follow) return
    const activity = detached.activity
    const answer = await follow(detached.sessionId).then(finalAnswer, () => undefined)
    // Suivi abandonné pendant la relecture (nouvelle session, agent arrêté).
    if (this.tracked.get(item.toolCallId) !== item || item.endedAt !== undefined) return
    const quiet = activity === detached.seen && detached.activity === activity
    if (answer !== undefined && answer === detached.answer && quiet) {
      this.end(item, answer)
      return
    }
    detached.answer = answer
    detached.seen = detached.activity
    detached.checks++
    this.followLater(item, detached)
  }

  private end(item: Tracked, answer?: string): void {
    item.endedAt = this.now()
    if (item.startedAt !== undefined) {
      this.options.emit(item.toolCallId, { endedAt: item.endedAt, ...(answer ? { answer } : {}) })
    }
    if (!this.options.costs) return
    this.poll()
    const timer = setTimeout(() => {
      this.settleTimers.delete(timer)
      this.poll()
    }, this.options.settleMs ?? SETTLE_MS)
    timer.unref?.()
    this.settleTimers.add(timer)
  }

  /** Relecture périodique tant qu'un sous-agent travaille, si l'agent écrit leurs coûts. */
  private schedule(): void {
    const running = [...this.tracked.values()].some((item) => item.endedAt === undefined)
    if (running && this.options.costs && !this.timer) {
      this.timer = setInterval(() => this.poll(), this.options.pollMs ?? POLL_MS)
      this.timer.unref?.()
    } else if (!running && this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  /** Relit les coûts et rattache chaque ligne à sa carte : même consigne, sinon ordre de création. */
  poll(): void {
    this.options.onPoll?.()
    const costs = this.options.costs
    const rows = costs?.read()
    if (!costs || !rows) return
    const items = [...this.tracked.values()].sort((a, b) => a.seenAt - b.seenAt)
    const claimed = new Set(items.flatMap((item) => (item.rowId ? [item.rowId] : [])))
    const claim = (item: Tracked, row: SubagentCost | undefined) => {
      if (!row) return
      item.rowId = row.id
      claimed.add(row.id)
    }
    // Une ligne créée avant la carte est celle d'un sous-agent précédent, même s'il avait la même
    // consigne.
    const free = (item: Tracked) =>
      rows.filter((row) => !claimed.has(row.id) && row.createdAt >= item.seenAt - ROW_SLACK_MS)
    for (const item of items.filter((i) => !i.rowId)) {
      claim(
        item,
        free(item).find((row) => row.title.trim() === item.task.trim())
      )
    }
    for (const item of items.filter((i) => !i.rowId)) claim(item, free(item)[0])
    for (const item of items) {
      const cost = rows.find((row) => row.id === item.rowId)?.cost
      if (cost === undefined || cost === item.cost) continue
      item.cost = cost
      this.options.emit(item.toolCallId, { cost: { amount: cost, currency: costs.currency } })
    }
  }
}
