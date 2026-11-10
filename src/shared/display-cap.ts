/**
 * Plafonds d'affichage des gros contenus du fil (fiche 192, maquette validée par l'expert UX) :
 * seul ce qui est rendu est plafonné, le fil garde tout.
 *
 * - Sortie d'outil : les dernières lignes (la fin d'une commande est ce qui compte), au plus
 *   `OUTPUT_LINES` lignes et `OUTPUT_CHARS` caractères (une ligne géante, JSON minifié, passerait
 *   sinon le plafond en lignes).
 * - Diff : `DIFF_ROWS` lignes au total ; diff simplifié (ancien puis nouveau en bloc) : `DIFF_BLOCK`
 *   lignes retirées puis `DIFF_BLOCK` ajoutées, pour voir les deux côtés.
 * - « Afficher tout » rend la suite par paquets de `REVEAL_STEP` lignes, un par image ; au-delà de
 *   `HARD_LINES` lignes ou `HARD_BYTES` octets, il laisse la place à « Ouvrir dans l'éditeur ».
 */
import type { DiffRow } from './diff'

export const OUTPUT_LINES = 500
export const OUTPUT_CHARS = 200 * 1024
export const DIFF_ROWS = 400
export const DIFF_BLOCK = 200
export const REVEAL_STEP = 2000
export const HARD_LINES = 50_000
export const HARD_BYTES = 5 * 1024 * 1024

/**
 * Lignes d'un texte : `\n` sépare (`\r\n` aussi, le `\r` reste avec sa ligne) ; une fin de ligne
 * finale n'en ouvre pas une de plus ; un `\r` seul (ancien Mac, barre de progression) ne coupe pas.
 */
export function lineCount(text: string): number {
  return text ? newlines(text) + (text.endsWith('\n') ? 0 : 1) : 0
}

function newlines(text: string): number {
  let count = 0
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) count++
  return count
}

/** Octets UTF-8 d'un texte, sans le réencoder. */
export function utf8Length(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/** Compte d'un texte (fins de ligne, octets), mis à jour à peu de frais quand il s'allonge. */
export interface TextCounts {
  text: string
  newlines: number
  bytes: number
}

/**
 * Comptes de `text` ; `previous` : ceux d'un texte dont il est la suite (sortie qui arrive par
 * morceaux) — seul l'ajout est compté.
 */
export function textCounts(text: string, previous?: TextCounts): TextCounts {
  if (previous && text.length >= previous.text.length && text.startsWith(previous.text)) {
    const added = text.slice(previous.text.length)
    // Une paire de substitution coupée entre deux morceaux : recomptée en entier.
    const split = /[\ud800-\udbff]$/.test(previous.text)
    if (!split) {
      return {
        text,
        newlines: previous.newlines + newlines(added),
        bytes: previous.bytes + utf8Length(added)
      }
    }
  }
  return { text, newlines: newlines(text), bytes: utf8Length(text) }
}

/**
 * Début de la `n`-ième ligne avant `end` (position juste après un `\n`, ou 0). `\r\n` compte pour
 * une fin de ligne : le `\r` reste avec sa ligne.
 */
export function startOfLinesBefore(text: string, end: number, n: number): number {
  // Une fin de ligne juste avant `end` termine la dernière ligne, elle n'en compte pas une.
  let i = text[end - 1] === '\n' ? end - 2 : end - 1
  let found = 0
  for (; i >= 0; i--) {
    if (text[i] === '\n' && ++found === n) return i + 1
  }
  return 0
}

/** Séquence d'échappement commencée avant `at` et finie après : on coupe après elle. */
const ESCAPE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*(?:\x07|\x1b\\)/y

/**
 * Coupure sûre en `at` : jamais au milieu d'une paire de substitution (emoji) ni d'une séquence
 * d'échappement ANSI ; repoussée juste après, s'il le faut.
 */
export function safeCut(text: string, at: number): number {
  let cut = at
  const code = text.charCodeAt(cut)
  if (cut > 0 && code >= 0xdc00 && code <= 0xdfff) cut++
  const from = text.lastIndexOf('\x1b', cut - 1)
  if (from !== -1 && cut - from < 4096) {
    ESCAPE.lastIndex = from
    const match = ESCAPE.exec(text)
    if (match && from + match[0].length > cut) cut = from + match[0].length
  }
  return Math.min(cut, text.length)
}

export interface OutputCap {
  /** Début de ce qui est montré (0 : tout). */
  start: number
  /** Lignes au total, et masquées au début. */
  totalLines: number
  hiddenLines: number
  /** Octets du texte entier (UTF-8). */
  bytes: number
  /** Coupé par le plafond en caractères, au milieu d'une ligne peut-être : « Début masqué ». */
  byChars: boolean
  /** Trop gros pour « Afficher tout » : « Ouvrir dans l'éditeur ». */
  tooBig: boolean
}

export function outputCap(
  text: string,
  limits: { lines: number; chars: number } = { lines: OUTPUT_LINES, chars: OUTPUT_CHARS },
  counts: TextCounts = textCounts(text)
): OutputCap {
  const totalLines = text ? counts.newlines + (text.endsWith('\n') ? 0 : 1) : 0
  const byLines = startOfLinesBefore(text, text.length, limits.lines)
  const byChars = Math.max(0, text.length - limits.chars)
  const start = byLines >= byChars ? byLines : safeCut(text, byChars)
  return {
    start,
    totalLines,
    // Une ligne coupée par le plafond en caractères compte parmi les masquées.
    hiddenLines: start > 0 ? lineCount(text.slice(0, start)) : 0,
    bytes: counts.bytes,
    byChars: byChars > byLines,
    tooBig: totalLines > HARD_LINES || counts.bytes > HARD_BYTES
  }
}

/**
 * Tranches d'un diff à plafonner : chacune rend au plus `limit` lignes (les plages repliées ne
 * comptent pas), puis une rangée « ⋯ N lignes de plus ». `kind` dit ce qui est masqué.
 */
export interface DiffSegment {
  rows: DiffRow[]
  limit: number
  kind: 'lines' | 'removed' | 'added'
}

export function diffSegments(rows: readonly DiffRow[], simplified: boolean): DiffSegment[] {
  if (!simplified) return [{ rows: [...rows], limit: DIFF_ROWS, kind: 'lines' }]
  // Simplifié : contexte, bloc retiré, bloc ajouté, contexte. Chaque bloc a son plafond.
  const segments: DiffSegment[] = []
  for (const row of rows) {
    const kind = row.type === 'del' ? 'removed' : row.type === 'add' ? 'added' : 'lines'
    const last = segments.at(-1)
    if (last && last.kind === kind) last.rows.push(row)
    else segments.push({ rows: [row], limit: kind === 'lines' ? DIFF_ROWS : DIFF_BLOCK, kind })
  }
  return segments
}

/** Lignes (hors plages repliées) d'une tranche. */
export const linesOf = (rows: readonly DiffRow[]) => rows.filter((r) => r.type !== 'skip').length

/** Rangées à rendre pour en montrer `lines` lignes (les plages repliées suivent sans compter). */
export function rowsForLines(rows: readonly DiffRow[], lines: number): number {
  let seen = 0
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.type !== 'skip' && ++seen > lines) return i
  }
  return rows.length
}
