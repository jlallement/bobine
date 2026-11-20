/**
 * Rangement des travaux du fil (fiche 264, `workLayout`), calculé une fois par `Transcript` et lu
 * par les cartes : recommandations et dernière fusion de chaque travail, sans que chaque carte ne
 * relise le fil à chaque morceau de réponse (revue QA).
 */
import { createContext, useContext } from 'react'
import type { ChildVerdict } from '@shared/children'
import type { ChildrenMerge } from '@shared/children-merge'
import type { WorkLayout } from '@shared/work-groups'

export const WorkLayoutContext = createContext<WorkLayout | undefined>(undefined)

/** Recommandation et dernière fusion d'un travail, lues dans le rangement du fil. */
export function useWorkFacts(childId: string): {
  verdict: ChildVerdict | undefined
  merge: ChildrenMerge | undefined
} {
  const layout = useContext(WorkLayoutContext)
  return { verdict: layout?.verdicts.get(childId), merge: layout?.merges.get(childId) }
}
