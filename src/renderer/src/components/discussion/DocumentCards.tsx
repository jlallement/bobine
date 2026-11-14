import { FileText, FolderOpen } from 'lucide-react'
import { createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'

/** Conversation dont le fil est affiché (cartes de documents, fiche 224). */
export const ThreadConversationContext = createContext<string | null>(null)

/** Le fil affiché est celui d'une discussion (fiche 224) : cartes d'autorisation dites en clair. */
export const DiscussionContext = createContext(false)

/** Extension d'un document, en capitales (« DOCX »), pour sa carte. */
export const documentKind = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : ''
}

/**
 * Documents créés ou modifiés pendant un tour d'une discussion (fiche 224) : une carte chacun,
 * « Ouvrir » avec son app, « Enregistrer une copie… », « Afficher dans le Finder ».
 */
export function DocumentCards({ names }: { names: readonly string[] }) {
  const { t } = useTranslation()
  const id = useContext(ThreadConversationContext)
  if (!id) return null
  const documents = window.api.documents
  return (
    <div
      className="document-cards"
      data-testid="document-cards"
      aria-label={t('discussion.documents.cardTitle')}
    >
      {names.map((name) => (
        <div className="document-card" key={name} data-testid="document-card">
          <span className="document-icon">
            <FileText size={18} />
          </span>
          <span className="document-text">
            <div className="document-name">{name}</div>
            <div className="document-meta">{documentKind(name)}</div>
          </span>
          <button className="btn small" onClick={() => void documents.open(id, name)}>
            {t('discussion.documents.open')}
          </button>
          <button className="btn small ghost" onClick={() => void documents.saveCopy(id, name)}>
            {t('discussion.documents.saveCopy')}
          </button>
          <Tip label={t('discussion.documents.reveal')}>
            <button
              className="icon-button small"
              aria-label={t('discussion.documents.reveal')}
              onClick={() => void documents.reveal(id, name)}
            >
              <FolderOpen size={15} />
            </button>
          </Tip>
        </div>
      ))}
    </div>
  )
}
