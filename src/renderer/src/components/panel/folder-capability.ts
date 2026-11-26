import { useState } from 'react'
import type { AgentStatus } from '@shared/agent'

/** Dernière capacité « autres dossiers » lue d'un agent prêt, pour une conversation. */
export interface SeenCapability {
  id: string
  on: boolean
}

/**
 * L'agent annonce-t-il `additionalDirectories` (fiche 290) ? Lu d'un agent prêt (ou qui répond) ;
 * pendant qu'il redémarre — après chaque ajout ou retrait, la session repart —, la capacité n'est
 * pas encore connue : on garde la dernière vue pour cette conversation, sinon la ligne passait à
 * « Non transmis » et le champ disparaissait le temps du redémarrage, avec la ligne « Ajouté ».
 */
export function folderCapability(
  seen: SeenCapability | null,
  id: string,
  announced: boolean,
  status: AgentStatus | undefined
): boolean {
  if (status === 'ready' || status === 'busy') return announced
  return seen?.id === id ? seen.on || announced : announced
}

/** `folderCapability` avec la mémoire de la dernière capacité vue. */
export function useFolderCapability(
  id: string,
  announced: boolean,
  status: AgentStatus | undefined
): boolean {
  const [seen, setSeen] = useState<SeenCapability | null>(null)
  // Retenue pendant le rendu (état dérivé, sans effet ni rendu en cascade).
  const settled = status === 'ready' || status === 'busy'
  if (settled && (seen?.id !== id || seen.on !== announced)) setSeen({ id, on: announced })
  return folderCapability(seen, id, announced, status)
}
