/**
 * Récapitulatif des modifications (fiche 021).
 *
 * - Vue « Conversation » : les diffs ACP des appels d'outil terminés, regroupés par fichier.
 * - Vue « Git » : l'état réel du dossier par rapport au dernier commit (calculé par le main).
 */
import { withSubagentWork, type TranscriptItem } from './transcript'
import { diffStats } from './diff'

/** Un diff à afficher : `oldText` nul = fichier créé. */
export interface TextChange {
  oldText: string | null
  newText: string
}

export interface ConversationFileChange {
  /** Chemin tel que l'agent l'a donné (absolu en général). */
  path: string
  /**
   * Modifications successives fusionnées quand elles s'enchaînent (le nouveau texte de l'une est
   * l'ancien de la suivante) ; sinon une entrée par modification (extraits).
   */
  diffs: TextChange[]
  created: boolean
  added: number
  removed: number
}

/**
 * Totaux +/− déjà calculés, par ancien puis nouveau texte : le fil change à chaque morceau de texte
 * reçu, les diffs eux ne changent qu'à la fin d'un outil. Les moins récents sortent en premier
 * (fiche 192) : vider tout le cache au-delà de 300 entrées refaisait, à chaque morceau, tous les
 * diffs d'un fil de plus de 300 modifications. Les textes sont ceux du fil (rien n'est copié), mais
 * le cache les retient après la fermeture du fil : il est borné en entrées et en caractères.
 * Un total tranché par le délai de dernier recours (`exact` faux) n'y entre jamais : il dépend de
 * la charge, et le badge, l'onglet et le bilan doivent dire le même nombre.
 */
interface CachedStats {
  byNew: Map<string, { added: number; removed: number }>
  /** Caractères retenus : l'ancien texte et les nouveaux. */
  chars: number
}
const statsCache = new Map<string, CachedStats>()
const CACHE_ENTRIES = 2000
const CACHE_CHARS = 32 * 1024 * 1024
let cachedChars = 0

/** Vide le cache (tests). */
export function clearStatsCache(): void {
  statsCache.clear()
  cachedChars = 0
}

function statsOf(change: TextChange): { added: number; removed: number } {
  // Fichier créé : tout en ajout, compté sans calcul de diff (et sans cache qui grossirait).
  if (!change.oldText) return diffStats(change.oldText, change.newText)
  const key = change.oldText
  const entry = statsCache.get(key)
  const cached = entry?.byNew.get(change.newText)
  if (entry) {
    // Remis en dernier : le plus récemment servi sort le dernier.
    statsCache.delete(key)
    statsCache.set(key, entry)
  }
  if (cached) return cached
  const { added, removed, exact } = diffStats(change.oldText, change.newText)
  const stats = { added, removed }
  if (!exact) return stats
  const target = entry ?? { byNew: new Map(), chars: key.length }
  if (!entry) {
    statsCache.set(key, target)
    cachedChars += key.length
  }
  target.byNew.set(change.newText, stats)
  target.chars += change.newText.length
  cachedChars += change.newText.length
  while (statsCache.size > CACHE_ENTRIES || (cachedChars > CACHE_CHARS && statsCache.size > 1)) {
    const [oldest, dropped] = statsCache.entries().next().value ?? []
    if (oldest === undefined || !dropped) break
    statsCache.delete(oldest)
    cachedChars -= dropped.chars
  }
  return stats
}

/** Fichiers modifiés par l'agent dans la conversation, dans l'ordre de leur première modification. */
export function conversationChanges(items: readonly TranscriptItem[]): ConversationFileChange[] {
  const byPath = new Map<string, TextChange[]>()
  // Les modifications d'un sous-agent rangées sous sa carte comptent aussi (fiche 078).
  for (const item of withSubagentWork(items)) {
    // Seuls les outils aboutis ont modifié quelque chose (pas refusés, en attente ou annulés).
    if (item.kind !== 'tool' || item.status !== 'completed') continue
    for (const content of item.content) {
      if (content.type !== 'diff') continue
      const oldText = content.oldText ?? null
      if (oldText === content.newText) continue
      const diffs = byPath.get(content.path) ?? []
      byPath.set(content.path, diffs)
      const last = diffs.at(-1)
      if (last && oldText !== null && last.newText === oldText) last.newText = content.newText
      else diffs.push({ oldText, newText: content.newText })
    }
  }
  return [...byPath].map(([path, diffs]) => {
    let added = 0
    let removed = 0
    for (const change of diffs) {
      const stats = statsOf(change)
      added += stats.added
      removed += stats.removed
    }
    // Règle générique (fiche 140) : un ancien texte vide vaut un fichier créé, comme `null` (certains
    // agents envoient `oldText: ""` pour un fichier qu'ils créent).
    const first = diffs[0]?.oldText
    return { path, diffs, created: first === null || first === '', added, removed }
  })
}

/**
 * Résultat d'« Annuler cette modification » (fiche 043) : fichier remis en état, déjà dans son état
 * d'avant, modifié depuis par quelqu'un d'autre, hors du dossier, ou écriture impossible.
 */
export type RevertOutcome = 'restored' | 'unchanged' | 'conflict' | 'outside' | 'failed'

/** Totaux pour le raccourci de l'en-tête (« 3 fichiers +12 −4 »). */
export function changesSummary(files: readonly { added: number | null; removed: number | null }[]) {
  return {
    files: files.length,
    added: files.reduce((n, f) => n + (f.added ?? 0), 0),
    removed: files.reduce((n, f) => n + (f.removed ?? 0), 0)
  }
}

/* ----- Vue « Git » ----- */

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export interface GitFileChange {
  /** Chemin relatif au dossier de la conversation. */
  path: string
  status: GitFileStatus
  /** Ancien chemin (renommage). */
  from?: string
  /** Lignes ajoutées / retirées ; `null` pour un fichier binaire. */
  added: number | null
  removed: number | null
}

export interface GitChanges {
  /** Racine du dépôt. */
  root: string
  /** Branche courante (absente : HEAD détachée ou dépôt sans commit). */
  branch?: string
  files: GitFileChange[]
}

/** Contenus d'un fichier avant (dernier commit) et après (disque), pour le diff. */
export interface GitFileDiff {
  oldText: string | null
  newText: string | null
  binary?: boolean
  tooLarge?: boolean
}

/** Dossier et nom, pour l'affichage d'une ligne de la liste. */
export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf('/')
  return i < 0 ? { dir: '', name: path } : { dir: path.slice(0, i + 1), name: path.slice(i + 1) }
}

/** Chemin montré relatif au dossier de travail quand il y est. */
export function relativeTo(workspace: string | undefined, path: string): string {
  if (!workspace) return path
  const root = workspace.endsWith('/') ? workspace : `${workspace}/`
  return path.startsWith(root) ? path.slice(root.length) : path
}
