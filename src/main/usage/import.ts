/**
 * Reprise de la consommation d'avant le journal (fiche 137) : une seule fois, au premier lancement
 * qui a le tableau, les tours sont relus dans les fils des conversations (ADR-0021) et ajoutés au
 * journal sans doublon (identifiant `<conversation>:<début du tour>`, celui de la fiche 130).
 *
 * Ce qu'un fil dit d'un tour : le message de l'utilisateur (heure, modèle, mode), les réponses et
 * les outils jusqu'au message suivant, et, pour les 100 derniers tours au plus (fiche 109), ses
 * jetons et son coût cumulé (`TurnUsage`, daté de sa fin). Sont laissés de côté :
 * - les comptes rendus des filles (`child-report`) : ils recopient la consommation de la fille,
 *   qui a son propre fil ;
 * - ce qui précède une branche (élément `branch`) : c'est la conversation d'origine, déjà comptée,
 *   et la branche n'en recopie pas la consommation ;
 * - un message sans heure (fil rejoué par l'agent) : aucun identifiant stable.
 * Avant une bascule vers un autre agent (`handover`, ADR-0024), le tour est à l'agent d'avant ; la
 * consommation du fil, remise à zéro par la bascule, ne vaut que pour les tours d'après.
 */
import type { TranscriptItem, TranscriptState } from '@shared/transcript'
import { turnCost, type TurnUsage } from '@shared/usage'
import type { TurnRow, UsageDb } from './usage-db'

/** Drapeau de `meta` posé une fois la reprise faite. */
export const IMPORTED_KEY = 'imported_at'

/** Ce que l'index des conversations dit d'une conversation. */
export interface ImportRecord {
  id: string
  profileId: string
  workspace: string
  worktree?: { root: string; path: string }
  startedFrom?: { id: string }
}

export interface ImportContext {
  /** Libellé d'un profil d'agent. */
  profileLabel: (profileId: string) => string | undefined
  /** Racine du dépôt d'un dossier (`repo-root.ts`). */
  repoRoot?: (folder: string) => string | undefined
}

type Handover = Extract<TranscriptItem, { kind: 'handover' }>

/** Index du premier élément propre à ce fil : après la dernière marque de branche. */
function ownStart(items: readonly TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (items[i]?.kind === 'branch') return i + 1
  return 0
}

/** Jetons d'un `TurnUsage`, ceux qu'il a seulement. */
function tokensOf(turn: TurnUsage | undefined): TurnRow['tokens'] {
  if (!turn) return {}
  const entries = (['input', 'output', 'cachedRead', 'cachedWrite', 'thought', 'total'] as const)
    .map((key) => [key, turn[key]] as const)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
  return Object.fromEntries(entries)
}

/** Tours d'un fil, prêts pour le journal (pur). */
export function turnsFromTranscript(
  record: ImportRecord,
  transcript: TranscriptState,
  context: ImportContext
): TurnRow[] {
  const items = transcript.items.slice(ownStart(transcript.items))
  const lastHandover = items.findLastIndex((item) => item.kind === 'handover')
  const usageTurns = (transcript.usage?.turns ?? []).filter((t) => typeof t.at === 'number')
  const currency = transcript.usage?.cost?.currency
  const workspace = record.worktree?.path ?? record.workspace
  const repoRoot = record.worktree?.root ?? (workspace ? context.repoRoot?.(workspace) : undefined)
  const users = items.flatMap((item, index) =>
    item.kind === 'user' && typeof item.at === 'number' ? [{ item, index }] : []
  )
  return users.map(({ item, index }, n): TurnRow => {
    const end = users[n + 1]?.index ?? items.length
    const next = users[n + 1]?.item.at ?? Number.POSITIVE_INFINITY
    const segment = items.slice(index + 1, end)
    const startedAt = item.at as number
    // L'agent du tour : celui d'avant la première bascule qui suit, sinon celui de la conversation.
    const handover = items.slice(index + 1).find((i): i is Handover => i.kind === 'handover')
    const profileId = handover?.from.profileId ?? record.profileId
    const profileLabel = handover?.from.label ?? context.profileLabel(record.profileId)
    // Consommation du fil : seulement pour les tours d'après la dernière bascule.
    const usage =
      index > lastHandover
        ? usageTurns.find((t) => (t.at as number) >= startedAt && (t.at as number) < next)
        : undefined
    const answered = segment.flatMap((i) => (i.kind === 'agent' && i.at ? [i.at] : []))
    const endedAt = usage?.at ?? answered.at(-1)
    const cost = usage ? turnCost(usage) : undefined
    const tools: Record<string, number> = {}
    for (const i of segment) {
      if (i.kind === 'tool') tools[i.toolKind ?? 'other'] = (tools[i.toolKind ?? 'other'] ?? 0) + 1
    }
    return {
      id: `${record.id}:${startedAt}`,
      conversationId: record.id,
      ...(record.startedFrom ? { parentId: record.startedFrom.id } : {}),
      startedAt,
      ...(endedAt !== undefined && endedAt >= startedAt ? { endedAt } : {}),
      profileId,
      ...(profileLabel ? { profileLabel } : {}),
      ...(item.model ? { model: { id: item.model.id, name: item.model.name } } : {}),
      ...(item.mode ? { mode: { id: item.mode.id, name: item.mode.name } } : {}),
      ...(workspace ? { workspace } : {}),
      ...(repoRoot ? { repoRoot } : {}),
      tokens: tokensOf(usage),
      ...(cost !== undefined && currency ? { cost: { amount: cost, currency } } : {}),
      tools,
      subagents: 0
    }
  })
}

export interface ImportSource {
  records: readonly ImportRecord[]
  /** Fil d'une conversation lu sur le disque ; `undefined` s'il est absent ou illisible. */
  read: (id: string) => Promise<TranscriptState | undefined>
}

/**
 * Reprise, une seule fois : rien si le drapeau est posé ; sinon chaque fil est relu et ses tours
 * absents du journal y sont ajoutés. Rend le nombre de tours ajoutés (`undefined` : déjà faite).
 */
export async function importHistoryOnce(
  db: Pick<UsageDb, 'meta' | 'setMeta' | 'insertMissing'>,
  source: ImportSource,
  context: ImportContext,
  now: () => number = Date.now
): Promise<number | undefined> {
  if (db.meta(IMPORTED_KEY) !== undefined) return undefined
  let added = 0
  for (const record of source.records) {
    const transcript = await source.read(record.id)
    if (transcript) added += db.insertMissing(turnsFromTranscript(record, transcript, context))
  }
  db.setMeta(IMPORTED_KEY, new Date(now()).toISOString())
  return added
}
