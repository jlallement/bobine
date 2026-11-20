import { ChevronDown, ChevronUp, MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react'
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffNote } from '@shared/diff-notes'
import type { CodeLine } from '../../code-lines'
import { placeNotes } from '../../file-notes'
import { FILE_FIND_EVENT, FILE_GOTO_EVENT } from '../../files-state'
import { Tip } from '../common/Menus'

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

/** Une tabulation compte pour quatre colonnes (point 5). */
const TAB = 4

/** Largeur de l'indentation d'une ligne, en colonnes. */
export function indentOf(line: string): number {
  let width = 0
  for (const ch of line) {
    if (ch === ' ') width++
    else if (ch === '\t') width += TAB
    else break
  }
  return width
}

/** Lignes du fichier qui portent une remarque (barre dans la gouttière, point 6). */
export function notedLines(placed: ReturnType<typeof placeNotes>): Set<number> {
  const lines = new Set<number>()
  for (const p of placed) {
    if (!p.from || !p.to) continue
    for (let n = p.from; n <= p.to; n++) lines.add(n)
  }
  return lines
}

/**
 * Code numéroté et coloré, en lecture seule (Q38, Q47, Q54) : numéros non sélectionnables, retour
 * à la ligne au choix (la suite d'une ligne s'aligne sur son indentation), « + » d'une ligne pour
 * une remarque (Maj-clic : une plage ; au clavier, une seule étape de tabulation dans la gouttière,
 * ↑ ↓ pour changer de ligne, + ou ↵ pour remarquer), ⌃G pour aller à une ligne, ⌘F pour chercher.
 * La ligne demandée (lien du fil, `chemin:ligne`) est amenée et éclairée un instant.
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
  const [bar, setBar] = useState<{ kind: 'find' | 'goto'; seq: number } | null>(null)
  const [gutterLine, setGutterLine] = useState(1)
  const raw = useMemo(() => text.split('\n'), [text])
  const placed = useMemo(() => placeNotes(notes?.notes ?? [], raw), [notes?.notes, raw])
  const noted = useMemo(() => notedLines(placed), [placed])
  const byLine = new Map<number, typeof placed>()
  for (const p of placed) if (p.to) byLine.set(p.to, [...(byLine.get(p.to) ?? []), p])
  const leftover = placed.filter((p) => !p.to)

  // ⌘F (le focus dans le fichier) et « Aller à la ligne… » du menu : la barre au-dessus du code.
  useEffect(() => {
    const onFind = () => setBar((b) => ({ kind: 'find', seq: (b?.seq ?? 0) + 1 }))
    const onGoto = () => setBar((b) => ({ kind: 'goto', seq: (b?.seq ?? 0) + 1 }))
    window.addEventListener(FILE_FIND_EVENT, onFind)
    window.addEventListener(FILE_GOTO_EVENT, onGoto)
    return () => {
      window.removeEventListener(FILE_FIND_EVENT, onFind)
      window.removeEventListener(FILE_GOTO_EVENT, onGoto)
    }
  }, [])

  const show = (target: number) => {
    const row = box.current?.querySelector<HTMLElement>(`[data-line="${target}"]`)
    if (!row) return
    row.scrollIntoView?.({ block: 'center' })
    // Éclairée le temps d'un éclair, pas plus (point 6).
    row.classList.remove('flash')
    void row.offsetWidth
    row.classList.add('flash')
    row.addEventListener('animationend', () => row.classList.remove('flash'), { once: true })
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
      setBar((b) => ({ kind: 'goto', seq: (b?.seq ?? 0) + 1 }))
    }
  }
  // Gouttière : une seule étape de tabulation, ↑ ↓ changent de ligne (point 17).
  const onGutterKey = (event: KeyboardEvent<HTMLButtonElement>, n: number) => {
    const move = (to: number) => {
      event.preventDefault()
      const next = Math.min(Math.max(to, 1), lines.length)
      setGutterLine(next)
      box.current
        ?.querySelector<HTMLElement>(`[data-line="${next}"] [data-testid=file-note-add]`)
        ?.focus()
    }
    if (event.key === 'ArrowDown') move(n + 1)
    else if (event.key === 'ArrowUp') move(n - 1)
    else if (event.key === 'Home') move(1)
    else if (event.key === 'End') move(lines.length)
    else if (event.key === '+' || event.key === 'Enter') {
      event.preventDefault()
      start(n, event.shiftKey)
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
            {!p.to && (
              <span className="file-note-moved">
                {' · '}
                {t('files.noteChanged')}
              </span>
            )}
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
    <div className="file-code-wrap">
      {bar?.kind === 'find' && (
        <FileFind key={bar.seq} lines={raw} onShow={show} onClose={() => setBar(null)} />
      )}
      {bar?.kind === 'goto' && (
        <GotoBar
          key={bar.seq}
          count={lines.length}
          onGo={(n) => {
            setBar(null)
            show(n)
          }}
          onClose={() => setBar(null)}
        />
      )}
      <div
        className={`file-code${wrap ? ' wrap' : ''}`}
        ref={box}
        tabIndex={0}
        role="region"
        aria-label={t('files.fileLabel', { name, lines: lines.length })}
        onKeyDown={onKey}
        onScroll={(e) => onScroll?.((e.target as HTMLDivElement).scrollTop)}
        data-testid="file-code"
        // Ligne demandée (lien du fil, `chemin:ligne`), pour les essais : l'éclair ne dure pas.
        {...(line ? { 'data-asked': line } : {})}
      >
        {lines.map((tokens, i) => {
          const n = i + 1
          const selected = !!draft && !draft.id && n >= draft.from && n <= draft.to
          const classes = ['file-line', selected ? 'selected' : '', noted.has(n) ? 'noted' : '']
          // Retrait suspendu : la suite d'une ligne repliée s'aligne sur son indentation (point 5).
          const style = wrap
            ? ({ '--hang': `${indentOf(raw[i] ?? '') + 2}ch` } as CSSProperties)
            : undefined
          return (
            <Fragment key={n}>
              <div className={classes.filter(Boolean).join(' ')} data-line={n} style={style}>
                <span className="file-gutter">
                  {notes && (
                    <button
                      className="file-note-add"
                      aria-label={t('diffNotes.comment', { line: n })}
                      title={t('diffNotes.comment', { line: n })}
                      tabIndex={n === gutterLine ? 0 : -1}
                      onFocus={() => setGutterLine(n)}
                      onClick={(e) => start(n, e.shiftKey)}
                      onKeyDown={(e) => onGutterKey(e, n)}
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
    </div>
  )
}

/** Aller à la ligne (⌃G, menu de l'onglet). */
function GotoBar({
  count,
  onGo,
  onClose
}: {
  count: number
  onGo: (line: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  return (
    <div className="file-bar" data-testid="file-goto-bar">
      <input
        autoFocus
        inputMode="numeric"
        aria-label={t('files.goToLinePrompt')}
        placeholder={t('files.goToLine')}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        onBlur={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          } else if (e.key === 'Enter') {
            const n = Number(value)
            if (n > 0) onGo(Math.min(n, count))
            else onClose()
          }
        }}
        data-testid="file-goto"
      />
    </div>
  )
}

/**
 * Recherche dans le fichier ouvert (⌘F, Q48) : le premier résultat est amené dès la frappe ; ↵ et ↓
 * suivant, ⇧↵ et ↑ précédent, Échap et ✕ ferment.
 */
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
  const [at, setAt] = useState(0)
  const needle = query.toLowerCase()
  const found = useMemo(
    () =>
      needle
        ? lines.flatMap((line, i) => (line.toLowerCase().includes(needle) ? [i + 1] : []))
        : [],
    [lines, needle]
  )
  const go = (index: number) => {
    if (found.length === 0) return
    const next = (index + found.length) % found.length
    setAt(next)
    const line = found[next]
    if (line) onShow(line)
  }
  const type = (value: string) => {
    setQuery(value)
    setAt(0)
    const lower = value.toLowerCase()
    const first = value ? lines.findIndex((line) => line.toLowerCase().includes(lower)) : -1
    if (first >= 0) onShow(first + 1)
  }
  const count = needle
    ? found.length
      ? t('files.findCount', { at: at + 1, count: found.length })
      : t('files.findNone')
    : ''
  const button = (label: string, icon: ReactNode, run: () => void, testId: string, off = false) => (
    <Tip label={label}>
      <button
        className="icon-button small"
        aria-label={label}
        disabled={off}
        onClick={run}
        data-testid={testId}
      >
        {icon}
      </button>
    </Tip>
  )
  return (
    <div className="file-bar" role="search" data-testid="file-find-bar">
      <input
        autoFocus
        aria-label={t('files.find')}
        placeholder={t('files.find')}
        value={query}
        onChange={(e) => type(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            go(at + (e.shiftKey ? -1 : 1))
          }
        }}
        data-testid="file-find"
      />
      <span className="file-find-count" aria-live="polite" data-testid="file-find-count">
        {count}
      </span>
      {button(
        t('files.findPrevious'),
        <ChevronUp size={14} />,
        () => go(at - 1),
        'file-find-previous',
        found.length === 0
      )}
      {button(
        t('files.findNext'),
        <ChevronDown size={14} />,
        () => go(at + 1),
        'file-find-next',
        found.length === 0
      )}
      {button(t('files.findClose'), <X size={14} />, onClose, 'file-find-close')}
    </div>
  )
}
