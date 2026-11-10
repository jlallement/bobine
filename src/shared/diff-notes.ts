/**
 * Remarques sur les modifications (fiche 085) : posées sur une ligne ou une plage de lignes d'un
 * diff de l'onglet « Modifications », puis envoyées à l'agent en un message. Comme les remarques
 * sur le plan (`planFeedback`, fiche 040), le message est en français : ce qui va à l'agent n'est
 * pas traduit (ADR-0014).
 */

export interface DiffNote {
  id: string
  /** Vue de l'onglet où la remarque a été posée. */
  view: 'conversation' | 'git'
  /** Fichier : clé de la ligne de l'onglet (chemin tel que la vue le connaît). */
  file: string
  /** Chemin affiché, relatif au dossier de la conversation : celui que lit l'agent. */
  path: string
  /** Vue « Conversation » : rang de la modification du fichier (0, 1…), le diff affiché. */
  change?: number
  /** Lignes du nouveau texte, ou de l'ancien pour des lignes supprimées. */
  side: 'new' | 'old'
  from: number
  to: number
  /** Le code commenté, tel qu'il était affiché. */
  code: string
  comment: string
  /** Remarque venue d'une relecture (fiche 177) : sa gravité et sa nature. */
  review?: {
    severity: import('./review').ReviewSeverity
    category: import('./review').ReviewCategory
  }
}

/** Même diff (vue, fichier, modification) : la remarque s'y affiche. */
export const sameDiff = (
  note: Pick<DiffNote, 'view' | 'file' | 'change'>,
  other: Pick<DiffNote, 'view' | 'file' | 'change'>
): boolean => note.view === other.view && note.file === other.file && note.change === other.change

/** « ligne 12 », « lignes 12 à 14 », et la mention des lignes supprimées. */
function where(note: DiffNote): string {
  const lines = note.from === note.to ? `ligne ${note.from}` : `lignes ${note.from} à ${note.to}`
  if (note.side === 'new') return lines
  return note.from === note.to ? `${lines} supprimée` : `${lines} supprimées`
}

/** Bloc de code qui ne se referme pas sur des accents graves du code lui-même. */
function fenced(code: string, indent: string): string {
  const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return [fence, ...code.split('\n'), fence].map((line) => `${indent}${line}`).join('\n')
}

/** Gravité d'une remarque de relecture, dite à l'agent (en français, comme le reste du message). */
const SEVERITY_WORDS = { high: 'haute', medium: 'moyenne', low: 'basse' } as const

/** Message envoyé à l'agent : chaque remarque avec son fichier, ses lignes et le code cité. */
export function diffFeedback(notes: readonly DiffNote[]): string {
  const items = notes.map((note, i) => {
    // Code introuvable (remarque de relecture sur un fichier illisible) : pas de bloc vide.
    const code = note.code.trim() ? `\n${fenced(note.code, '   ')}` : ''
    const lead = note.review
      ? `Remarque de la relecture (gravité ${SEVERITY_WORDS[note.review.severity]})`
      : 'Remarque'
    return `${i + 1}. ${note.path}, ${where(note)} :${code}\n   ${lead} : ${note.comment.trim()}`
  })
  return `Remarques sur les modifications :\n\n${items.join('\n\n')}\n\nTiens compte de ces remarques dans le code.`
}
