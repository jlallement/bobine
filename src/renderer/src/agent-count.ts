import type { TranscriptItem } from '@shared/transcript'

/**
 * Nombre de réponses de l'agent dans un fil, compté par morceaux (fiche 185, P8) : pendant une
 * réponse, le fil change à chaque morceau sans s'allonger ; seul ce qui s'est ajouté depuis le
 * dernier compte est parcouru. Le fil a changé autrement (autre conversation, fil réécrit) : on
 * recompte tout.
 */
interface Counted {
  conversation: string | null
  length: number
  lastId: number | undefined
  count: number
}

let counted: Counted = { conversation: null, length: 0, lastId: undefined, count: 0 }

const agents = (items: readonly TranscriptItem[]) =>
  items.reduce((n, item) => n + (item.kind === 'agent' ? 1 : 0), 0)

export function agentReplies(
  conversation: string | null,
  items: readonly TranscriptItem[]
): number {
  const grew =
    counted.conversation === conversation &&
    items.length >= counted.length &&
    (counted.length === 0 || items[counted.length - 1]?.id === counted.lastId)
  const count = grew ? counted.count + agents(items.slice(counted.length)) : agents(items)
  counted = { conversation, length: items.length, lastId: items.at(-1)?.id, count }
  return count
}
