import { TriangleExclamationPoint } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { translate } from '@shared/i18n/message'
import { proposeCommitMessage, type MainDirty, type StashOutcome } from '@shared/worktree-cycle'
import { CommitForm } from './CommitForm'

/** Fichiers montrés, au plus ; les autres sont comptés. */
const MAX_SHOWN = 6

/**
 * « Fusion refusée » (fiche 123) : le dossier principal, où la base est extraite, a des
 * modifications non commitées. Dit lesquelles et pourquoi, puis « Committer d'abord » (message
 * proposé, puis la fusion part) ou « Mettre de côté » (`git stash` le temps de la fusion). Dans la
 * carte « Sous-tâches » comme dans la barre d'un worktree.
 */
export function MainDirtyCard({
  dirty,
  busy,
  onCommit,
  onStash,
  children
}: {
  dirty: MainDirty
  busy: boolean
  /** « Committer puis fusionner » : ces fichiers, avec ce message, dans le dossier principal. */
  onCommit: (message: string, files: string[]) => void
  onStash: () => void
  /** Boutons de plus, après les deux actions (« Puis nettoyer »). */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [committing, setCommitting] = useState(false)
  const count = dirty.files.length
  const more = count - MAX_SHOWN
  return (
    <div className="main-dirty" data-testid="main-dirty">
      <div className="main-dirty-title" data-testid="main-dirty-title">
        <TriangleExclamationPoint size={13} />
        {t('worktreeCycle.mainDirty.title', { count })}
      </div>
      <ul
        className="main-dirty-files"
        aria-label={t('worktreeCycle.mainDirty.files')}
        title={dirty.root}
      >
        {dirty.files.slice(0, MAX_SHOWN).map((file) => (
          <li key={file.path} data-testid="main-dirty-file">
            {file.path}
          </li>
        ))}
        {more > 0 && (
          <li className="muted" data-testid="main-dirty-more">
            {t('worktreeCycle.mainDirty.more', { count: more })}
          </li>
        )}
      </ul>
      <div className="main-dirty-why" data-testid="main-dirty-why">
        {t('worktreeCycle.mainDirty.why', { count, base: dirty.base })}
      </div>
      {committing ? (
        <CommitForm
          proposed={proposeCommitMessage(dirty.title ?? '', dirty.files)}
          busy={busy}
          testid="main-dirty-commit"
          confirmLabel={t('worktreeCycle.mainDirty.commitConfirm')}
          onCommit={(message) =>
            onCommit(
              message,
              dirty.files.map((f) => f.path)
            )
          }
          onCancel={() => setCommitting(false)}
        />
      ) : (
        <div className="main-dirty-actions">
          <button
            className="btn small"
            disabled={busy}
            onClick={() => setCommitting(true)}
            data-testid="main-dirty-commit"
          >
            {t('worktreeCycle.mainDirty.commit')}
          </button>
          <button
            className="btn small"
            disabled={busy}
            title={t('worktreeCycle.mainDirty.stashHint')}
            onClick={onStash}
            data-testid="main-dirty-stash"
          >
            {t('worktreeCycle.mainDirty.stash')}
          </button>
          {children}
        </div>
      )}
    </div>
  )
}

/** Ce que la remise des modifications mises de côté a donné, en une phrase. */
export function stashSentence(outcome: StashOutcome): string {
  if (outcome.restored) {
    return translate({
      key: 'worktreeCycle.mainDirty.stashRestored',
      params: { count: outcome.count }
    })
  }
  return outcome.conflicts.length > 0
    ? translate({
        key: 'worktreeCycle.mainDirty.stashFailed',
        params: { files: outcome.conflicts.join(', '), ref: outcome.ref }
      })
    : translate({ key: 'worktreeCycle.mainDirty.stashKept', params: { ref: outcome.ref } })
}
