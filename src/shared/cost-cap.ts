/**
 * Plafond de coût d'une conversation (fiche 157, ADR-0035) : dans l'unité de l'agent — la devise du
 * coût qu'il annonce (bobcoins pour Bob, lus par son adaptateur ; dollars pour OpenCode), ou ses
 * jetons quand aucun coût n'est connu. Rien n'est estimé : la dépense est la consommation déjà
 * calculée (`ConversationUsage`, fiches 019, 109, 130).
 *
 * Le plafond propre à une conversation vit dans son fil (`TranscriptState.costCap`) ; sans lui,
 * celui des réglages. La décision est prise dans le main (`CostCapGuard`) ; ces fonctions sont
 * pures, pour le main, le renderer et les essais.
 */
import { t } from 'i18next'
import type { Preferences } from './preferences'
import { conversationCost, formatCost, formatTokens, type ConversationUsage } from './usage'
import type { AgentEvent, CostCapAnswer } from './agent'
import type { TranscriptItem, TranscriptState } from './transcript'

/** Unité d'un plafond en jetons (sinon : la devise du coût, telle que l'agent la donne). */
export const TOKEN_UNIT = 'tokens'

export interface CostCap {
  limit: number
  /** Devise du coût (`USD`, `bobcoins`…) ou `tokens`. */
  unit: string
}

/**
 * Plafond d'une conversation : le sien ; `settings`, celui des réglages (posé au premier message
 * quand le réglage est activé : il vaut pour les nouvelles conversations) ; `none`, aucun.
 * Absent (conversation d'avant, ou réglage désactivé à sa création) : aucun.
 */
export type ConversationCap = CostCap | 'none' | 'settings'

/** Ce que le plafond lit des réglages. */
export type CapPreferences = Pick<Preferences, 'costCapEnabled' | 'costCapAmount' | 'costCapTokens'>

/** Plafond atteint : posé dans le fil, avec la réponse de l'utilisateur une fois donnée. */
export interface CostCapReached {
  limit: number
  unit: string
  /** Dépense au moment où le plafond a été vu franchi. */
  spent: number
  /** Ce que « Continuer » ajoute au plafond. */
  step: number
  /** Le tour a été interrompu (sinon il était déjà fini). */
  interrupted: boolean
  /** Message de l'utilisateur retenu au plafond : envoyé par « Continuer », pas par « Arrêter ». */
  held?: string
}

/** Carte du fil : le plafond atteint, puis la réponse (ou une carte plus récente la remplace). */
export type CostCapCard = CostCapReached & {
  answer?: CostCapAnswer
  /** Plafond après « Continuer ». */
  raisedTo?: number
  /** Une carte plus récente a pris la relève : celle-ci n'a plus de boutons. */
  superseded?: true
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Montant d'un plafond dans son unité, pour l'affichage (« 5,00 $US », « 2 000 000 jetons »). */
export function formatCap(amount: number, unit: string): string {
  return unit === TOKEN_UNIT
    ? t('usage.tokensValue', { tokens: formatTokens(amount) })
    : formatCost({ amount, currency: unit })
}

/** Unité de la conversation : la devise de son coût, sinon les jetons ; rien tant qu'aucun n'est connu. */
export function capUnitOf(usage: ConversationUsage | undefined): string | undefined {
  // Devise de la session, sinon celle des précédentes (fiche 164).
  const cost = conversationCost(usage).total
  if (cost) return cost.currency
  if (usage?.tokens) return TOKEN_UNIT
  return undefined
}

/** Dépense de la conversation dans une unité ; `undefined` si l'agent ne la donne pas. */
export function spentIn(usage: ConversationUsage | undefined, unit: string): number | undefined {
  if (unit === TOKEN_UNIT) return usage?.tokens?.total
  // Toute la conversation, sessions précédentes comprises (fiche 164).
  const total = conversationCost(usage).total
  return total?.currency === unit ? total.amount : undefined
}

/** Pas du plafond des réglages dans une unité (montant, ou jetons). */
export function capStep(prefs: CapPreferences, unit: string): number {
  return unit === TOKEN_UNIT ? prefs.costCapTokens : prefs.costCapAmount
}

/**
 * Plafond en vigueur : celui de la conversation s'il est dans son unité, sinon les montants des
 * réglages ; aucun pour une conversation sans plafond (`none`, ou rien de posé).
 */
export function effectiveCap(
  own: ConversationCap | undefined,
  prefs: CapPreferences,
  usage: ConversationUsage | undefined
): CostCap | undefined {
  const unit = capUnitOf(usage)
  if (!own || own === 'none' || !unit) return undefined
  if (own !== 'settings' && own.unit === unit) return own
  return { limit: capStep(prefs, unit), unit }
}

/** Plafond relevé par « Continuer » : un pas de plus, au-delà de la dépense. */
export function nextCap(cap: CostCap, spent: number, step: number): CostCap {
  let limit = cap.limit + step
  while (step > 0 && limit <= spent) limit += step
  return { limit: round6(limit), unit: cap.unit }
}

/** Ce que l'élément du fil doit avoir pour la décision (évite de dépendre du fil entier). */
export interface CapItem {
  kind: string
  status?: string
  limit?: number
  unit?: string
  permission?: { state: unknown }
  subagentRun?: { background?: boolean }
}

/** Outil encore en cours dans le tour (après le dernier message), hors sous-agent en arrière-plan. */
export function toolRunning(items: readonly CapItem[]): boolean {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (!item || item.kind === 'user') return false
    if (
      item.kind === 'tool' &&
      (item.status === 'pending' || item.status === 'in_progress') &&
      item.permission?.state !== 'pending' &&
      !item.subagentRun?.background
    ) {
      return true
    }
  }
  return false
}

/** Une carte a déjà été posée pour ce plafond dans le tour en cours (après le dernier message). */
function askedFor(items: readonly CapItem[], cap: CostCap): boolean {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (!item || item.kind === 'user') return false
    if (item.kind === 'cost-cap' && item.limit === cap.limit && item.unit === cap.unit) return true
  }
  return false
}

/**
 * Plafond franchi pour l'envoi d'un message : le message attend l'accord de l'utilisateur
 * (« Continuer » relève le plafond). Rien quand aucun plafond ne s'applique, ou qu'il n'est pas
 * atteint.
 */
export function capReached(
  transcript: { usage?: ConversationUsage; costCap?: ConversationCap },
  prefs: CapPreferences
): { cap: CostCap; spent: number } | undefined {
  const cap = effectiveCap(transcript.costCap, prefs, transcript.usage)
  const spent = cap && spentIn(transcript.usage, cap.unit)
  return cap && spent !== undefined && spent >= cap.limit ? { cap, spent } : undefined
}

export type CapDecision =
  /** Rien à faire : pas de plafond, pas franchi, ou déjà demandé dans ce tour. */
  | { kind: 'none' }
  /** Franchi pendant un outil : attendre sa fin. */
  | { kind: 'wait' }
  /** Franchi pendant le tour, aucun outil en cours : interrompre, puis demander. */
  | { kind: 'interrupt'; cap: CostCap; spent: number }
  /** Franchi hors d'un tour (jetons du tour, coût relu après coup) : demander. */
  | { kind: 'ask'; cap: CostCap; spent: number }

/** Que faire, d'après le fil de la conversation et son état (tour en cours ou non). */
export function capDecision(
  transcript: {
    items: readonly CapItem[]
    usage?: ConversationUsage
    costCap?: ConversationCap
  },
  prefs: CapPreferences,
  busy: boolean
): CapDecision {
  const reached = capReached(transcript, prefs)
  if (!reached || askedFor(transcript.items, reached.cap)) return { kind: 'none' }
  const { cap, spent } = reached
  if (!busy) return { kind: 'ask', cap, spent }
  return toolRunning(transcript.items) ? { kind: 'wait' } : { kind: 'interrupt', cap, spent }
}

/** Plafond lu d'un appel IPC : un plafond positif, `none`, `settings`, ou `null` (aucun posé). */
export function parseConversationCap(value: unknown): ConversationCap | null {
  if (value === 'none' || value === 'settings') return value
  if (value === null) return null
  const cap = value as Partial<CostCap> | undefined
  if (
    typeof cap?.limit === 'number' &&
    Number.isFinite(cap.limit) &&
    cap.limit > 0 &&
    typeof cap.unit === 'string' &&
    /^[\w-]{1,32}$/.test(cap.unit)
  ) {
    return { limit: round6(cap.limit), unit: cap.unit }
  }
  throw new Error('Paramètre invalide : cap')
}

/** Réduction des évènements du plafond dans le fil (`reduceTranscript`). */
export function reduceCostCap(
  state: TranscriptState,
  event: Extract<AgentEvent, { type: `cost-cap-${string}` }>
): TranscriptState {
  switch (event.type) {
    case 'cost-cap-set': {
      const { costCap: _old, ...rest } = state
      return event.cap ? { ...rest, costCap: event.cap } : rest
    }
    case 'cost-cap-reached': {
      // Une seule carte à laquelle répondre : les précédentes restées sans réponse s'effacent.
      const items = state.items.map((item) =>
        item.kind === 'cost-cap' && !item.answer && !item.superseded
          ? { ...item, superseded: true as const }
          : item
      )
      const item: TranscriptItem = { kind: 'cost-cap', id: state.nextId, ...event.reached }
      return { ...state, items: [...items, item], nextId: state.nextId + 1 }
    }
    case 'cost-cap-answer': {
      const { answer, raisedTo } = event
      const items = state.items.map((item) =>
        item.id === event.itemId && item.kind === 'cost-cap' && !item.answer
          ? { ...item, answer, ...(raisedTo !== undefined ? { raisedTo } : {}) }
          : item
      )
      return { ...state, items }
    }
  }
}
