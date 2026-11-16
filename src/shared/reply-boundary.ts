import type { TranscriptItem } from './transcript'

/** Élément de texte du fil, que prolonge un morceau. */
type TextItem = Extract<TranscriptItem, { kind: 'agent' | 'thought' | 'user' }>

/**
 * Un morceau de texte de l'agent (`agent`, `thought`) ou de l'utilisateur rejoué (`user`) prolonge-t-il
 * le dernier élément du fil ? Oui s'il est du même genre, sauf une réponse datée par sa fin de tour :
 * elle est close, et l'agent qui reparle ensuite de lui-même, hors tour (OpenCode 2.3.0, au rapport
 * d'un sous-agent, fiche 231), commence un autre message — comme OpenCode le rejoue.
 */
export function continuesText(last: TranscriptItem, kind: TextItem['kind']): last is TextItem {
  if (last.kind !== kind) return false
  return !(last.kind === 'agent' && last.at !== undefined)
}
