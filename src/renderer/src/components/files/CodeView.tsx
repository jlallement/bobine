import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import {
  Fragment,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffNote } from '@shared/diff-notes'
import type { CodeLine } from '../../code-lines'
import { placeNotes } from '../../file-notes'
import { FILE_FIND_EVENT, FILE_GOTO_EVENT } from '../../files-state'
import { FileFind, GotoBar } from './CodeBars'

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
  /** Texte de départ (remarque modifiée) ; la saisie vit dans l'éditeur (C7). */
  text: string
  /**
   * Code cité, figé quand les lignes sont choisies (C5) : un fichier relu pendant la saisie ne
   * change pas ce que la remarque cite.
   */
  code: string
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

/** Durée de l'éclair d'une ligne (l'animation CSS en dure 1,5 s). */
const FLASH_MS = 1600

/**
 * Éclaire une ligne un instant (point 6). Retirée à la fin de l'animation, ou au plus tard après
 * `FLASH_MS` : sans animation (mouvement réduit), elle s'éteint quand même et ne s'accumule pas
 * (C9).
 */
export function flashLine(row: HTMLElement): void {
  const timers = row as HTMLElement & { flashTimer?: ReturnType<typeof setTimeout> }
  clearTimeout(timers.flashTimer)
  row.classList.remove('flash')
  void row.offsetWidth
  row.classList.add('flash')
  const off = () => {
    clearTimeout(timers.flashTimer)
    row.classList.remove('flash')
  }
  row.addEventListener('animationend', off, { once: true })
  timers.flashTimer = setTimeout(off, FLASH_MS)
}

/** Ce que fait une ligne de code, stable d'un rendu à l'autre (les lignes sont mémoïsées, C7). */
interface LineHandlers {
  start: (line: number, extend: boolean) => void
  gutterFocus: (line: number) => void
  gutterKey: (event: KeyboardEvent<HTMLButtonElement>, line: number) => void
}

/** Une ligne de code : redessinée seulement si elle change (pas à chaque touche, C7). */
const CodeLineRow = memo(function CodeLineRow(props: {
  n: number
  tokens: CodeLine
  raw: string
  wrap: boolean
  selected: boolean
  noted: boolean
  notes: boolean
  tabStop: boolean
  handlers: LineHandlers
}) {
  const { t } = useTranslation()
  const { n, tokens, handlers } = props
  const classes = ['file-line', props.selected ? 'selected' : '', props.noted ? 'noted' : '']
  // Retrait suspendu : la suite d'une ligne repliée s'aligne sur son indentation (point 5).
  const style = props.wrap
    ? ({ '--hang': `${indentOf(props.raw) + 2}ch` } as CSSProperties)
    : undefined
  return (
    <div className={classes.filter(Boolean).join(' ')} data-line={n} style={style}>
      <span className="file-gutter">
        {props.notes && (
          <button
            className="file-note-add"
            aria-label={t('diffNotes.comment', { line: n })}
            title={t('diffNotes.comment', { line: n })}
            tabIndex={props.tabStop ? 0 : -1}
            onFocus={() => handlers.gutterFocus(n)}
            onClick={(e) => handlers.start(n, e.shiftKey)}
            onKeyDown={(e) => handlers.gutterKey(e, n)}
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
  )
})

/** Éditeur d'une remarque : sa saisie lui appartient, les lignes ne la voient pas (C7). */
function DraftEditor({
  draft,
  range,
  onSave,
  onCancel
}: {
  draft: Draft
  range: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(draft.text)
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (text.trim()) onSave(text.trim())
    }
  }
  return (
    <div className="file-note-row">
      <div className="diff-note-editor" data-testid="file-note-editor">
        <div className="diff-note-where">{range}</div>
        <textarea
          autoFocus
          value={text}
          placeholder={t('diffNotes.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          data-testid="file-note-input"
        />
        <div className="diff-note-actions">
          <button className="btn small ghost" onClick={onCancel}>
            {t('diffNotes.cancel')}
          </button>
          <button
            className="btn small primary"
            onClick={() => onSave(text.trim())}
            disabled={!text.trim()}
            data-testid="file-note-save"
          >
            {draft.id ? t('diffNotes.update') : t('diffNotes.add')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Une remarque placée sous ses lignes (ou en fin de fichier si son code a changé). */
function NoteCard({
  placed,
  range,
  onEdit,
  onDelete
}: {
  placed: ReturnType<typeof placeNotes>[number]
  range: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="file-note-row">
      <div className="diff-note" data-testid="file-note">
        <div className="diff-note-where">
          {range}
          {!placed.to && (
            <span className="file-note-moved">
              {' · '}
              {t('files.noteChanged')}
            </span>
          )}
        </div>
        <div className="diff-note-text">{placed.note.comment}</div>
        <div className="diff-note-tools">
          <button
            className="icon-button small"
            aria-label={t('diffNotes.edit')}
            title={t('diffNotes.edit')}
            onClick={onEdit}
          >
            <Pencil size={13} />
          </button>
          <button
            className="icon-button small"
            aria-label={t('diffNotes.delete')}
            title={t('diffNotes.delete')}
            onClick={onDelete}
            data-testid="file-note-delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Code numéroté et coloré, en lecture seule (Q38, Q47, Q54) : numéros non sélectionnables, retour
 * à la ligne au choix (la suite d'une ligne s'aligne sur son indentation), « + » d'une ligne pour
 * une remarque (Maj-clic : une plage ; au clavier, une seule étape de tabulation dans la gouttière,
 * ↑ ↓ pour changer de ligne, + ou ↵ pour remarquer), ⌃G pour aller à une ligne, ⌘F pour chercher.
 * La ligne demandée (lien du fil, `chemin:ligne`) est amenée et éclairée un instant, puis oubliée :
 * au retour, le défilement retenu reprend (C4).
 */
export function CodeView({
  lines,
  text,
  wrap,
  name,
  line,
  notes,
  onScroll,
  onLineShown,
  initialScroll
}: {
  lines: CodeLine[]
  text: string
  wrap: boolean
  name: string
  line?: number | undefined
  notes?: CodeNotes | undefined
  onScroll?: (scroll: number) => void
  /** La ligne demandée a été montrée : l'onglet l'oublie (C4). */
  onLineShown?: (() => void) | undefined
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
    flashLine(row)
  }
  // Ligne demandée : à l'écran, puis oubliée ; sinon, à l'ouverture, la position retenue.
  const openedName = useRef<string | null>(null)
  useEffect(() => {
    const opened = openedName.current !== name
    openedName.current = name
    if (line) {
      // Pour les essais : la ligne demandée reste lisible une fois oubliée par l'onglet.
      if (box.current) box.current.dataset['asked'] = String(line)
      show(line)
      onLineShown?.()
    } else if (opened && initialScroll && box.current) box.current.scrollTop = initialScroll
    // eslint-disable-next-line react-hooks/exhaustive-deps -- à l'ouverture et à chaque ligne demandée
  }, [line, name])

  const range = (from: number, to: number) =>
    from === to ? t('diffNotes.line', { line: from }) : t('diffNotes.lines', { from, to })
  const codeOf = (from: number, to: number) => raw.slice(from - 1, to).join('\n')
  // Lues au moment de l'évènement : les poignées des lignes restent les mêmes (C7).
  const latest = useRef({ draft, codeOf, lines: lines.length })
  useEffect(() => {
    latest.current = { draft, codeOf, lines: lines.length }
  })
  const handlers = useMemo<LineHandlers>(
    () => ({
      start: (at, extend) => {
        const { draft: current, codeOf: code } = latest.current
        if (extend && current && !current.id) {
          const from = Math.min(current.from, at)
          const to = Math.max(current.to, at)
          setDraft({ ...current, from, to, code: code(from, to) })
        } else setDraft({ from: at, to: at, text: '', code: code(at, at) })
      },
      gutterFocus: (n) => setGutterLine(n),
      // Gouttière : une seule étape de tabulation, ↑ ↓ changent de ligne (point 17).
      gutterKey: (event, n) => {
        const count = latest.current.lines
        const move = (to: number) => {
          event.preventDefault()
          const next = Math.min(Math.max(to, 1), count)
          setGutterLine(next)
          box.current
            ?.querySelector<HTMLElement>(`[data-line="${next}"] [data-testid=file-note-add]`)
            ?.focus()
        }
        if (event.key === 'ArrowDown') move(n + 1)
        else if (event.key === 'ArrowUp') move(n - 1)
        else if (event.key === 'Home') move(1)
        else if (event.key === 'End') move(count)
        else if (event.key === '+' || event.key === 'Enter') {
          event.preventDefault()
          handlers.start(n, event.shiftKey)
        }
      }
    }),
    []
  )
  const save = (comment: string) => {
    if (!notes || !draft || !comment) return
    notes.onSave({
      ...notes.anchor,
      id: draft.id ?? newNoteId(),
      side: 'new',
      from: draft.from,
      to: draft.to,
      code: draft.code,
      comment
    })
    setDraft(null)
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // ⌃G : aller à la ligne (Q48) — ⌘G et ⌘L sont déjà pris dans Bobine.
    if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      setBar((b) => ({ kind: 'goto', seq: (b?.seq ?? 0) + 1 }))
    }
  }
  // Barre fermée par le clavier : il revient au code (mineur de la seconde revue).
  const closeBar = (back: boolean) => {
    setBar(null)
    if (back) box.current?.focus()
  }
  const editor = (key: string) =>
    draft && (
      <DraftEditor
        key={key}
        draft={draft}
        range={range(draft.from, draft.to)}
        onSave={save}
        onCancel={() => setDraft(null)}
      />
    )
  const noteCard = (p: (typeof placed)[number]) =>
    draft?.id === p.note.id ? (
      editor(`edit-${p.note.id}`)
    ) : (
      <NoteCard
        key={`note-${p.note.id}`}
        placed={p}
        range={range(p.note.from, p.note.to)}
        onEdit={() =>
          setDraft({
            id: p.note.id,
            from: p.note.from,
            to: p.note.to,
            text: p.note.comment,
            code: p.note.code
          })
        }
        onDelete={() => notes?.onDelete(p.note.id)}
      />
    )

  return (
    <div className="file-code-wrap">
      {bar?.kind === 'find' && (
        <FileFind key={bar.seq} lines={raw} onShow={show} onClose={closeBar} />
      )}
      {bar?.kind === 'goto' && (
        <GotoBar
          key={bar.seq}
          count={lines.length}
          onGo={(n) => {
            closeBar(true)
            show(n)
          }}
          onClose={closeBar}
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
      >
        {/* Une seule liste à plat, chaque enfant à sa clé : l'éditeur d'une remarque garde sa
            clé (`draft`) quand Maj-clic étend la plage, et donc son texte (3e revue, 2). */}
        {lines.flatMap((tokens, i) => {
          const n = i + 1
          return [
            <CodeLineRow
              key={`line-${n}`}
              n={n}
              tokens={tokens}
              raw={raw[i] ?? ''}
              wrap={wrap}
              selected={!!draft && !draft.id && n >= draft.from && n <= draft.to}
              noted={noted.has(n)}
              notes={!!notes}
              tabStop={n === gutterLine}
              handlers={handlers}
            />,
            ...(byLine.get(n) ?? []).map(noteCard),
            ...(draft && !draft.id && draft.to === n ? [editor('draft')] : [])
          ]
        })}
        {leftover.map(noteCard)}
      </div>
    </div>
  )
}
