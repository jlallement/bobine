import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffNote } from '@shared/diff-notes'
import type { CodeLine } from '../../code-lines'
import { placeNotes } from '../../file-notes'
import { FILE_FIND_EVENT } from '../../files-state'

/** Remarques sur ce fichier (fiche 271, L3) : celles de la file commune (fiche 085). */
export interface CodeNotes {
  notes: DiffNote[]
  /** Ce qui identifie ce fichier dans une nouvelle remarque. */
  anchor: Pick<DiffNote, 'view' | 'file' | 'path'>
  onSave: (note: DiffNote) => void
  onDelete: (id: string) => void
}

interface Draft {
  id?: string
  from: number
  to: number
  text: string
}

function newNoteId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Code numéroté et coloré, en lecture seule (Q38, Q47, Q54) : numéros non sélectionnables, retour
 * à la ligne au choix, « + » au survol d'un numéro (Maj-clic : une plage) pour une remarque, ⌃G pour
 * aller à une ligne ; la ligne demandée (lien du fil, `chemin:ligne`) est amenée et éclairée.
 */
export function CodeView({
  lines,
  text,
  wrap,
  name,
  line,
  notes,
  onScroll,
  initialScroll
}: {
  lines: CodeLine[]
  text: string
  wrap: boolean
  name: string
  line?: number | undefined
  notes?: CodeNotes | undefined
  onScroll?: (scroll: number) => void
  initialScroll?: number | undefined
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [goto, setGoto] = useState<string | null>(null)
  // ⌘F, le focus dans le fichier (Q48) : chercher dans le fichier, pas dans le fil.
  const [finding, setFinding] = useState(0)
  useEffect(() => {
    const onFind = () => setFinding((n) => n + 1)
    window.addEventListener(FILE_FIND_EVENT, onFind)
    return () => window.removeEventListener(FILE_FIND_EVENT, onFind)
  }, [])
  const raw = useMemo(() => text.split('\n'), [text])
  const placed = useMemo(() => placeNotes(notes?.notes ?? [], raw), [notes?.notes, raw])
  const byLine = new Map<number, typeof placed>()
  for (const p of placed) if (p.to) byLine.set(p.to, [...(byLine.get(p.to) ?? []), p])
  const leftover = placed.filter((p) => !p.to)

  const show = (target: number) => {
    const row = box.current?.querySelector<HTMLElement>(`[data-line="${target}"]`)
    if (!row) return
    row.scrollIntoView?.({ block: 'center' })
    row.classList.remove('flash')
    void row.offsetWidth
    row.classList.add('flash')
  }
  // Ligne demandée : à l'écran une fois le fichier rendu ; sinon la position retenue.
  useEffect(() => {
    if (line) show(line)
    else if (initialScroll && box.current) box.current.scrollTop = initialScroll
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à l'ouverture et à chaque ligne demandée
  }, [line, name])

  const range = (from: number, to: number) =>
    from === to ? t('diffNotes.line', { line: from }) : t('diffNotes.lines', { from, to })
  const start = (at: number, extend: boolean) => {
    if (extend && draft && !draft.id) {
      setDraft({ ...draft, from: Math.min(draft.from, at), to: Math.max(draft.to, at) })
    } else setDraft({ from: at, to: at, text: '' })
  }
  const save = () => {
    if (!notes || !draft || !draft.text.trim()) return
    notes.onSave({
      ...notes.anchor,
      id: draft.id ?? newNoteId(),
      side: 'new',
      from: draft.from,
      to: draft.to,
      code: raw.slice(draft.from - 1, draft.to).join('\n'),
      comment: draft.text.trim()
    })
    setDraft(null)
  }
  const onEditorKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDraft(null)
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // ⌃G : aller à la ligne (Q48) — ⌘G et ⌘L sont déjà pris dans Bobine.
    if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      setGoto('')
    }
  }

  const editor = (key: string): ReactNode =>
    draft && (
      <div key={key} className="file-note-row">
        <div className="diff-note-editor" data-testid="file-note-editor">
          <div className="diff-note-where">{range(draft.from, draft.to)}</div>
          <textarea
            autoFocus
            value={draft.text}
            placeholder={t('diffNotes.placeholder')}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={onEditorKey}
            rows={2}
            data-testid="file-note-input"
          />
          <div className="diff-note-actions">
            <button className="btn small ghost" onClick={() => setDraft(null)}>
              {t('diffNotes.cancel')}
            </button>
            <button
              className="btn small primary"
              onClick={save}
              disabled={!draft.text.trim()}
              data-testid="file-note-save"
            >
              {draft.id ? t('diffNotes.update') : t('diffNotes.add')}
            </button>
          </div>
        </div>
      </div>
    )
  const noteCard = (p: (typeof placed)[number]): ReactNode =>
    draft?.id === p.note.id ? (
      editor(`edit-${p.note.id}`)
    ) : (
      <div key={`note-${p.note.id}`} className="file-note-row">
        <div className="diff-note" data-testid="file-note">
          <div className="diff-note-where">
            {range(p.note.from, p.note.to)}
            {!p.to && <span className="file-note-moved">{t('files.noteChanged')}</span>}
          </div>
          <div className="diff-note-text">{p.note.comment}</div>
          <div className="diff-note-tools">
            <button
              className="icon-button small"
              aria-label={t('diffNotes.edit')}
              title={t('diffNotes.edit')}
              onClick={() =>
                setDraft({ id: p.note.id, from: p.note.from, to: p.note.to, text: p.note.comment })
              }
            >
              <Pencil size={13} />
            </button>
            <button
              className="icon-button small"
              aria-label={t('diffNotes.delete')}
              title={t('diffNotes.delete')}
              onClick={() => notes?.onDelete(p.note.id)}
              data-testid="file-note-delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    )

  return (
    <div
      className={`file-code${wrap ? ' wrap' : ''}`}
      ref={box}
      tabIndex={0}
      role="region"
      aria-label={t('files.fileLabel', { name, lines: lines.length })}
      onKeyDown={onKey}
      onScroll={(e) => onScroll?.((e.target as HTMLDivElement).scrollTop)}
      data-testid="file-code"
    >
      {goto !== null && (
        <div className="file-goto">
          <input
            autoFocus
            inputMode="numeric"
            aria-label={t('files.goToLinePrompt')}
            placeholder={t('files.goToLine')}
            value={goto}
            onChange={(e) => setGoto(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setGoto(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setGoto(null)
              if (e.key === 'Enter') {
                const n = Number(goto)
                setGoto(null)
                if (n > 0) show(Math.min(n, lines.length))
              }
            }}
            data-testid="file-goto"
          />
        </div>
      )}
      {finding > 0 && (
        <FileFind key={finding} lines={raw} onShow={show} onClose={() => setFinding(0)} />
      )}
      {lines.map((tokens, i) => {
        const n = i + 1
        const selected = draft && !draft.id && n >= draft.from && n <= draft.to
        return (
          <Fragment key={n}>
            <div
              className={`file-line${selected ? ' selected' : ''}${n === line ? ' target' : ''}`}
              data-line={n}
            >
              <span className="file-gutter">
                {notes && (
                  <button
                    className="file-note-add"
                    aria-label={t('diffNotes.comment', { line: n })}
                    title={t('diffNotes.comment', { line: n })}
                    onClick={(e) => start(n, e.shiftKey)}
                    data-testid="file-note-add"
                  >
                    <MessageSquarePlus size={12} />
                  </button>
                )}
                <span className="file-no">{n}</span>
              </span>
              <span className="file-text">
                {tokens.map((token, k) =>
                  token.className ? (
                    <span key={k} className={token.className}>
                      {token.text}
                    </span>
                  ) : (
                    <Fragment key={k}>{token.text}</Fragment>
                  )
                )}
                {tokens.length === 0 && '​'}
              </span>
            </div>
            {(byLine.get(n) ?? []).map(noteCard)}
            {draft && !draft.id && draft.to === n && editor(`draft-${n}`)}
          </Fragment>
        )
      })}
      {leftover.map(noteCard)}
    </div>
  )
}

/** Recherche dans le fichier ouvert (⌘F, Q48) : ↵ suivant, ⇧↵ précédent, Échap ferme. */
function FileFind({
  lines,
  onShow,
  onClose
}: {
  lines: readonly string[]
  onShow: (line: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(-1)
  const needle = query.toLowerCase()
  const found = useMemo(
    () =>
      needle
        ? lines.flatMap((line, i) => (line.toLowerCase().includes(needle) ? [i + 1] : []))
        : [],
    [lines, needle]
  )
  const go = (delta: number) => {
    if (found.length === 0) return
    const next = (at + delta + found.length) % found.length
    setAt(next)
    const line = found[next]
    if (line) onShow(line)
  }
  return (
    <div className="file-goto">
      <input
        autoFocus
        aria-label={t('files.find')}
        placeholder={t('files.find')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAt(-1)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            go(e.shiftKey ? -1 : 1)
          }
        }}
        data-testid="file-find"
      />
      <span className="file-find-count" data-testid="file-find-count">
        {needle ? t('files.findCount', { at: Math.max(at + 1, 0), count: found.length }) : ''}
      </span>
    </div>
  )
}
