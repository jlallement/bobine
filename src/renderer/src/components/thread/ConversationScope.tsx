import type { ReactNode } from 'react'
import { FileLinksContext, type OpenFileLink } from './FileLink'
import { EditorContext } from './OpenInEditor'
import { SubagentWorkContext, type LoadSubagentWork } from '../../subagent-work'
import { useEditorAction } from '../../useEditor'
import type { LinkNotices } from '../../useFileLinks'

/**
 * Ce qui, dans un fil, dépend de la conversation affichée : ses liens de fichiers (fiche 052), le
 * travail de ses sous-agents (fiche 053) et l'éditeur qui ouvre ses fichiers (fiche 156).
 */
export function ConversationScope({
  conversationId,
  notices,
  openLink,
  loadSubagentWork,
  children
}: {
  conversationId: string | null | undefined
  /** Avis du fil (fichier absent, hors du dossier) ; absents : rien n'est dit. */
  notices?: LinkNotices
  openLink: OpenFileLink
  loadSubagentWork: LoadSubagentWork
  children: ReactNode
}) {
  const editor = useEditorAction(conversationId, notices)
  return (
    <FileLinksContext.Provider value={openLink}>
      <SubagentWorkContext.Provider value={loadSubagentWork}>
        <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
      </SubagentWorkContext.Provider>
    </FileLinksContext.Provider>
  )
}
