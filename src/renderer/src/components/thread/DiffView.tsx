import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { computeDiff, diffText, firstChangedLine, type DiffLine, type DiffRow } from '@shared/diff'
import { diffSegments } from '@shared/display-cap'
import type { DiffNote } from '@shared/diff-notes'
import { useTranslation } from 'react-i18next'
import { useDisplayPath } from '../../presentation'
import { filePathParts } from '@shared/tool-label'
import { visibleText } from '@shared/command-view'
import { WorkspaceContext } from './workspace-context'
import i18next from 'i18next'
import { EditorContext, OpenInEditorButton } from './OpenInEditor'
import { CappedRows } from './DiffCap'
import { countText } from '@shared/i18n/format'

/**
 * Remarques sur ce diff (fiche 085) : « + » au survol de chaque ligne (Maj-clic sur une autre ligne
 * du même côté : une plage), remarques affichées sous leur dernière ligne.
 */
export interface DiffAnnotations {
  /** Remarques posées sur ce diff. */
  notes: DiffNote[]
  /** Ce qui identifie ce diff dans une nouvelle remarque. */
  anchor: Pick<DiffNote, 'view' | 'file' | 'path' | 'change'>
  onSave: (note: DiffNote) => void
  onDelete: (id: string) => void
}

interface Props {
  path: string
  oldText?: string | null
  newText: string
  /** Sans l'en-tête (chemin, +/−) : le récapitulatif des modifications l'affiche déjà. */
  bare?: boolean
  annotations?: DiffAnnotations
}

/**
 * Chemin du fichier dans l'en-tête d'un diff (fiche 203) : relatif au dossier de la conversation,
 * sinon avec `~`. Le début (grisé) est coupé PAR LE DÉBUT s'il ne tient pas (« …/src/ »), le nom
 * jamais (sauf un nom seul plus large que la carte : coupé à la fin) ; le chemin entier en
 * infobulle. Coupe par le début : `direction: rtl` sur le dossier, son texte isolé en LTR
 * (`<bdi dir="ltr">`) et passé par `visibleText` — un caractère bidi du chemin, rendu visible, ne
 * peut pas retourner l'affichage. Carte trop étroite pour le nom, le badge et les compteurs : ces
 * deux-là passent à la ligne plutôt que de couper le nom.
 */
function FilePath({ path }: { path: string }) {
  const workspace = useContext(WorkspaceContext)
  const displayPath = useDisplayPath()
  const { dir, name } = filePathParts(path, workspace)
  const full = visibleText(displayPath(path))
  // `display: contents` : le dossier et le nom sont des éléments de l'en-tête (voir styles.css).
  return (
    <span className="diff-path" title={full} data-testid="diff-path">
      {dir && (
        <span className="diff-path-dir" title={full}>
          <bdi dir="ltr">{dir}</bdi>
        </span>
      )}
      <span className="diff-path-name" title={full}>
        {name}
      </span>
    </span>
  )
}

/** Identifiant d'une nouvelle remarque. */
function newNoteId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const unchanged = (n: number) => i18next.t('diff.unchanged', { count: n, n: countText(n) })

/** Côté et numéro d'une ligne : l'ancien texte pour une ligne supprimée, le nouveau sinon. */
const lineOf = (row: DiffLine): { side: 'new' | 'old'; line: number } =>
  row.type === 'del' ? { side: 'old', line: row.oldNo } : { side: 'new', line: row.newNo }

interface Draft {
  /** Remarque modifiée ; absente pour une nouvelle. */
  id?: string
  side: 'new' | 'old'
  from: number
  to: number
  text: string
}

/** Diff ligne à ligne : numéros ancien / nouveau, ajouts et suppressions colorés, contexte replié. */
export function DiffView({ path, oldText, newText, bare, annotations }: Props) {
  const { t } = useTranslation()
  const diff = useMemo(() => computeDiff(oldText, newText), [oldText, newText])
  const editorAction = useContext(EditorContext)
  const isNew = oldText == null
  const [draft, setDraft] = useState<Draft | null>(null)
  const lines = diff.rows.filter((row): row is DiffLine => row.type !== 'skip')
  const columns = annotations ? 4 : 3

  /** Code affiché sur les lignes `from` à `to` d'un côté. */
  const codeOf = (side: 'new' | 'old', from: number, to: number) =>
    lines
      .filter((row) => {
        const at = lineOf(row)
        return at.side === side && at.line >= from && at.line <= to
      })
      .map((row) => row.text)
      .join('\n')

  const start = (row: DiffLine, extend: boolean) => {
    const at = lineOf(row)
    if (extend && draft && !draft.id && draft.side === at.side) {
      setDraft({
        ...draft,
        from: Math.min(draft.from, draft.to, at.line),
        to: Math.max(draft.from, draft.to, at.line)
      })
    } else setDraft({ side: at.side, from: at.line, to: at.line, text: '' })
  }

  const save = () => {
    if (!annotations || !draft || !draft.text.trim()) return
    // Remarque de relecture modifiée (fiche 177) : elle garde sa gravité.
    const review = annotations.notes.find((n) => n.id === draft.id)?.review
    annotations.onSave({
      ...(review ? { review } : {}),
      ...annotations.anchor,
      id: draft.id ?? newNoteId(),
      side: draft.side,
      from: draft.from,
      to: draft.to,
      code: codeOf(draft.side, draft.from, draft.to),
      comment: draft.text.trim()
    })
    setDraft(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(null)
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  const range = (from: number, to: number) =>
    from === to ? t('diffNotes.line', { line: from }) : t('diffNotes.lines', { from, to })

  const editor = (key: string) =>
    draft && (
      <tr key={key} className="diff-note-row">
        <td colSpan={columns}>
          <div className="diff-note-editor" data-testid="diff-note-editor">
            <div className="diff-note-where">{range(draft.from, draft.to)}</div>
            <textarea
              autoFocus
              value={draft.text}
              placeholder={t('diffNotes.placeholder')}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onKeyDown={onKeyDown}
              rows={2}
              data-testid="diff-note-input"
            />
            <div className="diff-note-actions">
              <button className="btn small ghost" onClick={() => setDraft(null)}>
                {t('diffNotes.cancel')}
              </button>
              <button
                className="btn small primary"
                onClick={save}
                disabled={!draft.text.trim()}
                data-testid="diff-note-save"
              >
                {draft.id ? t('diffNotes.update') : t('diffNotes.add')}
              </button>
            </div>
          </div>
        </td>
      </tr>
    )

  const noteRow = (note: DiffNote) =>
    draft?.id === note.id ? (
      editor(`edit-${note.id}`)
    ) : (
      <tr key={`note-${note.id}`} className="diff-note-row">
        <td colSpan={columns}>
          <div className="diff-note" data-testid="diff-note">
            <div className="diff-note-where">
              {note.review && (
                <span
                  className={`review-severity ${note.review.severity}`}
                  data-testid="diff-note-severity"
                >
                  {t(`review.severity.${note.review.severity}`)}
                </span>
              )}{' '}
              {range(note.from, note.to)}
            </div>
            <div className="diff-note-text">{note.comment}</div>
            <div className="diff-note-tools">
              <button
                className="icon-button small"
                aria-label={t('diffNotes.edit')}
                title={t('diffNotes.edit')}
                data-testid="diff-note-edit"
                onClick={() =>
                  setDraft({
                    id: note.id,
                    side: note.side,
                    from: note.from,
                    to: note.to,
                    text: note.comment
                  })
                }
              >
                <Pencil size={13} />
              </button>
              <button
                className="icon-button small"
                aria-label={t('diffNotes.delete')}
                title={t('diffNotes.delete')}
                onClick={() => annotations?.onDelete(note.id)}
                data-testid="diff-note-delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </td>
      </tr>
    )

  // Remarques dont la dernière ligne n'est plus dans le diff (fichier changé depuis) : à la fin.
  const lineKeys = new Set(lines.map((row) => `${lineOf(row).side}:${lineOf(row).line}`))
  const leftover = (annotations?.notes ?? []).filter(
    (note) => !lineKeys.has(`${note.side}:${note.to}`)
  )
  const rowNodes = (row: DiffRow, i: number): ReactNode[] => {
    if (row.type === 'skip') {
      return [
        <tr key={i} className="diff-skip">
          <td colSpan={columns}>⋯ {unchanged(row.count)}</td>
        </tr>
      ]
    }
    const at = lineOf(row)
    const selected =
      draft && !draft.id && draft.side === at.side && at.line >= draft.from && at.line <= draft.to
    const label = t('diffNotes.comment', { line: at.line })
    const out: ReactNode[] = [
      <tr
        key={i}
        className={`diff-${row.type}${selected ? ' diff-selected' : ''}`}
        data-side={at.side}
        data-line={at.line}
      >
        {annotations && (
          <td className="diff-gutter">
            <button
              className="diff-note-add"
              aria-label={label}
              title={label}
              onClick={(e) => start(row, e.shiftKey)}
              data-testid="diff-note-add"
            >
              <MessageSquarePlus size={12} />
            </button>
          </td>
        )}
        <td className="diff-no">{row.type === 'add' ? '' : row.oldNo}</td>
        <td className="diff-no">{row.type === 'del' ? '' : row.newNo}</td>
        <td className="diff-code">
          <span className="diff-sign">
            {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}
          </span>
          {row.text}
        </td>
      </tr>
    ]
    for (const note of annotations?.notes ?? []) {
      if (note.side === at.side && note.to === at.line) out.push(noteRow(note))
    }
    if (draft && !draft.id && draft.side === at.side && draft.to === at.line) {
      out.push(editor(`draft-${i}`))
    }
    return out
  }
  // Gros diff (fiche 192) : plafonné par tranche, « Afficher tout » ; ancien puis nouveau en bloc.
  const segments = diffSegments(diff.rows, diff.simplified)
  const offsets = segments.map((_, k) =>
    segments.slice(0, k).reduce((n, s) => n + s.rows.length, 0)
  )
  // Trop gros pour tout afficher : le diff entier dans l'éditeur, par un fichier de l'app.
  const openWhole = editorAction?.openText
    ? { label: t('editor.open', { editor: editorAction.name }), open: editorAction.openText }
    : undefined
  const whole = () => diffText(path, oldText, newText)

  return (
    <div className={`diff${bare ? ' bare' : ''}`}>
      {!bare && (
        <div className="diff-header">
          <FilePath path={path} />
          <OpenInEditorButton path={path} line={firstChangedLine(diff.rows)} />
          <span className="diff-meta">
            {isNew && <span className="diff-badge">{t('diff.newFile')}</span>}
            <span className="diff-stats">
              <span className="diff-added">+{countText(diff.added)}</span>{' '}
              <span className="diff-removed">−{countText(diff.removed)}</span>
            </span>
          </span>
        </div>
      )}
      {diff.simplified && (
        <div className="diff-note-simplified" role="note" data-testid="diff-simplified">
          {t('diff.simplified')}
        </div>
      )}
      {diff.rows.length === 0 ? (
        <p className="diff-empty">{t('diff.empty')}</p>
      ) : (
        <table className={`diff-table${annotations ? ' annotated' : ''}`}>
          <tbody>
            {segments.map((segment, k) => (
              <CappedRows
                key={`${k}-${segment.kind}`}
                segment={segment}
                offset={offsets[k] ?? 0}
                columns={columns}
                renderRow={rowNodes}
                whole={whole}
                openInEditor={openWhole}
              />
            ))}
            {leftover.map(noteRow)}
          </tbody>
        </table>
      )}
    </div>
  )
}
