import { Code, FolderOpen, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChildRow } from '@shared/children-rows'
import { ipcErrorText } from '../../ipc-errors'
import { useEditorAction } from '../../useEditor'
import { ConversationStateIcon } from '../common/ConversationState'
import { Tip } from '../common/Menus'
import { Branch, FileStats, VerdictBadge } from '../thread/Subtasks'

/**
 * Vue « Filles » de l'onglet Modifications (fiche 161) : les worktrees des filles directes de la
 * conversation, avec ce que dit la carte « Sous-tâches » (état, compte rendu, recommandation).
 */
export function ChildrenView({
  rows,
  onOpen,
  onReview
}: {
  rows: ChildRow[]
  onOpen: (id: string) => void
  /** « Faire relire… » une fille (fiche 177). */
  onReview?: ((id: string) => void) | undefined
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="children-view" data-testid="children-view">
      {error && <div className="browser-error">{error}</div>}
      {rows.map((row) => (
        <ChildWorktree
          key={row.child.id}
          row={row}
          onOpen={onOpen}
          onError={setError}
          // Une relecture ne se fait pas relire ; une fille qui travaille non plus (fiche 177).
          {...(onReview && !row.child.reviewOf && row.state !== 'running' ? { onReview } : {})}
        />
      ))}
    </div>
  )
}

function ChildWorktree({
  row: { child, state, report, verdict },
  onOpen,
  onError,
  onReview
}: {
  row: ChildRow
  onOpen: (id: string) => void
  onError: (message: string | null) => void
  onReview?: (id: string) => void
}) {
  const { t } = useTranslation()
  // Éditeur de Réglages › Général, sur le worktree de la fille (son dossier de travail).
  const editor = useEditorAction(child.id, { info: onError, warn: onError })
  const reveal = () => {
    onError(null)
    window.api.fileLinks
      .open(child.id, '.', { reveal: true })
      .catch((e: unknown) => onError(ipcErrorText(e)))
  }
  return (
    <div
      className="subtask-row child-worktree"
      data-testid="child-worktree"
      data-id={child.id}
      data-state={state}
    >
      <span className="subtask-info">
        <span className="subtask-title">{child.title}</span>
        <span className="subtask-meta">
          {child.branch && <Branch name={child.branch} />}
          {report && <FileStats report={report} />}
          {verdict && <VerdictBadge verdict={verdict} />}
        </span>
      </span>
      <Tip label={t(`children.state.${state}`)}>
        <span className="subtask-status" data-testid="child-worktree-state">
          <ConversationStateIcon state={state} />
        </span>
      </Tip>
      <Tip label={t('changes.reveal')}>
        <button
          className="icon-button small"
          aria-label={t('changes.children.revealLabel', { title: child.title })}
          onClick={reveal}
          data-testid="child-worktree-reveal"
        >
          <FolderOpen size={14} />
        </button>
      </Tip>
      {editor && (
        <Tip label={t('editor.open', { editor: editor.name })}>
          <button
            className="icon-button small"
            aria-label={t('changes.children.editorLabel', {
              title: child.title,
              editor: editor.name
            })}
            onClick={() => {
              onError(null)
              editor.open('.')
            }}
            data-testid="child-worktree-editor"
          >
            <Code size={14} />
          </button>
        </Tip>
      )}
      {onReview && (
        <Tip label={t('review.actionTip')}>
          <button
            className="icon-button small"
            aria-label={t('review.action')}
            onClick={() => onReview(child.id)}
            data-testid="child-worktree-review"
          >
            <ScanSearch size={14} />
          </button>
        </Tip>
      )}
      <button
        className="btn small"
        onClick={() => onOpen(child.id)}
        data-testid="child-worktree-open"
      >
        {t('children.open')}
      </button>
    </div>
  )
}
