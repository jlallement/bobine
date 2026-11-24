/**
 * Cartes de groupe (fiche 264, règle 3 de la fiche 260, ADR-0061) : où le fil montre chaque travail
 * confié. Pur : lu du fil, sans nouvel état.
 *
 * - Les propositions d'un tour (`start_child`) forment une carte de groupe à la place de la
 *   première ; chaque travail lancé depuis une ligne (`ChildStart.card` = `ChildProposal.key`) y
 *   est rangé, jamais ailleurs.
 * - Une bulle « @Rôle … » à plusieurs rôles : la bulle, puis la même carte de groupe, sans l'étape
 *   « proposés » (décision 5 de la fiche 260) ; à un seul rôle, sa carte-réponse (fiche 263).
 * - Un lancement avec une clé de carte qu'aucune proposition ne porte (« Lancer en parallèle… ») :
 *   une carte seule, à la place de ce lancement.
 * - Un lancement sans clé ni bulle (anciennes conversations) : affiché comme avant (« Sous-tâches »,
 *   lancement, compte rendu).
 * - La relecture d'un travail qui a sa carte (« Faire relire », fiche 265) : sa bulle et la carte du
 *   Code reviewer s'affichent dans la carte de ce travail (ou sous sa ligne d'une carte de groupe),
 *   pas à leur place.
 * - Les participants d'un tour de table (fiche 285, ADR-0072) : rangés dans la carte du tour, ancrée
 *   sur son élément `roundtable`, une ligne par participant ; jamais en cartes seules, ni dans
 *   « Sous-tâches ». Leur carte est retrouvée par leur conversation (`seat.childId`), pas par la clé
 *   de carte du lancement (tous les participants d'un tour partagent la même).
 */
import {
  childProposalGroups,
  childRecommendations,
  type ChildProposalItem,
  type ChildVerdict
} from './children'
import { lastChildrenMerge, type ChildrenMerge } from './children-merge'
import { workCards, type RoleRequestItem, type WorkCardData, type WorkCards } from './role-request'
import type { RoundtableItem, RoundtableLetter } from './roundtable'
import type { TranscriptItem } from './transcript'

/** Une ligne d'une carte de groupe : une proposition, son travail une fois lancé, ou les deux. */
export interface WorkGroupRow {
  /** Clé stable de la ligne : la proposition (élicitation), sinon le travail. */
  key: string
  proposal?: ChildProposalItem
  work?: WorkCardData
}

export interface WorkGroupData {
  /** Id de l'élément du fil où la carte s'affiche (première proposition, ou bulle). */
  at: number
  rows: WorkGroupRow[]
  /** Bulle à plusieurs rôles qui a lancé ces travaux ; absente : des propositions. */
  request?: RoleRequestItem
}

/** Carte d'un tour de table (fiche 285) : l'élément du tour, et le travail de chaque participant. */
export interface RoundtableGroupData {
  item: RoundtableItem
  /** Travail de chaque participant lancé, par sa lettre (lancement, réponses). */
  works: ReadonlyMap<RoundtableLetter, WorkCardData>
}

/** Une relecture rangée sous le travail qu'elle relit (fiche 265) : la bulle et sa carte. */
export interface WorkReviewEntry {
  request: RoleRequestItem
  card: WorkCardData
}

export interface WorkLayout {
  cards: WorkCards
  /** Cartes de groupe, par id de l'élément du fil où elles s'affichent. */
  groups: ReadonlyMap<number, WorkGroupData>
  /** Cartes seules, par id du lancement à la place duquel elles s'affichent. */
  solos: ReadonlyMap<number, WorkCardData>
  /** Éléments rendus ailleurs (dans une carte) : cachés à leur place. */
  hidden: ReadonlySet<number>
  /** Appels `start_child` d'une proposition : cachés derrière la carte de groupe. */
  toolCallIds: ReadonlySet<string>
  /** Travaux rangés dans une carte : ni ligne dans « Sous-tâches », ni compte rendu séparé. */
  childIds: ReadonlySet<string>
  /** Recommandation de fusion de l'agent pour chaque travail (fiche 160), lue une fois. */
  verdicts: ReadonlyMap<string, ChildVerdict>
  /** Dernière fusion qui touche chaque travail, lue une fois. */
  merges: ReadonlyMap<string, ChildrenMerge>
  /** Relectures de chaque travail rangé (fiche 265), dans l'ordre du fil. */
  reviews: ReadonlyMap<string, WorkReviewEntry[]>
  /** Cartes des tours de table (fiche 285), par id de leur élément `roundtable`. */
  roundtables: ReadonlyMap<number, RoundtableGroupData>
}

/** Clé d'une proposition, telle que le main l'a donnée (absente d'une proposition d'avant). */
const keyOf = (proposal: ChildProposalItem): string | undefined => {
  const key = proposal.prompt.child.key
  return typeof key === 'string' && key ? key : undefined
}

export function workLayout(items: readonly TranscriptItem[]): WorkLayout {
  const seats = roundtableSeats(items)
  const cards = workCards(seats.size ? withSeatCards(items, seats) : items)
  const proposed = childProposalGroups(items)
  const hidden = new Set<number>([...cards.hidden, ...proposed.hidden])
  const groups = new Map<number, WorkGroupData>()
  const grouped = new Set<string>()
  // Une clé en double (fil abîmé) : une seule ligne porte le travail.
  const used = new Set<string>()
  for (const [at, proposals] of proposed.groups) {
    const rows = proposals.map((proposal): WorkGroupRow => {
      const key = keyOf(proposal)
      const work = key && !used.has(key) ? cards.byCard.get(key) : undefined
      if (key) used.add(key)
      if (work) grouped.add(work.childId)
      return { key: proposal.requestId, proposal, ...(work ? { work } : {}) }
    })
    groups.set(at, { at, rows: inLaunchOrder(rows) })
  }
  for (const [at, list] of cards.byRequest) {
    if (list.length < 2) continue
    const request = items.find(
      (i): i is RoleRequestItem => i.id === at && i.kind === 'role-request'
    )
    groups.set(at, {
      at,
      rows: list.map((work) => ({ key: work.childId, work })),
      ...(request ? { request } : {})
    })
  }
  const roundtables = roundtableGroups(items, seats, cards, hidden)
  // Participants d'un tour : dans sa carte, ou nulle part (jamais une carte seule).
  for (const [key, work] of cards.byCard)
    if (key.startsWith('roundtable:')) grouped.add(work.childId)
  // Lancement avec une clé qu'aucune ligne ne porte : sa carte seule, à sa place.
  const solos = new Map<number, WorkCardData>()
  for (const work of cards.byCard.values()) {
    if (grouped.has(work.childId) || !work.started) continue
    solos.set(work.started.id, work)
    hidden.delete(work.started.id)
  }
  return {
    cards,
    groups,
    solos,
    hidden,
    toolCallIds: proposed.toolCallIds,
    childIds: seats.size ? new Set([...cards.childIds, ...seats.keys()]) : cards.childIds,
    verdicts: childRecommendations(items),
    merges: mergesByWork(items),
    reviews: reviewsByWork(items, cards, hidden),
    roundtables
  }
}

/** Participant d'un tour : le tour et sa lettre, par conversation du participant. */
type SeatRef = { roundtableId: string; letter: RoundtableLetter }

/**
 * Conversations des participants de tous les tours du fil (`participantIds`, avec la lettre), et
 * tout lancement dont la clé de carte est l'identifiant d'un tour (participant dont la place n'a
 * pas encore, ou plus, sa conversation) : jamais une carte seule ni une ligne de « Sous-tâches ».
 */
function roundtableSeats(items: readonly TranscriptItem[]): Map<string, SeatRef | undefined> {
  const seats = new Map<string, SeatRef | undefined>()
  const tours = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'roundtable') continue
    tours.add(item.roundtableId)
    for (const seat of item.seats)
      if (seat.childId && !seats.has(seat.childId))
        seats.set(seat.childId, { roundtableId: item.roundtableId, letter: seat.letter })
  }
  for (const item of items)
    if (
      item.kind === 'child-started' &&
      item.card &&
      tours.has(item.card) &&
      !seats.has(item.childId)
    )
      seats.set(item.childId, undefined)
  return seats
}

/** Clé de carte propre à un participant (tous ceux d'un tour partagent la clé du lancement). */
const seatCardKey = (seat: SeatRef | undefined, childId: string) =>
  `roundtable:${seat?.roundtableId ?? ''}:${seat?.letter ?? ''}:${childId}`

/**
 * Le fil, avec une clé de carte propre à chaque lancement de participant : `workCards` range ainsi
 * chacun dans sa carte (réponses, réplique), sans bulle ni proposition.
 */
function withSeatCards(
  items: readonly TranscriptItem[],
  seats: ReadonlyMap<string, SeatRef | undefined>
): TranscriptItem[] {
  return items.map((item) => {
    if (item.kind !== 'child-started' || !seats.has(item.childId)) return item
    const seat = seats.get(item.childId)
    const { request: _request, ...started } = item
    return { ...started, card: seatCardKey(seat, item.childId) }
  })
}

/**
 * Cartes des tours de table, ancrées sur leur élément. Un participant sans lancement dans le fil
 * (fil abîmé) : ses comptes rendus sont cachés quand même, sa ligne se lit de l'élément.
 */
function roundtableGroups(
  items: readonly TranscriptItem[],
  seats: ReadonlyMap<string, SeatRef | undefined>,
  cards: WorkCards,
  hidden: Set<number>
): Map<number, RoundtableGroupData> {
  const groups = new Map<number, RoundtableGroupData>()
  if (seats.size === 0) return groups
  for (const item of items) {
    if (item.kind === 'child-report' && seats.has(item.childId)) hidden.add(item.id)
    if (item.kind !== 'roundtable') continue
    const works = new Map<RoundtableLetter, WorkCardData>()
    for (const seat of item.seats) {
      const ref = seat.childId ? seats.get(seat.childId) : undefined
      if (!seat.childId || ref?.roundtableId !== item.roundtableId) continue
      const work = cards.byCard.get(seatCardKey(ref, seat.childId))
      if (work) works.set(seat.letter, work)
    }
    groups.set(item.id, { item, works })
  }
  return groups
}

/**
 * Relectures rangées sous leur travail (fiche 265) : une bulle « @Code reviewer … » qui relit un
 * travail qui a sa carte (`RoleRequest.review.of`), cachée à sa place. Un travail relu sans carte
 * (conversation d'avant, la conversation affichée elle-même) : la bulle reste à sa place.
 */
function reviewsByWork(
  items: readonly TranscriptItem[],
  cards: WorkCards,
  hidden: Set<number>
): Map<string, WorkReviewEntry[]> {
  const reviews = new Map<string, WorkReviewEntry[]>()
  for (const [at, list] of cards.byRequest) {
    const card = list[0]
    if (!card?.request || list.length !== 1) continue
    const of = card.reviewOf
    if (!of || of === card.childId || !cards.childIds.has(of)) continue
    reviews.set(of, [...(reviews.get(of) ?? []), { request: card.request, card }])
    hidden.add(at)
  }
  return reviews
}

/** Dernière fusion de chaque travail, dans l'ordre du fil. */
function mergesByWork(items: readonly TranscriptItem[]): Map<string, ChildrenMerge> {
  const merges = new Map<string, ChildrenMerge>()
  for (const item of items) {
    if (item.kind !== 'children-merge') continue
    const { kind: _kind, id: _id, ...merge } = item
    for (const row of item.rows) merges.set(row.childId, merge)
  }
  return merges
}

/**
 * Les travaux lancés dans l'ordre de leur lancement (revue UX : celui de la barre latérale et de la
 * fusion), à la place des lignes lancées ; les lignes non lancées gardent la leur.
 */
function inLaunchOrder(rows: WorkGroupRow[]): WorkGroupRow[] {
  const launched = rows
    .filter((r) => r.work?.started)
    .sort((a, b) => (a.work?.started?.id ?? 0) - (b.work?.started?.id ?? 0))
  let next = 0
  return rows.map((row) => (row.work?.started ? (launched[next++] ?? row) : row))
}

/** Travaux d'une carte de groupe (lancés). */
export const groupWorkIds = (group: WorkGroupData): string[] =>
  group.rows.flatMap((row) => (row.work ? [row.work.childId] : []))

/**
 * Dernière fusion qui touche ces travaux (fiche 264) : chaque carte montre la sienne, pas celle
 * d'une autre carte. `ids` absent : la dernière du fil (anciennes conversations, fiche 120).
 */
export function lastMergeFor(
  items: readonly TranscriptItem[],
  ids?: readonly string[]
): ChildrenMerge | undefined {
  if (!ids) return lastChildrenMerge(items)
  const wanted = new Set(ids)
  const item = items.findLast(
    (i) => i.kind === 'children-merge' && i.rows.some((r) => wanted.has(r.childId))
  )
  if (item?.kind !== 'children-merge') return undefined
  const { kind: _kind, id: _id, ...merge } = item
  return merge
}
