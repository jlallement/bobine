/**
 * Recherche dans l'historique (fiches 026, 027) : titre, dossier, agent — et contenu des
 * conversations (cherché par le main). Sans casse ni accents, tous les mots.
 */
import type { ConversationSummary } from './agent'

/** Normalisation pour comparer sans casse ni accents. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Pliage d'un caractère, mémorisé : ce sont toujours les mêmes qui reviennent (fiche 046). */
const foldedUnits = new Map<string, string>()

function foldUnit(unit: string): string {
  let out = foldedUnits.get(unit)
  if (out === undefined) {
    const folded = fold(unit)
    out = folded.length === unit.length ? folded : unit.length === 1 ? (folded[0] ?? '\0') : unit
    if (foldedUnits.size >= 10_000) foldedUnits.clear()
    foldedUnits.set(unit, out)
  }
  return out
}

/**
 * Même normalisation, caractère par caractère, en gardant la longueur : une position dans le texte
 * plié est la même dans le texte d'origine (pour l'extrait et le surlignage). Les passages en ASCII
 * sont pliés d'un bloc (fiche 046 : un Mo de texte prenait ≈ 140 ms) ; seuls `^` et `` ` `` y sont
 * des diacritiques, remplacés comme les autres par `\0`.
 */
export function foldSameLength(text: string): string {
  let out = ''
  let start = 0
  while (start < text.length) {
    const ascii = text.charCodeAt(start) < 0x80
    let end = start + 1
    while (end < text.length && text.charCodeAt(end) < 0x80 === ascii) end++
    const run = text.slice(start, end)
    if (ascii) out += run.toLowerCase().replace(/[\^`]/g, '\0')
    else for (const unit of run) out += foldUnit(unit)
    start = end
  }
  return out
}

export const searchWords = (query: string) => fold(query).split(/\s+/).filter(Boolean)

/** Tous les mots (`searchWords`) dans ce texte, sans casse ni accents (réglages, fiche 051). */
export function hasAllWords(text: string, words: readonly string[]): boolean {
  const folded = fold(text)
  return words.every((w) => folded.includes(w))
}

/** Conversations dont le titre, le dossier ou l'agent contiennent tous les mots cherchés. */
export function searchConversations(
  conversations: readonly ConversationSummary[],
  query: string
): ConversationSummary[] {
  const words = searchWords(query)
  return conversations.filter((c) => {
    const text = fold(`${c.title} ${c.workspace} ${c.profileLabel}`)
    return words.every((w) => text.includes(w))
  })
}

/** Résultat d'une recherche dans le contenu. */
export interface ContentHit {
  id: string
  /** Extrait autour de la première occurrence ; `highlights` y repère les mots. */
  snippet: string
  highlights: [start: number, end: number][]
}

const SNIPPET = 140

/**
 * Tous les mots dans `haystack` (titre et contenu d'une conversation) ? Si oui, extrait du contenu
 * autour du premier mot trouvé, mots surlignés. `folded` : le contenu déjà plié (`foldSameLength`),
 * pour ne pas le replier à chaque recherche.
 */
export function matchContent(
  title: string,
  content: string,
  words: readonly string[],
  folded: string = foldSameLength(content)
): Omit<ContentHit, 'id'> | null {
  if (words.length === 0) return null
  const foldedTitle = fold(title)
  if (!words.every((w) => folded.includes(w) || foldedTitle.includes(w))) return null
  const first = Math.min(...words.map((w) => folded.indexOf(w)).filter((i) => i >= 0))
  if (!Number.isFinite(first)) return null // Tout est dans le titre.
  const start = Math.max(0, first - 40)
  const end = Math.min(content.length, start + SNIPPET)
  const raw = content.slice(start, end)
  // Espaces et sauts de ligne réduits, en gardant les positions pour le surlignage.
  const snippet = raw.replace(/\s/g, ' ')
  const lower = folded.slice(start, end)
  const highlights: [number, number][] = []
  for (const word of words) {
    let i = lower.indexOf(word)
    while (i >= 0) {
      highlights.push([i, i + word.length])
      i = lower.indexOf(word, i + word.length)
    }
  }
  highlights.sort((a, b) => a[0] - b[0])
  const prefix = start > 0 ? '…' : ''
  return {
    snippet: prefix + snippet + (end < content.length ? '…' : ''),
    highlights: highlights.map(([a, b]) => [a + prefix.length, b + prefix.length])
  }
}

/** Texte d'une réponse de l'agent sans la mise en forme Markdown (pour la recherche et ses extraits). */
export function plainText(markdown: string): string {
  return (
    markdown
      // Lignes de séparation des tableaux, marques de bloc de code (le code reste).
      .replace(/^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{0,}:?\s*\|?\s*$/gm, '')
      .replace(/^```[^\n]*$/gm, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__|`/g, '')
      .replace(/\s*\|\s*/g, ' ')
  )
}
