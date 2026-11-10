import { createContext } from 'react'
import type { CostCapAnswer } from '@shared/agent'
import type { TurnLimitAnswer } from '@shared/turn-limit'
import type { MemoryDecisionResult } from '@shared/memory'

/**
 * Ce que les cartes du fil peuvent faire du tour en cours (fiche 157), fourni par `App` autour du
 * fil : interrompre une commande sans sortie (comme ■), répondre à la carte du plafond. Sans
 * fournisseur (fils des sous-agents, essais), rien n'est proposé.
 */
export interface TurnControls {
  /** L'agent travaille : une commande en cours peut être signalée. */
  busy: boolean
  /** Arrête la réponse de l'agent (`session/cancel`), comme ■. */
  cancel: () => void
  /** Délai sans sortie avant de signaler une commande (ms). */
  stalledAfterMs: number
  /** Réponse à la carte « Plafond atteint ». */
  answerCostCap: (itemId: number, answer: CostCapAnswer) => void
  /** Réponse à la carte « limite d'étapes » (fiche 209). */
  answerTurnLimit: (itemId: number, answer: TurnLimitAnswer) => void
  /** Cartes « Retenir ce souvenir ? » (fiche 182). */
  memory?: MemoryControls
}

export interface MemoryControls {
  /** Réglage « Mémoire activée » : coupée, les boutons des cartes sont grisés. */
  enabled: boolean
  /** Décision sur une carte (`force` : remplacer une version changée depuis la proposition). */
  decide: (proposalId: string, accept: boolean, force: boolean) => Promise<MemoryDecisionResult>
  /** Ouvre Réglages › Mémoire, sur un souvenir s'il est nommé. */
  open: (name?: string) => void
}

export const TurnControlsContext = createContext<TurnControls | null>(null)
