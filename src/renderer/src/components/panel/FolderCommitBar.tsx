import { CircleCheck } from 'lucide-react'
import { CommandText } from '../common/CommandText'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { proposeCommitMessage, type CommitFile, type CommitOutcome } from '@shared/worktree-cycle'
import { ipcErrorText } from '../../ipc-errors'
import { CommitForm } from './CommitForm'

type Note = { kind: 'committed'; hash: string } | { kind: 'undone' }

/**
 * « Committer » dans la vue Git d'une conversation ordinaire, pas en worktree (fiche 123) : les
 * fichiers cochés, message proposé modifiable, « Défaire » tant que c'est le dernier commit. Le
 * même code que la barre du worktree (fiche 110), sans départ, PR ni fusion. Rien à montrer sans
 * fichier coché ni note.
 */
export function FolderCommitBar({
  title,
  selected,
  commit,
  undo,
  onChanged
}: {
  /** Titre de la conversation : d'où proposer le message. */
  title: string
  selected: CommitFile[]
  commit: (message: string, files: string[]) => Promise<CommitOutcome>
  undo: (hash: string) => Promise<unknown>
  /** Après un commit ou « Défaire » : la liste des fichiers est à relire. */
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<Note>) => {
    setBusy(true)
    setError(null)
    try {
      setNote(await action())
      setOpen(false)
      onChanged()
    } catch (e: unknown) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  if (selected.length === 0 && !note && !open && !error) return null
  return (
    <div className="worktree-bar folder-commit-bar" data-testid="changes-commit-bar">
      <div className="worktree-actions">
        <button
          className="btn small"
          disabled={selected.length === 0 || busy}
          onClick={() => setOpen(true)}
          data-testid="changes-commit"
        >
          {selected.length > 0
            ? t('worktreeCycle.commit.actionCount', { count: selected.length })
            : t('worktreeCycle.commit.action')}
        </button>
      </div>
      {open && (
        <CommitForm
          proposed={proposeCommitMessage(title, selected)}
          busy={busy}
          testid="changes-commit"
          onCommit={(message) =>
            void run(async () => {
              const done = await commit(
                message,
                selected.map((f) => f.path)
              )
              return { kind: 'committed', hash: done.hash }
            })
          }
          onCancel={() => setOpen(false)}
        />
      )}
      {error && (
        <div className="browser-error git-error" data-testid="changes-commit-error">
          <CommandText text={error} />
        </div>
      )}
      {note && (
        <div className="panel-note worktree-note" data-testid="changes-commit-note">
          <CircleCheck size={13} />
          <span>
            {note.kind === 'committed'
              ? t('worktreeCycle.commit.done', { hash: note.hash.slice(0, 7) })
              : t('worktreeCycle.commit.undone')}
          </span>
          {note.kind === 'committed' && (
            <button
              className="btn small ghost"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await undo(note.hash)
                  return { kind: 'undone' }
                })
              }
              data-testid="changes-commit-undo"
            >
              {t('worktreeCycle.commit.undo')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
