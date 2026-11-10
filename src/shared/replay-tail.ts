/**
 * Réconciliation d'un fil gardé avec le rejeu de l'agent (fiche 103, ADR-0021) : le fil enregistré
 * par Bobine fait foi, mais si la session a continué ailleurs pendant que la conversation dormait
 * (`bob chat`, Bob IDE, `opencode`), le rejeu a des tours que le fil n'a pas. On les reconnaît au
 * nombre de messages de l'utilisateur : tout ce qui suit, dans le rejeu, le dernier message
 * utilisateur connu du fil est à ajouter à la fin ; après une bascule vers un autre agent (fiche
 * 108), seuls comptent les messages de la session en cours. Pur : testable sans agent.
 */
import type { TranscriptItem, TranscriptState } from './transcript'

const isUser = (item: TranscriptItem): boolean => item.kind === 'user'

/**
 * Éléments du rejeu à ajouter au fil : ceux qui suivent le dernier message utilisateur que le fil
 * connaît déjà. Vide si le rejeu n'a pas plus de messages utilisateur que le fil (cas normal).
 * Les identifiants des éléments rendus sont ceux du rejeu : à renuméroter à l'ajout.
 */
export function replayTail(
  stored: readonly TranscriptItem[],
  replayed: readonly TranscriptItem[]
): TranscriptItem[] {
  // Les messages d'avant la dernière bascule vers un autre agent (fiche 108) appartiennent à une
  // autre session : seuls ceux d'après comptent.
  const at = stored.findLastIndex((item) => item.kind === 'handover')
  const marker = stored[at]
  // Message d'avant la bascule renvoyé à la session neuve (D10) : elle le connaît, sans copie.
  const carried = marker?.kind === 'handover' ? (marker.resent ?? 0) : 0
  const before = stored.slice(0, Math.max(at, 0)).findLast(isUser)
  const known = [
    ...(before ? Array.from({ length: carried }, () => before) : []),
    ...stored.slice(at + 1).filter(isUser)
  ]
  let seen = 0
  // Message renvoyé après un refus de connexion (D10, `resent`) : l'agent a pu le garder une fois
  // ou deux selon qu'il enregistre un message refusé (non documenté). Ses répétitions immédiates,
  // même texte, ne comptent pas pour un tour venu d'ailleurs.
  let spare = 0
  let previous: string | undefined
  for (let index = 0; index < replayed.length; index++) {
    const item = replayed[index] as TranscriptItem
    if (item.kind !== 'user') continue
    if (spare > 0 && item.text === previous) {
      spare -= 1
      continue
    }
    seen += 1
    if (seen > known.length) return replayed.slice(index)
    const match = known[seen - 1]
    spare = match?.kind === 'user' ? (match.resent ?? 0) : 0
    previous = item.text
  }
  return []
}

/**
 * Le dernier message de l'utilisateur renvoyé après un refus de connexion (D10). Même session :
 * marqué (`resent`), l'agent a pu le garder deux fois. Session neuve (ADR-0030) : compté sur le
 * repère de la bascule, puisque c'est elle qui l'a reçu ; l'utilisateur ne le voit qu'une fois.
 */
export function markResent(state: TranscriptState, fresh: boolean): TranscriptState {
  const index = fresh
    ? state.items.findLastIndex((item) => item.kind === 'handover')
    : state.items.findLastIndex(isUser)
  const item = state.items[index]
  if (item?.kind !== 'user' && item?.kind !== 'handover') return state
  const items = [...state.items]
  items[index] = { ...item, resent: (item.resent ?? 0) + 1 }
  return { ...state, items }
}
