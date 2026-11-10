import { ExternalLink, FileText, FolderOpen, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { openOutcomeNote, type MarkdownDocument } from '@shared/file-links'
import type { TranscriptItem } from '@shared/transcript'
import { FileLinkBase, FileLinksContext, type OpenFileLink } from '../thread/FileLink'
import { Markdown } from '../thread/Markdown'
import { Tip } from '../common/Menus'
import { useTranslation } from 'react-i18next'
import { ipcErrorText } from '../../ipc-errors'

/**
 * Aperçu d'un document Markdown cité dans la conversation (fiche 052) : en lecture seule, relu
 * quand l'agent a travaillé ; ses liens relatifs partent de son propre dossier.
 */
export function DocumentTab({
  conversationId,
  document,
  items,
  onDocument,
  onOpenLink,
  onClose
}: {
  /** Conversation dont vient le document (son dossier de travail). */
  conversationId: string
  document: MarkdownDocument
  /** Fil de la conversation affichée : un outil terminé peut avoir modifié le document. */
  items: TranscriptItem[]
  onDocument: (document: MarkdownDocument) => void
  onOpenLink: OpenFileLink
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const { path } = document
  const refresh = useCallback(() => {
    window.api.fileLinks
      .readMarkdown(conversationId, path)
      .then((next) => {
        setError(null)
        onDocument(next)
      })
      .catch((e: unknown) => setError(ipcErrorText(e)))
  }, [conversationId, path, onDocument])
  const finished = items.filter((i) => i.kind === 'tool' && i.status === 'completed').length
  useEffect(() => {
    if (finished > 0) refresh()
  }, [finished, refresh])
  const name = document.relative.split('/').at(-1) ?? document.relative
  return (
    <div className="document-tab" data-testid="document-tab">
      <div className="document-head">
        <FileText size={15} className="muted-icon" />
        <span className="document-title" title={document.path}>
          <span className="document-name" data-testid="document-name">
            {name}
          </span>
          {document.relative !== name && <span className="document-path">{document.relative}</span>}
        </span>
        <Tip label={t('document.reload')}>
          <button className="icon-button small" onClick={refresh} aria-label={t('document.reload')}>
            <RefreshCw size={14} />
          </button>
        </Tip>
        <Tip label={t('document.open')}>
          <button
            className="icon-button small"
            onClick={() =>
              void window.api.changes
                .open(conversationId, path)
                .then((outcome) => setError(openOutcomeNote(outcome) ?? null))
                .catch((e: unknown) => setError(ipcErrorText(e)))
            }
            aria-label={t('document.open')}
            data-testid="document-open"
          >
            <ExternalLink size={14} />
          </button>
        </Tip>
        <Tip label={t('document.reveal')}>
          <button
            className="icon-button small"
            onClick={() => void window.api.changes.reveal(conversationId, path)}
            aria-label={t('document.reveal')}
          >
            <FolderOpen size={14} />
          </button>
        </Tip>
        <Tip label={t('document.close')}>
          <button
            className="icon-button small"
            onClick={onClose}
            aria-label={t('document.close')}
            data-testid="document-close"
          >
            <X size={14} />
          </button>
        </Tip>
      </div>
      {error && <div className="browser-error">{error}</div>}
      <div className="document-body msg-agent" data-testid="document-body">
        <FileLinksContext.Provider value={onOpenLink}>
          <FileLinkBase.Provider value={document.dir}>
            <Markdown text={document.text} />
          </FileLinkBase.Provider>
        </FileLinksContext.Provider>
        {document.truncated && <p className="document-truncated">{t('document.truncated')}</p>}
      </div>
    </div>
  )
}
