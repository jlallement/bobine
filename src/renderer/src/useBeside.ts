import { useState } from 'react'
import type { Conversations } from './useConversations'
import { useConversationScope, type OpenFileLinkIn } from './useFileLinks'

/**
 * Vue côte à côte (fiche 036) : une seconde conversation à côté de l'active, chargée à part et
 * relâchée en la fermant ; ses liens s'ouvrent dans son propre dossier (fiche 052).
 */
export function useBeside(options: {
  conversations: Pick<
    Conversations,
    'list' | 'activeId' | 'loaded' | 'openBeside' | 'releaseBeside' | 'select'
  >
  openFileLink: OpenFileLinkIn
}) {
  const { conversations: c, openFileLink } = options
  const [besideId, setBesideId] = useState<string | null>(null)
  // Devenue l'active : elle n'est plus à côté.
  const summary = c.list.find((conv) => conv.id === besideId && conv.id !== c.activeId)
  const view = summary ? c.loaded[summary.id] : undefined
  const open = (id: string) => {
    if (besideId && besideId !== id) c.releaseBeside(besideId)
    setBesideId(id)
    c.openBeside(id)
  }
  const close = () => {
    if (besideId) c.releaseBeside(besideId)
    setBesideId(null)
  }
  /** La conversation d'à côté prend la place de l'active. */
  const focus = () => {
    if (!summary) return
    const id = summary.id
    close()
    c.select(id)
  }
  const scope = useConversationScope(besideId, openFileLink, 'app.noBeside')
  return { summary, view, open, close, focus, ...scope }
}
