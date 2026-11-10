import { ChevronDown, ChevronRight, FolderOpen, SquareArrowOutUpRight, Undo2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import {
  splitPath,
  type conversationChanges,
  type GitFileDiff,
  type TextChange
} from '@shared/changes'
import { DiffView, type DiffAnnotations } from '../thread/DiffView'
import { Tip } from '../common/Menus'
import { countText } from '@shared/i18n/format'

/** Une ligne de la liste, quelle que soit la vue. */
export interface Row {
  key: string
  /** Chemin montré (relatif au dossier quand il y est). */
  path: string
  /** Chemin à ouvrir ; absent si le fichier est hors du dossier ou supprimé. */
  openable?: string
  badge?: { letter: string; label: string; tone: 'add' | 'mod' | 'del' }
  added: number | null
  removed: number | null
}

/**
 * Fichiers de l'onglet Modifications (fiche 021), vue conversation ou git : une ligne par fichier,
 * ses actions (annuler, ouvrir, afficher) et son diff déplié. Sorti de `ChangesTab` (fiche 161).
 */
export function ChangesFileList({
  view,
  rows,
  open,
  onToggle,
  unchecked,
  onCheck,
  reverted,
  reverting,
  setReverting,
  onRevert,
  onAct,
  conversation,
  gitDiffs,
  annotationsFor
}: {
  view: 'conversation' | 'git'
  rows: Row[]
  open: ReadonlySet<string>
  onToggle: (row: Row) => void
  unchecked: ReadonlySet<string>
  onCheck: (path: string, on: boolean) => void
  reverted: ReadonlySet<string>
  reverting: string | null
  setReverting: (key: string | null) => void
  onRevert: (path: string) => void
  onAct: (action: 'open' | 'reveal', path: string) => void
  conversation: ReturnType<typeof conversationChanges>
  gitDiffs: Record<string, GitFileDiff | { error: string }>
  annotationsFor: (anchor: DiffAnnotations['anchor']) => DiffAnnotations | undefined
}) {
  const { t } = useTranslation()
  return (
    <ul className="changes-list">
      {rows.map((row) => {
        const { dir, name } = splitPath(row.path)
        const expanded = open.has(row.key)
        return (
          <li key={row.key} className="changes-file" data-testid="changes-file">
            <div className="changes-row">
              {view === 'git' && (
                <input
                  type="checkbox"
                  className="changes-check"
                  checked={!unchecked.has(row.key)}
                  onChange={(e) => onCheck(row.key, e.target.checked)}
                  aria-label={t('worktreeCycle.commit.select', { path: row.path })}
                  data-testid="changes-check"
                />
              )}
              <button
                className="changes-toggle"
                onClick={() => onToggle(row)}
                aria-expanded={expanded}
                title={row.path}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {row.badge && (
                  <span className={`changes-badge ${row.badge.tone}`} title={row.badge.label}>
                    {row.badge.letter}
                  </span>
                )}
                <span className="changes-name">{name}</span>
                <span className="changes-dir">{dir}</span>
              </button>
              <span className="changes-stats">
                {row.added === null ? (
                  <span className="muted">{t('changes.binaryBadge')}</span>
                ) : (
                  <>
                    <span className="diff-added">+{countText(row.added)}</span>{' '}
                    <span className="diff-removed">−{countText(row.removed ?? 0)}</span>
                  </>
                )}
              </span>
              {view === 'conversation' &&
                (reverted.has(row.key) ? (
                  <span className="muted changes-reverted" data-testid="changes-reverted">
                    {t('changes.reverted')}
                  </span>
                ) : (
                  <Tip label={t('changes.revert')}>
                    <button
                      className={`icon-button small${reverting === row.key ? ' active' : ''}`}
                      aria-label={t('changes.revertLabel', { path: row.path })}
                      onClick={() => setReverting(reverting === row.key ? null : row.key)}
                      data-testid="changes-revert"
                    >
                      <Undo2 size={13} />
                    </button>
                  </Tip>
                ))}
              <Tip label={t('changes.open')}>
                <button
                  className="icon-button small"
                  aria-label={t('changes.openLabel', { path: row.path })}
                  disabled={!row.openable}
                  onClick={() => row.openable && onAct('open', row.openable)}
                  data-testid="changes-open"
                >
                  <SquareArrowOutUpRight size={13} />
                </button>
              </Tip>
              <Tip label={t('changes.reveal')}>
                <button
                  className="icon-button small"
                  aria-label={t('changes.revealLabel', { path: row.path })}
                  disabled={!row.openable}
                  onClick={() => row.openable && onAct('reveal', row.openable)}
                >
                  <FolderOpen size={13} />
                </button>
              </Tip>
            </div>
            {reverting === row.key && (
              <div className="changes-confirm" data-testid="changes-revert-ask">
                <span>
                  <Trans
                    t={t}
                    i18nKey="changes.revertAsk"
                    values={{ name }}
                    components={{ strong: <strong /> }}
                  />
                  {conversation.find((f) => f.path === row.key)?.created
                    ? ` ${t('changes.revertCreated')}`
                    : ''}
                </span>
                <button
                  className="btn small primary"
                  onClick={() => onRevert(row.key)}
                  data-testid="changes-revert-confirm"
                >
                  {t('changes.revertConfirm')}
                </button>
                <button className="btn small ghost" onClick={() => setReverting(null)}>
                  {t('changes.keep')}
                </button>
              </div>
            )}
            {expanded && (
              <div className="changes-diff" data-testid="changes-diff">
                {view === 'conversation' ? (
                  <ConversationDiffs
                    path={row.path}
                    diffs={conversation.find((f) => f.path === row.key)?.diffs ?? []}
                    annotate={(change) =>
                      annotationsFor({
                        view: 'conversation',
                        file: row.key,
                        path: row.path,
                        change
                      })
                    }
                  />
                ) : (
                  <GitDiff
                    path={row.path}
                    diff={gitDiffs[row.key]}
                    annotations={annotationsFor({
                      view: 'git',
                      file: row.key,
                      path: row.key
                    })}
                  />
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ConversationDiffs({
  path,
  diffs,
  annotate
}: {
  path: string
  diffs: TextChange[]
  /** Remarques du diff de chaque modification (rang 0, 1…). */
  annotate: (change: number) => DiffAnnotations | undefined
}) {
  const { t } = useTranslation()
  return (
    <>
      {diffs.map((change, i) => {
        const annotations = annotate(i)
        return (
          <div key={i}>
            {diffs.length > 1 && (
              <div className="changes-caption">
                {t('changes.changeOf', { index: i + 1, total: diffs.length })}
              </div>
            )}
            <DiffView
              path={path}
              oldText={change.oldText}
              newText={change.newText}
              bare
              {...(annotations ? { annotations } : {})}
            />
          </div>
        )
      })}
    </>
  )
}

function GitDiff({
  path,
  diff,
  annotations
}: {
  path: string
  diff?: GitFileDiff | { error: string }
  annotations?: DiffAnnotations | undefined
}) {
  const { t } = useTranslation()
  if (!diff) return <div className="changes-caption">{t('changes.loading')}</div>
  if ('error' in diff) return <div className="browser-error">{diff.error}</div>
  if (diff.binary) return <div className="changes-caption">{t('changes.binary')}</div>
  if (diff.tooLarge) return <div className="changes-caption">{t('changes.tooLarge')}</div>
  return (
    <DiffView
      path={path}
      oldText={diff.oldText}
      newText={diff.newText ?? ''}
      bare
      {...(annotations ? { annotations } : {})}
    />
  )
}
