import { MessageSquare, MessageSquarePlus, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'
import { bubbleAt, frozenLayout, toAreaPoint, type Size } from '../../page-annotation'
import type { PageAnnotation, PageDraft } from '../../usePageAnnotation'

/**
 * Page figée le temps d'écrire une remarque (fiches 132 et 146) : la capture posée là où était la
 * vue native, l'épingle du brouillon et sa bulle. Les épingles déjà posées sont dans la capture
 * (dessinées dans la page). « Ajouter », « Annuler », Échap ou un clic à côté d'une bulle vide
 * rendent la page vivante.
 */
export function PageAnnotator({
  draft,
  number,
  onSave,
  onCancel,
  onDelete
}: {
  draft: PageDraft
  number: number
  onSave: (text: string) => Promise<void>
  onCancel: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const layer = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const [area, setArea] = useState<Size>({ width: 0, height: 0 })
  const [text, setText] = useState(draft.text)
  const [saving, setSaving] = useState(false)
  const layout = frozenLayout(area, draft.freeze)

  useEffect(() => {
    const el = layer.current
    if (!el) return
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight })
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    measure()
    return () => resize.disconnect()
  }, [])

  const save = () => {
    if (!text.trim() || saving) return
    setSaving(true)
    void onSave(text).finally(() => setSaving(false))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  // Un clic à côté : une remarque commencée n'est pas perdue ; vide, la page revient.
  const outside = () => {
    if (text.trim()) input.current?.focus()
    else onCancel()
  }

  const at = toAreaPoint({ x: draft.x, y: draft.y }, layout)
  return (
    <div
      ref={layer}
      className="page-frozen"
      tabIndex={-1}
      aria-label={t('browser.annotate.frozen')}
      onClick={outside}
      data-testid="page-frozen"
    >
      {area.width > 0 && (
        <>
          <img
            className="page-frozen-image"
            src={`data:${draft.freeze.mimeType};base64,${draft.freeze.data}`}
            alt=""
            draggable={false}
            style={{
              left: layout.left,
              top: layout.top,
              width: layout.width,
              height: layout.height
            }}
          />
          <span
            className="page-pin"
            style={{ left: at.x, top: at.y }}
            aria-label={t('browser.annotate.pin', { n: number })}
            data-testid="page-pin"
          >
            {number}
          </span>
          <div
            className="page-bubble editing"
            style={bubbleAt(at, area)}
            onClick={(e) => e.stopPropagation()}
            data-testid="page-note-editor"
          >
            <textarea
              ref={input}
              autoFocus
              value={text}
              placeholder={t('diffNotes.placeholder')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              data-testid="page-note-input"
            />
            <div className="page-bubble-actions">
              {draft.existing && (
                <Tip label={t('diffNotes.delete')}>
                  <button
                    type="button"
                    className="icon-button small"
                    aria-label={t('diffNotes.delete')}
                    onClick={onDelete}
                    data-testid="page-note-delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </Tip>
              )}
              <span className="grow" />
              <button type="button" className="btn small ghost" onClick={onCancel}>
                {t('diffNotes.cancel')}
              </button>
              <button
                type="button"
                className="btn small primary"
                onClick={save}
                disabled={!text.trim() || saving}
                data-testid="page-note-save"
              >
                {draft.existing ? t('diffNotes.update') : t('diffNotes.add')}
                <kbd>⌘↩</kbd>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Bandeau du mode Annoter, sous la barre du navigateur (fiches 132, 146). */
export function AnnotateHint() {
  const { t } = useTranslation()
  return (
    <div className="page-annotate-hint" role="status" data-testid="page-annotate-hint">
      <MessageSquarePlus size={14} />
      <span>{t('browser.annotate.hint')}</span>
      <span className="grow" />
      <span className="page-annotate-hint-key">
        <kbd>{t('browser.annotate.esc')}</kbd> {t('browser.annotate.finish')}
      </span>
    </div>
  )
}

/** Une seule barre « N remarques · Envoyer à l'agent », comme celle du diff (fiche 085). */
export function PageNotesBar({ annotation }: { annotation: PageAnnotation }) {
  const { t } = useTranslation()
  if (annotation.count === 0) return null
  return (
    <div className="diff-notes-bar page-notes-bar" data-testid="page-notes-bar">
      <MessageSquare size={14} />
      <span className="diff-notes-count">{t('diffNotes.count', { count: annotation.count })}</span>
      <span className="grow" />
      <Tip label={t('diffNotes.clear')}>
        <button
          type="button"
          className="icon-button small"
          aria-label={t('diffNotes.clear')}
          onClick={annotation.clear}
          data-testid="page-notes-clear"
        >
          <Trash2 size={13} />
        </button>
      </Tip>
      <button
        type="button"
        className="btn small primary"
        onClick={() => void annotation.send()}
        data-testid="page-notes-send"
      >
        <Send size={13} />
        {t('diffNotes.send')}
      </button>
    </div>
  )
}
