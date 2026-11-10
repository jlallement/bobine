/**
 * Recherche dans la conversation ouverte (fiche 086) : comparaison sans casse ni accents
 * (« erreur » trouve « Erreur », « ÉCRAN » trouve « écran »), positions rendues dans le texte
 * d'origine pour le surligner.
 */

export interface FoldedText {
  source: string
  /** Texte en minuscules, sans accents. */
  text: string
  /** Position dans le texte d'origine de chaque caractère de `text`. */
  origin: number[]
}

/** Replie un texte, caractère par caractère, en gardant d'où vient chacun. */
export function foldText(source: string): FoldedText {
  let text = ''
  const origin: number[] = []
  for (let i = 0; i < source.length; i++) {
    const folded = source.charAt(i).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (const char of folded) {
      text += char
      origin.push(i)
    }
  }
  return { source, text, origin }
}

const MARK = /\p{M}/u

/** Recherche repliée ; blancs de bord retirés (une recherche vide ne trouve rien). */
export const foldQuery = (query: string): string => foldText(query.trim()).text

/** Résultats de `query` dans `source`, en positions [début, fin) du texte d'origine. */
export function findMatches(source: string | FoldedText, query: string): [number, number][] {
  const needle = foldQuery(query)
  if (!needle) return []
  const folded = typeof source === 'string' ? foldText(source) : source
  const matches: [number, number][] = []
  for (
    let at = folded.text.indexOf(needle);
    at !== -1;
    at = folded.text.indexOf(needle, at + needle.length)
  ) {
    const start = folded.origin[at] ?? 0
    let end = (folded.origin[at + needle.length - 1] ?? start) + 1
    // Accents écrits à part (« e » puis l'accent seul) : surlignés avec leur lettre.
    while (end < folded.source.length && MARK.test(folded.source.charAt(end))) end++
    matches.push([start, end])
  }
  return matches
}
