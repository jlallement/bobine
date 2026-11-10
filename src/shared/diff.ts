/**
 * Diff ligne à ligne pour l'affichage : lignes numérotées, regroupées avec un contexte limité,
 * les longues plages inchangées étant repliées.
 *
 * Le calcul est borné (fiche 192) : un diff d'agent peut porter sur un fichier de dizaines de
 * milliers de lignes (`package-lock.json` réécrit), et l'algorithme de Myers, sans borne, fige le
 * renderer des secondes, voire des minutes. Les lignes communes du début et de la fin sont
 * écartées d'abord ; au-delà d'un nombre de modifications proportionné à la taille du reste
 * (`maxEditLength`, borne déterministe : le même diff donne le même résultat sur toute machine),
 * le milieu est montré comme retiré puis ajouté en bloc (`simplified`). Ce diff reste exact : ses
 * lignes retirées sont l'ancien texte, ses lignes ajoutées le nouveau, rien n'est perdu.
 * `DIFF_TIMEOUT_MS` n'est qu'un dernier recours (machine à genoux) : un résultat obtenu par lui
 * (`timedOut`) dépend de la charge, il n'est jamais gardé en cache pour les totaux.
 */
import { diffArrays } from 'diff'

export type DiffLine =
  | { type: 'add'; text: string; newNo: number }
  | { type: 'del'; text: string; oldNo: number }
  | { type: 'ctx'; text: string; oldNo: number; newNo: number }

export type DiffRow = DiffLine | { type: 'skip'; count: number }

export interface DiffResult {
  rows: DiffRow[]
  added: number
  removed: number
  /** Trop de modifications pour un calcul ligne à ligne : le milieu est remplacé en bloc. */
  simplified: boolean
  /** Simplifié par le délai de dernier recours, pas par la borne : dépend de la charge. */
  timedOut: boolean
}

/** Modifications au plus pour un calcul ligne à ligne (fichiers jusqu'à ~30 000 lignes). */
export const MAX_EDIT_LENGTH = 1000
/** Au moins, même pour un très gros fichier. */
const MIN_EDIT_LENGTH = 200
/**
 * Travail admis (lignes × modifications) : l'algorithme de Myers coûte environ ce produit ; borné,
 * le pire cas reste sous ~100 ms sur un Mac récent (mesuré : 35 ms pour 2 × 30 000 lignes toutes
 * différentes).
 */
const EDIT_BUDGET = 60_000_000
/** Dernier recours en temps, si la machine est à genoux. */
const DIFF_TIMEOUT_MS = 2000

/** Modifications admises pour un milieu de `lines` lignes (les deux côtés). */
export const maxEditLengthFor = (lines: number) =>
  Math.max(MIN_EDIT_LENGTH, Math.min(MAX_EDIT_LENGTH, Math.floor(EDIT_BUDGET / Math.max(1, lines))))

/** Lignes avec leur fin de ligne : `b` et `b\n` (dernière ligne) restent différentes, comme avant. */
function tokens(value: string): string[] {
  return value.match(/[^\n]*\n|[^\n]+$/g) ?? []
}

const strip = (token: string) => (token.endsWith('\n') ? token.slice(0, -1) : token)

type Run = { kind: 'ctx' | 'add' | 'del'; lines: string[] }

/** Suites de lignes communes, retirées, ajoutées ; `simplified` si le calcul a été abandonné. */
export function lineRuns(
  oldText: string | null | undefined,
  newText: string
): { runs: Run[]; simplified: boolean; timedOut: boolean } {
  const a = tokens(oldText ?? '')
  const b = tokens(newText)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const runs: Run[] = []
  if (start > 0) runs.push({ kind: 'ctx', lines: a.slice(0, start) })
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  let simplified = false
  let timedOut = false
  if (midA.length > 0 && midB.length > 0) {
    const started = Date.now()
    const changes = diffArrays(midA, midB, {
      maxEditLength: maxEditLengthFor(midA.length + midB.length),
      timeout: DIFF_TIMEOUT_MS
    })
    timedOut = !changes && Date.now() - started >= DIFF_TIMEOUT_MS
    if (changes) {
      for (const change of changes) {
        runs.push({
          kind: change.added ? 'add' : change.removed ? 'del' : 'ctx',
          lines: change.value
        })
      }
    } else {
      simplified = true
      runs.push({ kind: 'del', lines: midA }, { kind: 'add', lines: midB })
    }
  } else {
    if (midA.length > 0) runs.push({ kind: 'del', lines: midA })
    if (midB.length > 0) runs.push({ kind: 'add', lines: midB })
  }
  if (endA < a.length) runs.push({ kind: 'ctx', lines: a.slice(endA) })
  return { runs, simplified, timedOut }
}

/**
 * Lignes ajoutées et retirées seulement (récapitulatif des modifications) ; `exact` faux si le
 * délai de dernier recours a tranché (à ne pas garder en cache).
 */
export function diffStats(
  oldText: string | null | undefined,
  newText: string
): { added: number; removed: number; exact: boolean } {
  let added = 0
  let removed = 0
  const { runs, timedOut } = lineRuns(oldText, newText)
  for (const run of runs) {
    if (run.kind === 'add') added += run.lines.length
    else if (run.kind === 'del') removed += run.lines.length
  }
  return { added, removed, exact: !timedOut }
}

/** `oldText` absent = nouveau fichier : tout est en ajout. */
export function computeDiff(
  oldText: string | null | undefined,
  newText: string,
  context = 3
): DiffResult {
  const lines: DiffLine[] = []
  let oldNo = 1
  let newNo = 1
  const { runs, simplified, timedOut } = lineRuns(oldText, newText)
  for (const run of runs) {
    for (const token of run.lines) {
      const text = strip(token)
      if (run.kind === 'add') lines.push({ type: 'add', text, newNo: newNo++ })
      else if (run.kind === 'del') lines.push({ type: 'del', text, oldNo: oldNo++ })
      else lines.push({ type: 'ctx', text, oldNo: oldNo++, newNo: newNo++ })
    }
  }

  // On garde chaque ligne modifiée et `context` lignes autour ; le reste est replié.
  const keep = new Array<boolean>(lines.length).fill(false)
  lines.forEach((line, i) => {
    if (line.type === 'ctx') return
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
      keep[j] = true
    }
  })

  const rows: DiffRow[] = []
  let skipped = 0
  lines.forEach((line, i) => {
    if (keep[i]) {
      if (skipped) rows.push({ type: 'skip', count: skipped })
      skipped = 0
      rows.push(line)
    } else {
      skipped++
    }
  })
  if (skipped && rows.length) rows.push({ type: 'skip', count: skipped })

  return {
    rows,
    added: lines.filter((l) => l.type === 'add').length,
    removed: lines.filter((l) => l.type === 'del').length,
    simplified,
    timedOut
  }
}

/**
 * Ligne du nouveau texte où commence la première modification (fiche 156 : « Ouvrir dans
 * l'éditeur » sur un diff) : la première ligne ajoutée, ou celle qui suit une suppression.
 */
export function firstChangedLine(rows: DiffRow[]): number | undefined {
  let lastNew = 0
  for (const row of rows) {
    if (row.type === 'add') return row.newNo
    if (row.type === 'del') return lastNew + 1
    if (row.type === 'ctx') lastNew = row.newNo
  }
  return undefined
}

/**
 * Diff entier en texte (« Copier tout », « Ouvrir dans l'éditeur » d'un diff trop gros, fiche
 * 192) : en-têtes `---`/`+++`, puis chaque ligne précédée de ` `, `-` ou `+`, sans rien replier.
 */
export function diffText(
  path: string,
  oldText: string | null | undefined,
  newText: string
): string {
  const sign = { ctx: ' ', del: '-', add: '+' } as const
  const out = [`--- ${oldText == null ? '/dev/null' : `a/${path}`}`, `+++ b/${path}`]
  for (const run of lineRuns(oldText, newText).runs) {
    for (const token of run.lines) out.push(sign[run.kind] + strip(token))
  }
  return `${out.join('\n')}\n`
}
