import {
  ClipboardList,
  GitCompareArrows,
  MessageSquarePlus,
  Play,
  Send,
  Trash2
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import type { PlanNote, PlanVersion } from '@shared/plan-doc'
import { loadPlanNotes, planNotesKey, savePlanNotes } from '../../plan-notes'
import { DiffView } from './DiffView'
import { Markdown } from './Markdown'
import { useTranslation } from 'react-i18next'

export interface PlanActions {
  /** L'agent travaille : pas d'envoi ni d'exécution. */
  busy: boolean
  /** Clé de la conversation (pour garder les remarques en cours). */
  conversationId: string
  onSendNotes: (notes: PlanNote[], path?: string) => void
  onExecute: (path?: string) => void
}

const HIGHLIGHT = 'plan-notes'
const basename = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

/**
 * Position de chaque caractère non blanc du conteneur : un passage sélectionné se retrouve dans le
 * texte rendu même s'il traverse plusieurs paragraphes (blancs ignorés des deux côtés).
 */
function rangesFor(container: HTMLElement, quote: string): Range[] {
  const needle = quote.replace(/\s+/g, '')
  if (!needle) return []
  const chars: { node: Text; offset: number }[] = []
  let text = ''
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? ''
    for (let i = 0; i < value.length; i++) {
      if (/\s/.test(value[i] ?? '')) continue
      chars.push({ node: node as Text, offset: i })
      text += value[i]
    }
  }
  const ranges: Range[] = []
  let at = text.indexOf(needle)
  while (at >= 0) {
    const start = chars[at]
    const end = chars[at + needle.length - 1]
    if (start && end) {
      const range = document.createRange()
      range.setStart(start.node, start.offset)
      range.setEnd(end.node, end.offset + 1)
      ranges.push(range)
    }
    at = text.indexOf(needle, at + needle.length)
  }
  return ranges
}

/**
 * Plan de l'agent dans le fil (fiche 040), comme dans Claude Desktop : lu en Markdown, annoté
 * passage par passage, renvoyé avec les remarques pour une nouvelle version, ou exécuté.
 */
export function PlanDocument({ plan, actions }: { plan: PlanVersion; actions?: PlanActions }) {
  const { t } = useTranslation()
  // Remarques en cours gardées par conversation et version (stockage local, fiche 043).
  const key = actions ? planNotesKey(actions.conversationId, plan.series, plan.version) : ''
  const [notes, setNotesState] = useState<PlanNote[]>(() => (key ? loadPlanNotes(key) : []))
  const setNotes = (next: PlanNote[]) => {
    setNotesState(next)
    if (key) savePlanNotes(key, next)
  }
  const [showDiff, setShowDiff] = useState(false)
  const [pending, setPending] = useState<{ quote: string; top: number; left: number } | null>(null)
  const [editing, setEditing] = useState<{ quote: string; comment: string } | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const review = useRef<HTMLDivElement>(null)
  // Formulaire replié ou remarque retirée, pointeur sur la carte : la zone des remarques garde sa
  // hauteur jusqu'à ce qu'il en sorte, sans quoi la barre remonterait sous lui (fiche 127, D27).
  const hovered = useRef(false)
  const [keptHeight, setKeptHeight] = useState<number | null>(null)
  const keepHeight = () => {
    if (hovered.current && review.current) setKeptHeight(review.current.offsetHeight)
  }
  const editable = !!actions && plan.latest && !actions.busy

  // Passages commentés surlignés (CSS Custom Highlight API : le Markdown rendu n'est pas modifié).
  useLayoutEffect(() => {
    const container = body.current
    const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined
    if (!container || !registry || !plan.latest) return
    const ranges = showDiff ? [] : notes.flatMap((n) => rangesFor(container, n.quote))
    registry.set(HIGHLIGHT, new Highlight(...ranges))
    return () => {
      registry.delete(HIGHLIGHT)
    }
  }, [notes, showDiff, plan.latest, plan.text])

  // Pointeur sur la carte : écouteurs natifs. Ceux de React voient une sortie quand le bouton
  // sous le pointeur disparaît (« Ajouter la remarque »), et la hauteur gardée serait relâchée.
  useEffect(() => {
    const el = card.current
    if (!el) return
    const enter = () => {
      hovered.current = true
    }
    const leave = () => {
      hovered.current = false
      setKeptHeight(null)
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
    }
  }, [])

  // Un clic ailleurs referme le bouton « Commenter ».
  useEffect(() => {
    if (!pending) return
    const close = () => setPending(null)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [pending])

  const onMouseUp = (event: MouseEvent) => {
    if (!editable || editing) return
    const selection = window.getSelection()
    const quote = selection?.toString().trim() ?? ''
    const container = body.current
    const cardBox = card.current?.getBoundingClientRect()
    if (!selection || !quote || !container || !cardBox || selection.rangeCount === 0) {
      setPending(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (!container.contains(range.commonAncestorContainer)) return
    const box = range.getBoundingClientRect()
    event.stopPropagation()
    setPending({
      quote,
      top: box.bottom - cardBox.top + 6,
      left: Math.min(Math.max(8, box.left - cardBox.left), cardBox.width - 150)
    })
  }

  const closeEditor = () => {
    keepHeight()
    setEditing(null)
  }

  const addNote = () => {
    if (!editing || !editing.comment.trim()) return
    keepHeight()
    setNotes([...notes, { quote: editing.quote, comment: editing.comment.trim() }])
    setEditing(null)
  }

  const title = plan.path ? basename(plan.path) : t('planDocument.title')
  return (
    <div
      className={`plan-document${plan.latest ? ' latest' : ''}`}
      ref={card}
      data-testid="plan-document"
      data-version={plan.version}
    >
      <div className="plan-document-head">
        <ClipboardList size={15} />
        <span className="plan-document-title">{title}</span>
        <span className="plan-document-version">
          {t('planDocument.version', { version: plan.version })}
        </span>
        <span className="grow" />
        {plan.previous !== undefined && (
          <button
            className={`btn small ghost${showDiff ? ' active' : ''}`}
            onClick={() => setShowDiff(!showDiff)}
            data-testid="plan-diff-toggle"
          >
            <GitCompareArrows size={13} />{' '}
            {showDiff ? t('planDocument.showPlan') : t('planDocument.showDiff')}
          </button>
        )}
      </div>

      {showDiff && plan.previous !== undefined ? (
        <div className="plan-document-diff" data-testid="plan-diff">
          <DiffView path={title} oldText={plan.previous} newText={plan.text} bare />
        </div>
      ) : (
        <div
          className={`plan-document-body msg-agent${editable ? ' annotatable' : ''}`}
          ref={body}
          onMouseUp={onMouseUp}
          data-testid="plan-body"
        >
          <Markdown text={plan.text} />
        </div>
      )}

      {/* Remarques et formulaire : leur zone garde sa hauteur sous le pointeur (fiche 127). */}
      {(notes.length > 0 || editing || keptHeight !== null) && (
        <div
          className="plan-document-review"
          ref={review}
          style={keptHeight !== null ? { minHeight: keptHeight } : undefined}
          data-testid="plan-review"
        >
          {notes.length > 0 && (
            <ol className="plan-notes" data-testid="plan-notes">
              {notes.map((note, i) => (
                <li key={i}>
                  <blockquote title={note.quote}>{note.quote}</blockquote>
                  <textarea
                    className="plan-note-comment"
                    rows={1}
                    value={note.comment}
                    disabled={!editable}
                    onChange={(e) =>
                      setNotes(
                        notes.map((n, j) => (j === i ? { ...n, comment: e.target.value } : n))
                      )
                    }
                    aria-label={t('planDocument.note', { number: i + 1 })}
                  />
                  {editable && (
                    <button
                      className="icon-button small"
                      aria-label={t('planDocument.deleteNote', { number: i + 1 })}
                      onClick={() => {
                        keepHeight()
                        setNotes(notes.filter((_, j) => j !== i))
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          {editing && (
            <div className="plan-note-editor" data-testid="plan-note-editor">
              <blockquote>{editing.quote}</blockquote>
              <textarea
                autoFocus
                rows={2}
                placeholder={t('planDocument.notePlaceholder')}
                value={editing.comment}
                onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    addNote()
                  }
                  if (e.key === 'Escape') closeEditor()
                }}
                data-testid="plan-note-input"
              />
              <div className="plan-note-actions">
                <button className="btn small ghost" onClick={closeEditor}>
                  {t('common.cancel')}
                </button>
                <button
                  className="btn small primary"
                  disabled={!editing.comment.trim()}
                  onClick={addNote}
                  data-testid="plan-note-add"
                >
                  {t('planDocument.addNote')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {actions && plan.latest && (
        // Boutons ancrés à droite : le texte d'aide change de longueur (« 1 remarque ») sans les
        // déplacer ; « Exécuter le plan » ne vient jamais sous le pointeur (fiche 124), ni en
        // remontant quand le formulaire se replie (zone des remarques gardée, fiche 127).
        <div className="plan-document-actions" data-testid="plan-actions">
          <span className="plan-document-hint" data-testid="plan-document-hint">
            {editable
              ? notes.length === 0
                ? t('planDocument.selectHint')
                : t('planDocument.notes', { count: notes.length })
              : t('planDocument.agentWorking')}
          </span>
          <span className="plan-document-buttons" data-testid="plan-buttons">
            <button
              className="btn small"
              disabled={!editable || notes.length === 0 || notes.some((n) => !n.comment.trim())}
              onClick={() => {
                actions.onSendNotes(notes, plan.path)
                setNotes([])
              }}
              data-testid="plan-send-notes"
            >
              <Send size={13} /> {t('planDocument.sendNotes')}
            </button>
            <button
              className="btn small primary"
              disabled={!editable}
              onClick={() => actions.onExecute(plan.path)}
              data-testid="plan-execute"
            >
              <Play size={13} /> {t('planDocument.execute')}
            </button>
          </span>
        </div>
      )}

      {pending && !editing && (
        <button
          className="plan-comment-button"
          style={{ top: pending.top, left: pending.left }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setEditing({ quote: pending.quote, comment: '' })
            setPending(null)
            window.getSelection()?.removeAllRanges()
          }}
          data-testid="plan-comment"
        >
          <MessageSquarePlus size={14} /> {t('planDocument.comment')}
        </button>
      )}
    </div>
  )
}
