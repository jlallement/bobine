import { FileText, FolderOpen, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiscussionDocument, DocumentPreview } from '@shared/documents'
import type { TranscriptItem } from '@shared/transcript'
import { Tip } from '../common/Menus'

/** Taille lisible : « 24 Ko », « 1,2 Mo ». */
export function sizeText(bytes: number, language: string): string {
  const units = language.startsWith('fr') ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toLocaleString(language, { maximumFractionDigits: digits })} ${units[unit]}`
}

/** Onglet « Documents », quand il est l'onglet affiché (fiche 224). */
export function DocumentsTab(props: {
  tab: string
  conversationId: string | null
  items: readonly TranscriptItem[]
}) {
  if (props.tab !== 'documents' || !props.conversationId) return null
  return <DocumentsPanel conversationId={props.conversationId} items={props.items} />
}

/**
 * Onglet « Documents » d'une discussion (fiche 224, maquettes E3 et E5) : les documents de la
 * discussion (déposés ou créés par l'agent), où en déposer, et l'aperçu en lecture seule du
 * document choisi, avec « Ouvrir » et « Enregistrer une copie… ». Relu à chaque élément du fil
 * (un tour qui finit peut en avoir créé).
 */
export function DocumentsPanel({
  conversationId,
  items
}: {
  conversationId: string
  items: readonly TranscriptItem[]
}) {
  const { t, i18n } = useTranslation()
  const api = window.api.documents
  const [documents, setDocuments] = useState<DiscussionDocument[]>([])
  const [chosen, setChosen] = useState<string | null>(null)
  // Aperçu du document qu'il montre : un autre document choisi n'en hérite pas.
  const [shown, setShown] = useState<{ name: string; preview: DocumentPreview } | null>(null)
  const [over, setOver] = useState(false)
  const refresh = useCallback(
    () =>
      api
        .list(conversationId)
        .then(setDocuments)
        .catch(() => setDocuments([])),
    [api, conversationId]
  )
  useEffect(() => void refresh(), [refresh, items.length])
  const selected = chosen && documents.some((d) => d.name === chosen) ? chosen : documents[0]?.name
  useEffect(() => {
    if (!selected) return
    let current = true
    const show = (preview: DocumentPreview) => current && setShown({ name: selected, preview })
    api
      .preview(conversationId, selected)
      .then(show)
      .catch(() => show({ kind: 'none' }))
    return () => {
      current = false
    }
  }, [api, conversationId, selected, documents])
  const preview = shown && shown.name === selected ? shown.preview : null

  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    const paths = [...event.dataTransfer.files]
      .map((f) => window.api.files.pathFor(f))
      .filter(Boolean)
    if (paths.length > 0) void api.add(conversationId, paths).then(refresh)
  }
  return (
    <div className="documents-panel" data-testid="documents-panel">
      <div className="documents-list">
        <div className="documents-head">
          <span>{t('discussion.documents.heading', { count: documents.length })}</span>
          <Tip label={t('discussion.documents.add')}>
            <button
              className="icon-button small"
              aria-label={t('discussion.documents.add')}
              onClick={() => void api.pick(conversationId).then(refresh)}
              data-testid="documents-add"
            >
              <Plus size={14} />
            </button>
          </Tip>
        </div>
        {documents.length === 0 && (
          <p className="documents-empty">{t('discussion.documents.empty')}</p>
        )}
        <div role="listbox">
          {documents.map((d) => (
            <button
              key={d.name}
              role="option"
              aria-selected={d.name === selected}
              className="documents-row"
              onClick={() => setChosen(d.name)}
              data-testid="documents-row"
            >
              <FileText size={15} />
              <span className="documents-name">{d.name}</span>
              <span className="documents-meta">
                {t('discussion.documents.meta', {
                  size: sizeText(d.size, i18n.language),
                  date: new Date(d.modifiedAt).toLocaleDateString(i18n.language)
                })}
              </span>
            </button>
          ))}
        </div>
        <div
          className={`documents-drop${over ? ' over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          data-testid="documents-drop"
        >
          {t('discussion.documents.drop')}
        </div>
      </div>
      {selected && (
        <div className="documents-preview" data-testid="documents-preview">
          <div className="documents-preview-bar">
            <span className="documents-preview-name">{selected}</span>
            <button className="btn small" onClick={() => void api.open(conversationId, selected)}>
              {t('discussion.documents.open')}
            </button>
            <button
              className="btn small ghost"
              onClick={() => void api.saveCopy(conversationId, selected)}
            >
              {t('discussion.documents.saveCopy')}
            </button>
            <Tip label={t('discussion.documents.reveal')}>
              <button
                className="icon-button small"
                aria-label={t('discussion.documents.reveal')}
                onClick={() => void api.reveal(conversationId, selected)}
              >
                <FolderOpen size={15} />
              </button>
            </Tip>
          </div>
          <PreviewBody preview={preview} />
        </div>
      )}
    </div>
  )
}

function PreviewBody({ preview }: { preview: DocumentPreview | null }) {
  const { t } = useTranslation()
  if (!preview) return null
  switch (preview.kind) {
    case 'text':
      return (
        <>
          <pre>{preview.text}</pre>
          {preview.truncated && (
            <p className="documents-note">{t('discussion.documents.truncated')}</p>
          )}
        </>
      )
    case 'image':
      return <img src={`data:${preview.mimeType};base64,${preview.data}`} alt="" />
    default:
      return <p className="documents-note">{t('discussion.documents.noPreview')}</p>
  }
}
