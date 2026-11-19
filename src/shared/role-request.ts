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

/** Ce qui arrive à un travail après sa demande, dans l'ordre du fil. */
export type WorkStep = { kind: 'ask'; item: RoleRequestItem } | { kind: 'report'; item: Report }

/** La carte-réponse d'un travail, sous la bulle qui l'a demandé. */
export interface WorkCardData {
  childId: string
  role: RoleBadge
  /** La bulle qui a lancé ce travail. */
  request: RoleRequestItem
  /** Son lancement (branche, non commité laissé) ; absent d'un fil abîmé. */
  started?: Started
  /**
   * Ancre de la carte pour le repère du bas du fil (fiche 261, `data-work-anchor`) : l'id de son
   * lancement, unique par travail, à défaut celui de la bulle.
   */
  anchor: number
  /** Réponses et bulles de suite, dans l'ordre du fil. */
  steps: WorkStep[]
}

export interface WorkCards {
  /** Cartes de chaque bulle d'ouverture, par id de l'élément de la bulle. */
  byRequest: ReadonlyMap<number, WorkCardData[]>
  /** Éléments rendus dans une carte : cachés à leur place dans le fil. */
  hidden: ReadonlySet<number>
  /** Travaux d'une bulle : ni ligne dans « Sous-tâches », ni compte rendu séparé. */
  childIds: ReadonlySet<string>
}

const NO_CARDS: WorkCards = { byRequest: new Map(), hidden: new Set(), childIds: new Set() }

/**
 * Range le fil en cartes-réponses. Un lancement qui nomme une bulle absente du fil (fil abîmé)
 * reste affiché comme avant ; les anciennes conversations, sans bulle, aussi.
 */
export function workCards(items: readonly TranscriptItem[]): WorkCards {
  const openings = new Map<string, RoleRequestItem>()
  for (const item of items) {
    if (item.kind === 'role-request' && !item.followUp) openings.set(item.requestId, item)
  }
  if (openings.size === 0) return NO_CARDS
  const starts = new Map<string, Started>()
  for (const item of items) {
    if (item.kind !== 'child-started' || !item.request) continue
    const opening = openings.get(item.request)
    if (opening?.works.some((w) => w.childId === item.childId)) starts.set(item.childId, item)
  }
  const cards = new Map<string, WorkCardData>()
  const byRequest = new Map<number, WorkCardData[]>()
  for (const request of openings.values()) {
    const list = request.works.flatMap((work) => {
      // Un même travail dans deux bulles (fil abîmé) : la première seulement.
      if (cards.has(work.childId)) return []
      const started = starts.get(work.childId)
      const card: WorkCardData = {
        childId: work.childId,
        role: work.role,
        request,
        ...(started ? { started } : {}),
        anchor: started?.id ?? request.id,
        steps: []
      }
      cards.set(work.childId, card)
      return [card]
    })
    byRequest.set(request.id, list)
  }
  const hidden = new Set<number>()
  for (const item of items) {
    const card = workOf(item, cards)
    if (!card) continue
    hidden.add(item.id)
    if (item.kind === 'child-report') card.steps.push({ kind: 'report', item })
    else if (item.kind === 'role-request') card.steps.push({ kind: 'ask', item })
  }
  return { byRequest, hidden, childIds: new Set(cards.keys()) }
}

/** La carte qui rend cet élément ; `undefined` s'il s'affiche à sa place. */
function workOf(
  item: TranscriptItem,
  cards: ReadonlyMap<string, WorkCardData>
): WorkCardData | undefined {
  if (item.kind === 'child-started') {
    const card = cards.get(item.childId)
    return card?.started?.id === item.id ? card : undefined
  }
  if (item.kind === 'child-report') return cards.get(item.childId)
  if (item.kind === 'role-request' && item.followUp) {
    const work = item.works[0]
    return item.works.length === 1 && work ? cards.get(work.childId) : undefined
  }
  return undefined
}
