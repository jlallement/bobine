/**
 * Remarques sur un fichier ouvert (fiche 271, Q56) : une remarque garde le code qu'elle cite. Le
 * fichier relu a changé ? Elle reste sous ses lignes si ce code y est encore, sinon elle suit ce
 * code s'il est retrouvé tel quel ailleurs, sinon elle passe en fin de fichier (« le code a
 * changé »). Le message à l'agent cite toujours le code du moment de la remarque.
 */
import type { DiffNote } from '@shared/diff-notes'

export interface PlacedNote {
  note: DiffNote
  /** Lignes où la montrer ; absentes : en fin de fichier. */
  from?: number
  to?: number
  /** Son code a été retrouvé ailleurs (le fichier a changé). */
  moved?: boolean
}

const codeAt = (lines: readonly string[], from: number, to: number) =>
  lines.slice(from - 1, to).join('\n')

/** Où montrer chaque remarque dans `lines` (texte actuel du fichier, une entrée par ligne). */
export function placeNotes(notes: readonly DiffNote[], lines: readonly string[]): PlacedNote[] {
  return notes.map((note) => {
    const span = note.to - note.from
    if (note.to <= lines.length && codeAt(lines, note.from, note.to) === note.code) {
      return { note, from: note.from, to: note.to }
    }
    // Code retrouvé ailleurs : la plus proche de l'ancienne place.
    let best: number | undefined
    for (let start = 1; start + span <= lines.length; start++) {
      if (lines[start - 1] !== note.code.split('\n')[0]) continue
      if (codeAt(lines, start, start + span) !== note.code) continue
      if (best === undefined || Math.abs(start - note.from) < Math.abs(best - note.from)) {
        best = start
      }
    }
    return best === undefined ? { note } : { note, from: best, to: best + span, moved: true }
  })
}

/**
 * Clé d'un fichier ouvert pour ses remarques (`DiffNote.file`) : le chemin de sa racine, pas son
 * rang (M2) ; une racine retirée ou ajoutée avant ne fait pas passer une remarque sur un autre
 * fichier.
 */
export const fileNoteKey = (rootPath: string, path: string) => `${rootPath}::${path}`
