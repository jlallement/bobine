import { createContext } from 'react'
import type { AlwaysScope } from '@shared/agent'

/**
 * L'agent de la conversation, pour les cartes d'autorisation (fiche 214) : son nom et ce que couvre
 * son « Toujours », déclaré par son profil. Absent ou sans `alwaysScope` : l'agent décide, la carte
 * ne dit rien de plus.
 */
export interface AgentCardInfo {
  name?: string | undefined
  alwaysScope?: AlwaysScope | undefined
}

export const AgentCardContext = createContext<AgentCardInfo | undefined>(undefined)
