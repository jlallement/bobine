/**
 * Recherche dans l'aide (fiche 186) : faite maison, hors ligne, sans dépendance. Quelques
 * centaines de sections : un parcours linéaire suffit. Mots sans accents ni casse ; chaque mot
 * cherché doit se trouver (début de mot) dans le titre ou le texte de la section.
 */
import type { GuideSection } from './guide'

/** Nombre de résultats montrés. */
export const MAX_RESULTS = 20
/** Caractères gardés de part et d'autre du premier mot trouvé, dans l'extrait. */
const SNIPPET_CONTEXT = 40

/** Texte comparable : minuscules, sans accents (même longueur que l'original, lettre à lettre). */
export const fold = (text: string): string =>
  [...text]
    .map((c) => {
      const folded = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      // Même longueur que la lettre d'origine, sinon les positions des extraits glisseraient.
      return folded.length === c.length ? folded : c
    })
    .join('')

/** Mots d'une recherche (au moins un caractère utile), repliés. */
export const queryTerms = (query: string): string[] =>
  [...new Set(fold(query).split(/[^\p{L}\p{N}._-]+/u))].filter((w) => w.length > 0)

export interface Segment {
  text: string
  /** Mot cherché, à souligner. */
  match: boolean
}

export interface SearchResult {
  section: GuideSection
  /** Titre de la page (la section en fait partie). */
  pageTitle: string
  /** Extrait du texte autour du premier mot trouvé, découpé pour souligner les mots. */
  snippet: Segment[]
}

/** Positions `[début, fin[` des mots trouvés (début de mot) dans un texte replié. */
function matchRanges(folded: string, terms: readonly string[]): [number, number][] {
  const ranges: [number, number][] = []
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = folded.indexOf(term, from)
      if (at < 0) break
      if (at === 0 || !/[\p{L}\p{N}]/u.test(folded[at - 1] ?? '')) {
        ranges.push([at, at + term.length])
      }
      from = at + 1
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged.at(-1)
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  return merged
}

/** Texte découpé en morceaux, mots trouvés marqués. */
export function highlight(text: string, terms: readonly string[]): Segment[] {
  const segments: Segment[] = []
  let at = 0
  for (const [start, end] of matchRanges(fold(text), terms)) {
    if (start > at) segments.push({ text: text.slice(at, start), match: false })
    segments.push({ text: text.slice(start, end), match: true })
    at = end
  }
  if (at < text.length) segments.push({ text: text.slice(at), match: false })
  return segments
}

/** Extrait d'un texte autour du premier mot trouvé, sur une ligne. */
export function snippet(text: string, terms: readonly string[]): Segment[] {
  const flat = text.replace(/\s+/g, ' ')
  const first = matchRanges(fold(flat), terms)[0]
  const center = first ? first[0] : 0
  const start = Math.max(0, center - SNIPPET_CONTEXT)
  const end = Math.min(flat.length, center + SNIPPET_CONTEXT * 2)
  let cut = flat.slice(start, end)
  // Extrait coupé sur des mots entiers, jamais au milieu d'un mot.
  if (start > 0) cut = cut.replace(/^\S*\s/, '')
  if (end < flat.length) cut = cut.replace(/\s\S*$/, '')
  return highlight(`${start > 0 ? '… ' : ''}${cut}${end < flat.length ? ' …' : ''}`, terms)
}

const hasWord = (folded: string, term: string) => matchRanges(folded, [term]).length > 0

/** Sections qui contiennent tous les mots, les titres d'abord. */
export function searchGuide(
  sections: readonly GuideSection[],
  titles: Record<string, string>,
  query: string
): SearchResult[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []
  const scored: { result: SearchResult; score: number; order: number }[] = []
  sections.forEach((section, order) => {
    // Repliés une fois par `parseGuide` ; à défaut (essais), ici.
    const title = section.folded?.title ?? fold(section.title)
    const page = section.folded?.page ?? fold(titles[section.page] ?? '')
    const text = section.folded?.text ?? fold(section.text)
    let score = 0
    for (const term of terms) {
      const inPage = hasWord(page, term)
      // Une section de la page qui porte le mot passe devant une mention ailleurs.
      if (hasWord(title, term)) score += 10 + (inPage ? 3 : 0)
      else if (inPage) score += 3
      else if (hasWord(text, term)) score += 1
      else return
    }
    scored.push({
      result: {
        section,
        pageTitle: titles[section.page] ?? section.page,
        snippet: snippet(section.text || section.title, terms)
      },
      score,
      order
    })
  })
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, MAX_RESULTS)
    .map((s) => s.result)
}
