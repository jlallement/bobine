/**
 * Échanges ACP bruts d'une conversation (fiche 135) : chaque ligne JSON-RPC écrite vers l'agent ou
 * lue de lui, gardée en mémoire par le main et montrée dans l'onglet « Échanges ACP » du panneau.
 */

/** Messages gardés par conversation (les plus récents). */
export const ACP_EXCHANGES_MAX = 2000

export interface AcpExchange {
  /** Numéro croissant dans la conversation : fusion de l'instantané et des évènements. */
  seq: number
  /** Heure de passage dans Bobine (ms depuis l'époque). */
  at: number
  /** `out` : de l'app vers l'agent ; `in` : de l'agent vers l'app. */
  direction: 'out' | 'in'
  /** Ligne JSON telle qu'échangée, secrets masqués ; coupée si `truncated`. */
  text: string
  /** Taille de la ligne d'origine, en octets. */
  bytes: number
  /** Ligne trop longue : seul son début est gardé. */
  truncated?: boolean
}

export interface AcpExchangesSnapshot {
  messages: AcpExchange[]
}

/** Messages arrivés depuis le dernier lot, pour une conversation regardée. */
export interface AcpExchangesBatch {
  conversationId: string
  messages: AcpExchange[]
}
