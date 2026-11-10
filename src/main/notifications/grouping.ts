/**
 * Bannières groupées (fiche 119) : plusieurs conversations qui finissent ou attendent dans la même
 * fenêtre de 3 s (des filles lancées ensemble) font une seule bannière, un seul son, un seul
 * rebond. Deux groupes indépendants : celles qui attendent l'utilisateur, celles qui ont fini (ou
 * se sont arrêtées sur une erreur). Logique pure : l'horloge et l'affichage sont injectés.
 */
import type { AttentionKind, AttentionReason } from '@shared/attention'
import { t } from 'i18next'

export const GROUP_WINDOW_MS = 3000

/** Une bannière : une conversation, ou plusieurs une fois groupées. */
export interface AttentionNotice {
  conversationId: string
  /** Toutes les conversations de la bannière (la première d'abord) ; absent : la seule. */
  conversationIds?: string[]
  kind: AttentionKind
  reason: AttentionReason
  /** Titre de la conversation, pour une bannière groupée. */
  conversationTitle: string
  /** Conversation fille (fiche 097). */
  child?: boolean
  title: string
  body: string
}

export type GroupKind = 'request' | 'finished'

export const groupOf = (kind: AttentionKind): GroupKind =>
  kind === 'request' ? 'request' : 'finished'

/** Planifie `run` dans `ms` ; rend de quoi l'annuler. */
export type Schedule = (run: () => void, ms: number) => () => void

export const timerSchedule: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

/** Bannière de plusieurs conversations : « 3 conversations filles ont fini », titres en corps. */
export function groupedNotice(notices: readonly AttentionNotice[]): AttentionNotice {
  const [first] = notices
  if (!first) throw new Error('groupedNotice : aucune bannière')
  if (notices.length === 1) return first
  const count = notices.length
  const title =
    first.kind === 'request'
      ? t(
          notices.every((n) => n.reason === 'permission')
            ? 'notifications.group.permission'
            : 'notifications.group.request',
          { count }
        )
      : t(
          notices.every((n) => n.child)
            ? 'notifications.group.childrenDone'
            : 'notifications.group.done',
          { count }
        )
  const body = notices
    .map((n) =>
      n.kind === 'error'
        ? t('notifications.group.withError', { title: n.conversationTitle })
        : n.conversationTitle
    )
    .join(', ')
  return {
    ...first,
    conversationIds: notices.map((n) => n.conversationId),
    title,
    body
  }
}

export interface NoticeGroupsOptions {
  /** Montre une bannière (seule ou groupée). */
  show: (notice: AttentionNotice) => void
  schedule: Schedule
  windowMs?: number
}

interface Group {
  notices: AttentionNotice[]
  cancel: () => void
}

export class NoticeGroups {
  private readonly groups = new Map<GroupKind, Group>()
  private readonly options: NoticeGroupsOptions

  constructor(options: NoticeGroupsOptions) {
    this.options = options
  }

  /**
   * Une conversation finit ou attend : `true` si elle ouvre une fenêtre (le son et le rebond se
   * jouent alors), `false` si une autre du même groupe vient de le faire.
   */
  open(kind: AttentionKind): boolean {
    const key = groupOf(kind)
    if (this.groups.has(key)) return false
    const group: Group = {
      notices: [],
      cancel: this.options.schedule(() => this.flush(key), this.options.windowMs ?? GROUP_WINDOW_MS)
    }
    this.groups.set(key, group)
    return true
  }

  /** Bannière à montrer à la fin de la fenêtre ; une conversation n'y est qu'une fois. */
  push(notice: AttentionNotice): void {
    const key = groupOf(notice.kind)
    if (!this.groups.has(key)) this.open(notice.kind)
    const group = this.groups.get(key)
    if (!group) return
    const index = group.notices.findIndex((n) => n.conversationId === notice.conversationId)
    if (index >= 0) group.notices[index] = notice
    else group.notices.push(notice)
  }

  /** Conversation vue (ou supprimée) avant la fin de la fenêtre : plus de bannière pour elle. */
  withdraw(conversationId: string): void {
    for (const group of this.groups.values()) {
      group.notices = group.notices.filter((n) => n.conversationId !== conversationId)
    }
  }

  private flush(key: GroupKind): void {
    const group = this.groups.get(key)
    this.groups.delete(key)
    if (group?.notices.length) this.options.show(groupedNotice(group.notices))
  }

  /** Arrêt de l'app : rien ne part plus. */
  dispose(): void {
    for (const group of this.groups.values()) group.cancel()
    this.groups.clear()
  }
}
