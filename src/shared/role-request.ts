/**
 * Demande à un rôle depuis la saisie (fiche 263, règle 2 de la fiche 260, ADR-0060) : une bulle
 * « @Rôle … » dans le fil de la mère, et juste dessous une carte-réponse par travail, à cette place
 * pour toujours. Ce module est pur : le modèle de la bulle, son réducteur, et la lecture du fil qui
 * range sous chaque bulle les éléments d'un travail (lancement, réponses, bulles de suite).
 *
 * La bulle est un élément à part (`role-request`), jamais un message `user` : elle ne part pas à
 * l'agent de la mère, n'ouvre pas de tour (pied de la réponse, fiche 261 ; durée des tours), ne
 * compte ni pour le rejeu d'une session (`replayTail`) ni pour ce qui est déjà transmis
 * (`childNews`).
 */
import type { RoleBadge } from './roles'
import type { TranscriptItem, TranscriptState } from './transcript'

/** Un travail parti pour une demande : la conversation fille et son rôle. */
export interface RoleRequestWork {
  childId: string
  role: RoleBadge
  /**
   * Relecture (fiche 265) : ce travail est le Code reviewer qui relit cette conversation (`of`).
   * Un travail relu qui a sa carte montre sa relecture dans cette carte (ou sous sa ligne d'une
   * carte de groupe), pas à la place de la bulle.
   */
  review?: { of: string }
}

/** Demande de l'utilisateur à un ou plusieurs rôles, posée par le main dans le fil de la mère. */
export interface RoleRequest {
  /**
   * Identifiant de la demande : plusieurs rôles partent l'un après l'autre, et la même bulle est
   * complétée à chaque travail parti (évènement répété, élément remplacé).
   */
  requestId: string
  /** Texte demandé, sans les `@rôle`. */
  text: string
  /** Travaux partis, dans l'ordre du message ; un rôle refusé n'y est jamais. */
  works: RoleRequestWork[]
  /**
   * Suite d'un travail existant (« Répondre à … ») : la bulle s'affiche dans la carte de ce
   * travail (décision 2 de la fiche 260), pas à sa place.
   */
  followUp?: true
  at: number
}

export type RoleRequestItem = Extract<TranscriptItem, { kind: 'role-request' }>
type Started = Extract<TranscriptItem, { kind: 'child-started' }>
type Report = Extract<TranscriptItem, { kind: 'child-report' }>
type Instruction = Extract<TranscriptItem, { kind: 'child-instruction' }>
export type ReviewItem = Extract<TranscriptItem, { kind: 'review' }>

/** Bulle posée, ou complétée si elle existe déjà (même `requestId`) : elle garde sa place. */
export function reduceRoleRequest(state: TranscriptState, request: RoleRequest): TranscriptState {
  const index = state.items.findLastIndex(
    (i) => i.kind === 'role-request' && i.requestId === request.requestId
  )
  const current = state.items[index]
  if (!current) {
    const item: TranscriptItem = { kind: 'role-request', id: state.nextId, ...request }
    return { ...state, items: [...state.items, item], nextId: state.nextId + 1 }
  }
  const items = state.items.slice()
  items[index] = { ...request, kind: 'role-request', id: current.id }
  return { ...state, items }
}

/**
 * Ce qui arrive à un travail après sa demande, dans l'ordre du fil : réponses, bulles de suite
 * (« Répondre à … »), messages de l'agent de la conversation (`message_child`, fiche 264).
 */
export type WorkStep =
  | { kind: 'ask'; item: RoleRequestItem }
  | { kind: 'report'; item: Report }
  | { kind: 'note'; item: Instruction }

/**
 * La carte-réponse d'un travail : sous la bulle qui l'a demandé (fiche 263), ou sur sa ligne d'une
 * carte de groupe, ou seule à la place de son lancement (fiche 264).
 */
export interface WorkCardData {
  childId: string
  /** Son rôle ; absent : un autre agent, sans rôle (« Lancer en parallèle… », proposition). */
  role?: RoleBadge
  /** Titre du travail (celui de son lancement). */
  title: string
  /** La bulle qui a lancé ce travail ; absente d'un travail d'une carte. */
  request?: RoleRequestItem
  /** Son lancement (branche, non commité laissé) ; absent d'un fil abîmé. */
  started?: Started
  /**
   * Ancre de la carte pour le repère du bas du fil (fiche 261, `data-work-anchor`) : l'id de son
   * lancement, unique par travail ; sans lancement (fil abîmé), aucune.
   */
  anchor?: number
  /** Heure de la demande qui l'a lancé : la bulle, sinon son lancement. */
  askedAt: number
  /** Texte de la demande qui l'a lancé : celui de la bulle, sinon sa consigne. */
  asked: string
  /** Code reviewer (fiche 265) : la conversation qu'il relit, lue sur sa bulle. */
  reviewOf?: string
  /** Lancé par l'agent (`start_child`) : sa réponse lui part à son réveil. */
  byAgent?: true
  /** Clé de sa carte (`ChildStart.card`) ; absente d'un travail d'une bulle. */
  card?: string
  /** Réponses, bulles de suite et messages de l'agent, dans l'ordre du fil. */
  steps: WorkStep[]
  /**
   * Relecture (fiche 265) : la carte de ce relecteur (élément `review`, la dernière), ses remarques
   * structurées ; cachée à sa place, dite dans la carte.
   */
  review?: ReviewItem
}

export interface WorkCards {
  /** Cartes de chaque bulle d'ouverture, par id de l'élément de la bulle. */
  byRequest: ReadonlyMap<number, WorkCardData[]>
  /** Cartes des travaux lancés avec une clé de carte (fiche 264), par clé. */
  byCard: ReadonlyMap<string, WorkCardData>
  /** Éléments rendus dans une carte : cachés à leur place dans le fil. */
  hidden: ReadonlySet<number>
  /** Travaux rangés dans une carte : ni ligne dans « Sous-tâches », ni compte rendu séparé. */
  childIds: ReadonlySet<string>
}

const NO_CARDS: WorkCards = {
  byRequest: new Map(),
  byCard: new Map(),
  hidden: new Set(),
  childIds: new Set()
}

/** Travaux d'une bulle, même d'un fil abîmé (champ absent ou mal formé : aucun). */
const worksOf = (item: RoleRequestItem): RoleRequestWork[] =>
  Array.isArray(item.works) ? item.works.filter((w) => !!w?.childId && !!w.role) : []

/** Bulles d'ouverture du fil, par demande ; une bulle répétée (fil abîmé) est cachée. */
function openingsOf(items: readonly TranscriptItem[], hidden: Set<number>) {
  const openings = new Map<string, RoleRequestItem>()
  for (const item of items) {
    if (item.kind !== 'role-request' || item.followUp) continue
    if (openings.has(item.requestId)) hidden.add(item.id)
    else openings.set(item.requestId, item)
  }
  return openings
}

/**
 * Range le fil en cartes-réponses. Un lancement qui nomme une bulle absente du fil (fil abîmé)
 * reste affiché comme avant ; les anciennes conversations, sans bulle ni clé de carte, aussi. Une
 * bulle répétée (même `requestId`, fil abîmé) : la première seule, la suivante cachée.
 */
export function workCards(items: readonly TranscriptItem[]): WorkCards {
  const hidden = new Set<number>()
  const openings = openingsOf(items, hidden)
  const starts = new Map<string, Started>()
  const keyed: Started[] = []
  for (const item of items) {
    if (item.kind !== 'child-started' || starts.has(item.childId)) continue
    const opening = item.request ? openings.get(item.request) : undefined
    if (opening && worksOf(opening).some((w) => w.childId === item.childId)) {
      starts.set(item.childId, item)
    } else if (!item.request && typeof item.card === 'string' && item.card) {
      starts.set(item.childId, item)
      keyed.push(item)
    }
  }
  if (openings.size === 0 && keyed.length === 0) return NO_CARDS
  const cards = new Map<string, WorkCardData>()
  const byRequest = new Map<number, WorkCardData[]>()
  for (const request of openings.values()) {
    const list = worksOf(request).flatMap((work) => {
      // Un même travail dans deux bulles (fil abîmé) : la première seulement.
      if (cards.has(work.childId)) return []
      const started = starts.get(work.childId)
      const card: WorkCardData = {
        childId: work.childId,
        role: work.role,
        title: started?.title ?? work.role.label,
        request,
        ...(typeof work.review?.of === 'string' && work.review.of
          ? { reviewOf: work.review.of }
          : {}),
        // Ancre unique : le lancement de ce travail ; sans lancement, pas de repère.
        ...(started ? { started, anchor: started.id } : {}),
        askedAt: request.at,
        asked: request.text,
        steps: []
      }
      cards.set(work.childId, card)
      return [card]
    })
    byRequest.set(request.id, list)
  }
  const byCard = new Map<string, WorkCardData>()
  for (const started of keyed) {
    // Deux lancements avec la même clé (fil abîmé) : le premier seulement ; l'autre comme avant.
    if (!started.card || byCard.has(started.card) || cards.has(started.childId)) continue
    const card: WorkCardData = {
      childId: started.childId,
      ...(started.role ? { role: started.role } : {}),
      title: started.title,
      started,
      anchor: started.id,
      askedAt: started.at,
      asked: started.prompt,
      ...(started.by === 'agent' ? { byAgent: true as const } : {}),
      card: started.card,
      steps: []
    }
    cards.set(started.childId, card)
    byCard.set(started.card, card)
  }
  for (const item of items) {
    const card = workOf(item, cards)
    if (!card) continue
    hidden.add(item.id)
    if (item.kind === 'child-report') placeReport(card, item)
    else if (item.kind === 'role-request') card.steps.push({ kind: 'ask', item })
    else if (item.kind === 'child-instruction') card.steps.push({ kind: 'note', item })
    else if (item.kind === 'review') card.review = item
  }
  return { byRequest, byCard, hidden, childIds: new Set(cards.keys()) }
}

/**
 * Une réponse dans sa carte. Une suite envoyée pendant que le travail répondait encore ne reçoit
 * pas la réponse du tour déjà ouvert : une réponse dont le tour a commencé (`askedAt`) avant la
 * dernière suite se range avant elle.
 */
function placeReport(card: WorkCardData, item: Report): void {
  let at = card.steps.length
  while (at > 0) {
    const before = card.steps[at - 1]
    // Une suite ou un message de l'agent (fiche 264) ouvre un échange.
    if (!before || before.kind === 'report' || item.askedAt === undefined) break
    if (item.askedAt >= before.item.at) break
    at--
  }
  card.steps.splice(at, 0, { kind: 'report', item })
}

/**
 * La carte qui rend cet élément ; `undefined` s'il s'affiche à sa place. La recommandation de
 * fusion d'un travail rangé (fiche 264) n'est dite que par la pastille de sa carte : cachée.
 */
function workOf(
  item: TranscriptItem,
  cards: ReadonlyMap<string, WorkCardData>
): WorkCardData | undefined {
  if (item.kind === 'child-started') {
    const card = cards.get(item.childId)
    return card?.started?.id === item.id ? card : undefined
  }
  if (
    item.kind === 'child-report' ||
    item.kind === 'child-instruction' ||
    item.kind === 'child-recommendation'
  ) {
    return cards.get(item.childId)
  }
  // Remarques d'un relecteur qui a sa carte (fiche 265) : dans sa carte ; une relecture d'avant,
  // sans lancement, garde sa carte « Relecture » à sa place.
  if (item.kind === 'review') return cards.get(item.reviewId)
  if (item.kind === 'role-request' && item.followUp) {
    const works = worksOf(item)
    const work = works[0]
    return works.length === 1 && work ? cards.get(work.childId) : undefined
  }
  return undefined
}
