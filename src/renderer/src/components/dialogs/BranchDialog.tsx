import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import type { BranchPreview } from '@shared/agent'
import { useTranslation } from 'react-i18next'

const basename = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

/**
 * Repartir d'un message alors que l'agent a modifié des fichiers depuis (fiche 023) : on propose de
 * les remettre dans leur état d'alors, comme le « Rewind » de Claude Code. Un fichier modifié
 * depuis par quelqu'un d'autre n'est jamais touché ; les commandes lancées ne s'annulent pas.
 */
export function BranchDialog({
  preview,
  onClose,
  onConfirm
}: {
  preview: BranchPreview
  onClose: () => void
  onConfirm: (options: { restoreFiles: boolean }) => void
}) {
  const { t } = useTranslation()
  const restorable = preview.files.filter((f) => f.status === 'restore')
  const untouched = preview.files.filter((f) => f.status === 'conflict' || f.status === 'outside')
  const [restore, setRestore] = useState(restorable.length > 0)
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog confirm-dialog" data-testid="branch-dialog">
          <Dialog.Title className="confirm-title">{t('branchDialog.title')}</Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('branchDialog.description')}
          </Dialog.Description>
          {restorable.length > 0 && (
            <label className="confirm-option">
              <input
                type="checkbox"
                checked={restore}
                onChange={(e) => setRestore(e.target.checked)}
                data-testid="branch-restore"
              />
              <span>
                {t('branchDialog.restore', { count: restorable.length })}
                <ul className="confirm-files" data-testid="branch-files">
                  {restorable.map((f) => (
                    <li key={f.path} title={f.path}>
                      <code>{basename(f.path)}</code>
                      {f.created && (
                        <span className="muted"> {t('branchDialog.createdSince')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </span>
            </label>
          )}
          {untouched.length > 0 && (
            <p className="confirm-text confirm-warning" data-testid="branch-conflicts">
              {t('branchDialog.untouched', {
                files: untouched.map((f) => basename(f.path)).join(', ')
              })}
            </p>
          )}
          {preview.commands > 0 && (
            <p className="confirm-text muted" data-testid="branch-commands">
              {t('branchDialog.commands', { count: preview.commands })}
            </p>
          )}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost">{t('common.cancel')}</Dialog.Close>
            <button
              className="btn primary"
              autoFocus
              onClick={() => onConfirm({ restoreFiles: restore && restorable.length > 0 })}
              data-testid="branch-confirm"
            >
              {t('branchDialog.confirm')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
