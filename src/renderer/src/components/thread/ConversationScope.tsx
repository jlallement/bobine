import { useEffect, useMemo, type ReactNode } from 'react'
import type { TranscriptItem } from '@shared/transcript'
import { FileExistsContext, FileLinksContext, type OpenFileLink } from './FileLink'
import { fileChecksFor, filesRevision, type FileChecks } from './file-checks'
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
  items,
  children
}: {
  conversationId: string | null | undefined
  /** Fil d'une discussion (fiche 224). */
  discussion?: boolean
  /** Avis du fil (fichier absent, hors du dossier) ; absents : rien n'est dit. */
  notices?: LinkNotices
  openLink: OpenFileLink
  loadSubagentWork: LoadSubagentWork
  /**
   * Fil de la conversation : un outil d'écriture ou de commande terminé, une réponse finie font
   * revérifier les fichiers cités en code qui n'existaient pas (fiche 272).
   */
  items?: readonly TranscriptItem[]
  children: ReactNode
}) {
  const editor = useEditorAction(conversationId, notices)
  const checkFiles = useFileChecker(conversationId)
  const revision = useMemo(() => (items ? filesRevision(items) : undefined), [items])
  useEffect(() => {
    if (checkFiles && revision !== undefined) checkFiles.sync(revision)
  }, [checkFiles, revision])
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
 * Mémoire de l'existence des fichiers cités en code dans le fil d'une conversation (fiche 272),
 * retenue par conversation (un fil remonté la retrouve) ; aucune sans conversation.
 */
export function useFileChecker(conversationId: string | null | undefined): FileChecks | null {
  return useMemo(() => (conversationId ? fileChecksFor(conversationId) : null), [conversationId])
}
