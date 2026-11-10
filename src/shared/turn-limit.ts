/**
 * Limite d'étapes de l'agent (fiche 209) : un tour fini en `max_turn_requests` pose une carte dans
 * le fil, à la place d'une simple ligne. Deux cas, vus par le main, jamais déduits de l'agent :
 *
 * - l'agent a travaillé puis s'est arrêté : « Continuer » (message fixe de l'app) ;
 * - l'agent a refusé le message sans rien faire (aucune mise à jour pendant le tour) : sa limite
 *   vaut pour toute la session (Bob 2.0.9). « Rouvrir la session et continuer » (agent relancé,
 *   même session rechargée, même message renvoyé) quand l'agent sait recharger une session et que
 *   ce n'est pas déjà ce qui vient d'échouer ; « Nouvelle session avec le résumé » (ADR-0030).
 *
 * Fonctions pures, pour le main, le renderer et les essais.
 */
import type { AgentEvent } from './agent'
import type { TranscriptItem, TranscriptState } from './transcript'

/** Réponse à la carte. */
export type TurnLimitAnswer = 'continue' | 'reopen' | 'renew'

/** Ce que le main a vu d'un tour fini en `max_turn_requests`. */
export interface TurnLimitSeen {
  /** Aucune activité de l'agent pendant le tour : il a refusé le message sans rien faire. */
  refused: boolean
  /** « Rouvrir la session et continuer » est proposé (refus seulement). */
  reopen: boolean
}

/** Carte du fil : ce qui a été vu, puis la réponse (ou une carte, un message plus récents). */
export type TurnLimitCard = TurnLimitSeen & {
  answer?: TurnLimitAnswer
  /** Un message ou une carte plus récents ont pris la relève : plus de boutons. */
  superseded?: true
}

/** Carte posée à la fin d'un tour arrêté par la limite ; sans constat du main : travail arrêté. */
export function turnLimitCard(seen: TurnLimitSeen | undefined): TurnLimitCard {
  return { refused: seen?.refused === true, reopen: seen?.refused === true && seen.reopen }
}

/** Réponses que la carte propose. */
export function turnLimitAnswers(card: TurnLimitSeen): TurnLimitAnswer[] {
  if (!card.refused) return ['continue']
  return card.reopen ? ['reopen', 'renew'] : ['renew']
}

/** La carte attend encore une réponse. */
export function turnLimitOpen(item: TranscriptItem): boolean {
  return item.kind === 'turn-limit' && !item.answer && !item.superseded
}

/** Les cartes restées sans réponse perdent leurs boutons (nouveau message, nouvelle carte). */
export function supersedeTurnLimits(state: TranscriptState): TranscriptState {
  if (!state.items.some(turnLimitOpen)) return state
  const items = state.items.map((item) =>
    turnLimitOpen(item) ? { ...item, superseded: true as const } : item
  )
  return { ...state, items }
}

/** Réponse donnée : la carte la garde (et n'a plus de boutons). */
export function reduceTurnLimitAnswer(
  state: TranscriptState,
  event: Extract<AgentEvent, { type: 'turn-limit-answer' }>
): TranscriptState {
  const index = state.items.findIndex((item) => item.id === event.itemId)
  const item = state.items[index]
  if (!item || item.kind !== 'turn-limit' || !turnLimitOpen(item)) return state
  const items = state.items.slice()
  items[index] = { ...item, answer: event.answer }
  return { ...state, items }
}

/** Réponse lue d'un appel IPC. */
export function parseTurnLimitAnswer(value: unknown): TurnLimitAnswer {
  if (value === 'continue' || value === 'reopen' || value === 'renew') return value
  throw new Error('Paramètre invalide : answer')
}
