/**
 * Filles directes d'une mère telles qu'on les montre (fiches 097, 161) : carte « Sous-tâches » du
 * fil et vue « Filles » de l'onglet Modifications disent la même chose, calculée ici.
 */
import type { ConversationSummary } from './agent'
import type { AttentionState } from './attention'
import { childRecommendations, childState, type ChildState, type ChildVerdict } from './children'
import type { TranscriptItem } from './transcript'

export type ChildReport = Extract<TranscriptItem, { kind: 'child-report' }>

export interface ChildRow {
  child: ConversationSummary
  state: ChildState
  /** Dernier compte rendu reçu par la mère. */
  report?: ChildReport
  /** Recommandation de fusion de la mère (fiche 160). */
  verdict?: ChildVerdict
}

/** Filles directes de `motherId` parmi `conversations` (ni les autres, ni les petites-filles). */
export function childrenOf<C extends Pick<ConversationSummary, 'startedFrom'>>(
  motherId: string | null | undefined,
  conversations: readonly C[]
): C[] {
  return motherId ? conversations.filter((c) => c.startedFrom?.id === motherId) : []
}

/** Une ligne par fille, dans l'ordre des lancements (`items` : le fil de la mère). */
export function childRows(
  children: readonly ConversationSummary[],
  attention: AttentionState,
  items: readonly TranscriptItem[]
): ChildRow[] {
  const launched = items.flatMap((i) => (i.kind === 'child-started' ? [i.childId] : []))
  const rank = (id: string) => {
    const index = launched.indexOf(id)
    return index === -1 ? launched.length : index
  }
  const verdicts = childRecommendations(items)
  return [...children]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((child) => {
      const report = items.findLast(
        (i): i is ChildReport => i.kind === 'child-report' && i.childId === child.id
      )
      const verdict = verdicts.get(child.id)
      return {
        child,
        state: childState(child, attention[child.id]),
        ...(report ? { report } : {}),
        ...(verdict ? { verdict } : {})
      }
    })
}
