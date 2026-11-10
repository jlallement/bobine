/**
 * Appels d'outils regroupés dans le fil (fiche 047) : des outils qui se suivent forment un bloc
 * repliable (« 3 lectures et 2 recherches »), comme dans Claude Desktop. Ce qui attend
 * l'utilisateur (autorisation, plan à valider) reste toujours visible. Les sous-agents consécutifs
 * ont leur propre carte, « Sous-agents » (fiche 117), même seuls.
 */
import { t } from 'i18next'
import type { AppToolGroup } from './app-tools'
import { currentLocale } from './i18n/format'
import type { TranscriptItem } from './transcript'

export type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

/** Élément du fil à afficher : un élément seul, ou un groupe d'outils consécutifs. */
export type ThreadEntry =
  | { kind: 'item'; item: TranscriptItem }
  | { kind: 'tools'; key: number; items: ToolItem[] }
  | { kind: 'subagents'; key: number; items: ToolItem[] }

/** L'outil lance-t-il un sous-agent (carte « Sous-agents », fiche 117) ? */
export const isSubagent = (item: TranscriptItem): item is ToolItem =>
  item.kind === 'tool' && !!item.subagent

/** Un outil peut-il entrer dans un groupe ? */
export function groupable(item: TranscriptItem): item is ToolItem {
  return (
    item.kind === 'tool' &&
    !item.subagent &&
    item.permission?.state !== 'pending' &&
    !(item.toolKind === 'switch_mode' && item.permission)
  )
}

/**
 * Regroupe les outils consécutifs (au moins deux), et les sous-agents consécutifs (dès un seul,
 * fiche 117, y compris celui qui attend une autorisation). `standalone` : éléments à laisser seuls
 * en plus (ex. outil auquel une carte de plan est rattachée).
 */
export function groupTools(
  items: readonly TranscriptItem[],
  standalone: (item: TranscriptItem) => boolean = () => false
): ThreadEntry[] {
  const entries: ThreadEntry[] = []
  let run: ToolItem[] = []
  let subagents: ToolItem[] = []
  const close = () => {
    const [first] = run
    if (run.length >= 2 && first) entries.push({ kind: 'tools', key: first.id, items: run })
    else for (const item of run) entries.push({ kind: 'item', item })
    run = []
  }
  const closeSubagents = () => {
    const [first] = subagents
    if (first) entries.push({ kind: 'subagents', key: first.id, items: subagents })
    subagents = []
  }
  for (const item of items) {
    if (standalone(item)) {
      close()
      closeSubagents()
      entries.push({ kind: 'item', item })
    } else if (isSubagent(item)) {
      close()
      subagents.push(item)
    } else if (groupable(item)) {
      closeSubagents()
      run.push(item)
    } else {
      close()
      closeSubagents()
      entries.push({ kind: 'item', item })
    }
  }
  close()
  closeSubagents()
  return entries
}

/** État d'une carte « Sous-agents » (fiche 117) : un compte par état, et le coût total connu. */
export interface SubagentsState {
  running: number
  waiting: number
  done: number
  failed: number
  /** Refusés par l'utilisateur (fiche 122). */
  refused: number
  cancelled: number
  /** Somme des coûts connus, s'ils sont tous dans la même unité. */
  cost?: { amount: number; currency: string }
}

export function subagentsState(items: readonly ToolItem[]): SubagentsState {
  const waiting = (i: ToolItem) => i.permission?.state === 'pending'
  const count = (test: (i: ToolItem) => boolean) => items.filter(test).length
  const costs = items.flatMap((i) => (i.subagentRun?.cost ? [i.subagentRun.cost] : []))
  const currency = costs[0]?.currency
  const cost =
    currency !== undefined && costs.every((c) => c.currency === currency)
      ? {
          amount: Math.round(costs.reduce((n, c) => n + c.amount, 0) * 1e6) / 1e6,
          currency
        }
      : undefined
  return {
    running: count((i) => !waiting(i) && (i.status === 'pending' || i.status === 'in_progress')),
    waiting: count(waiting),
    done: count((i) => !waiting(i) && i.status === 'completed'),
    failed: count((i) => !waiting(i) && i.status === 'failed'),
    refused: count((i) => !waiting(i) && i.status === 'refused'),
    cancelled: count((i) => !waiting(i) && i.status === 'cancelled'),
    ...(cost ? { cost } : {})
  }
}

/** Genres d'outils ACP qui ont leur nom dans le résumé (clé `toolGroup.summary.kind.<genre>`). */
const KINDS = [
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'switch_mode',
  'other'
] as const
const kindOf = (key: string): (typeof KINDS)[number] =>
  KINDS.find((kind) => kind === key) ?? 'other'

/** Résumé d'un groupe : « 5 actions dans le navigateur », « 3 lectures et 2 recherches ». */
export function toolGroupSummary(items: readonly ToolItem[]): string {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = item.appTool ? `app:${item.appTool.group}` : (item.toolKind ?? 'other')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const parts = [...counts].map(([key, n]) =>
    key.startsWith('app:')
      ? t(`toolGroup.summary.app.${key.slice(4) as AppToolGroup}`, { count: n })
      : t(`toolGroup.summary.kind.${kindOf(key)}`, { count: n })
  )
  // « a, b et c » en français, « a, b, and c » en anglais.
  return new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(parts)
}

/** État d'un groupe : en cours (et quel outil), échecs, refus (fiche 122), annulations. */
export function toolGroupState(items: readonly ToolItem[]): {
  running?: ToolItem
  failed: number
  refused: number
  cancelled: number
} {
  const running = items.findLast((i) => i.status === 'pending' || i.status === 'in_progress')
  return {
    ...(running ? { running } : {}),
    failed: items.filter((i) => i.status === 'failed').length,
    refused: items.filter((i) => i.status === 'refused').length,
    cancelled: items.filter((i) => i.status === 'cancelled').length
  }
}
