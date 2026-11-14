import { useEffect, useRef } from 'react'
import type { AgentConfigureRequest, ConversationSpace, ConversationSummary } from '@shared/agent'
import { readLocal, writeLocal } from './components/sidebar/SidebarSection'

/** Dernier espace choisi sur ce poste (fiche 224). */
const SPACE_KEY = 'bobine:espace'

export const spaceOf = (
  c: Pick<ConversationSummary, 'space'> | null | undefined
): ConversationSpace => c?.space ?? 'code'

/**
 * Espace affiché (fiche 224) : celui de la conversation active. Changer d'espace rouvre la
 * conversation la plus récente de cet espace, sinon en crée une ; le choix est retenu sur ce poste
 * et repris au lancement.
 */
export function useSpace(c: {
  list: ConversationSummary[]
  activeSummary: ConversationSummary | null
  select: (id: string) => void
  create: (request?: AgentConfigureRequest) => void
}) {
  const space = spaceOf(c.activeSummary)
  const choose = (next: ConversationSpace) => {
    writeLocal(SPACE_KEY, next)
    if (next === space) return
    const recent = c.list
      .filter((x) => !x.draft && !x.archived && spaceOf(x) === next)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    if (recent) c.select(recent.id)
    else c.create({ space: next })
  }
  // Au lancement, l'app ouvre une conversation de l'espace Code : l'espace retenu reprend la main.
  const resumed = useRef(false)
  const ready = c.activeSummary !== null
  useEffect(() => {
    if (!ready || resumed.current) return
    resumed.current = true
    if (readLocal<unknown>(SPACE_KEY, 'code') === 'discussion' && space === 'code') {
      choose('discussion')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, au premier état chargé
  }, [ready])
  /** Nouvelle conversation de l'espace affiché (bouton, ⌘N). */
  const create = () => c.create(space === 'discussion' ? { space } : {})
  return { space, choose, create }
}
