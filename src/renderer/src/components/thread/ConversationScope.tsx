import { useMemo, type ReactNode } from 'react'
import {
  FileExistsContext,
  FileLinksContext,
  type CheckFileLinks,
  type OpenFileLink
} from './FileLink'
import { EditorContext } from './OpenInEditor'
import { SubagentWorkContext, type LoadSubagentWork } from '../../subagent-work'
import { useEditorAction } from '../../useEditor'
import { DiscussionContext, ThreadConversationContext } from '../discussion/DocumentCards'
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
  discussion = false,
  children
}: {
  conversationId: string | null | undefined
  /** Fil d'une discussion (fiche 224). */
  discussion?: boolean
  /** Avis du fil (fichier absent, hors du dossier) ; absents : rien n'est dit. */
  notices?: LinkNotices
  openLink: OpenFileLink
  loadSubagentWork: LoadSubagentWork
  children: ReactNode
}) {
  const editor = useEditorAction(conversationId, notices)
  const checkFiles = useFileChecker(conversationId)
  return (
    <FileLinksContext.Provider value={openLink}>
      <FileExistsContext.Provider value={checkFiles}>
        <SubagentWorkContext.Provider value={loadSubagentWork}>
          <EditorContext.Provider value={editor}>
            <ThreadConversationContext.Provider value={conversationId ?? null}>
              <DiscussionContext.Provider value={discussion}>{children}</DiscussionContext.Provider>
            </ThreadConversationContext.Provider>
          </EditorContext.Provider>
        </SubagentWorkContext.Provider>
      </FileExistsContext.Provider>
    </FileLinksContext.Provider>
  )
}

/**
 * Vérificateur des fichiers cités en code dans le fil d'une conversation (fiche 272) : stable tant
 * que la conversation l'est (il garde les fichiers trouvés) ; aucun sans conversation.
 */
export function useFileChecker(conversationId: string | null | undefined): CheckFileLinks | null {
  return useMemo(
    () =>
      conversationId
        ? (hrefs: string[], base?: string) =>
            window.api.fileLinks.existing(conversationId, hrefs, base)
        : null,
    [conversationId]
  )
}
