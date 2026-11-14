import * as Dialog from '@radix-ui/react-dialog'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { RoleView } from '@shared/roles'
import { ipcErrorText } from '../../ipc-errors'
import { RoleAvatar } from './RoleAvatar'

/**
 * « Confier à <rôle> » (fiche 223, section Équipe et « Créer et essayer ») : une consigne, puis
 * une conversation fille de la conversation active avec ce rôle (`startChild` avec `role`, comme
 * « Lancer en parallèle… » de la fiche 097). L'agent, le mode et le modèle sont ceux du rôle :
 * rien n'est choisi ici. La conversation affichée ne change pas ; la fille apparaît sous sa mère.
 */
export function RoleChildDialog({
  role,
  mother: from,
  onClose
}: {
  role: RoleView
  /** Conversation active ; absente : rien à quoi rattacher la fille, c'est dit. */
  mother: ConversationSummary | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  // Conversation encore vide : une fille ne s'y rattache pas (refus du main), c'est dit d'emblée.
  const mother = from && !from.draft ? from : null
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const launch = async () => {
    if (!mother || !text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.conversations.startChild(mother.id, { text, role: role.name })
      onClose()
    } catch (e) {
      setError(ipcErrorText(e))
      setBusy(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void launch()
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog confirm-dialog role-child-dialog"
          data-testid="role-child-dialog"
          data-role={role.name}
        >
          <div className="role-child-head">
            <RoleAvatar role={role} size={44} />
            <Dialog.Title className="confirm-title">
              {t('team.child.title', { label: role.label })}
            </Dialog.Title>
          </div>
          <Dialog.Description className="confirm-text">
            {mother
              ? t('team.child.description', { title: mother.title })
              : from
                ? t('team.child.draft')
                : t('team.child.noConversation')}
          </Dialog.Description>
          {mother && (
            <label className="form-field">
              <span className="field-label">{t('team.child.prompt')}</span>
              <textarea
                className="field-input"
                rows={5}
                autoFocus
                value={text}
                placeholder={t('team.child.placeholder')}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                data-testid="role-child-prompt"
              />
            </label>
          )}
          {role.readOnly && mother && (
            <p className="field-help" data-testid="role-child-read-only">
              {t('team.child.readOnly')}
            </p>
          )}
          {error && (
            <p className="field-error" role="alert" data-testid="role-child-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost" disabled={busy}>
              {mother ? t('common.cancel') : t('common.close')}
            </Dialog.Close>
            {mother && (
              <button
                className="btn primary"
                disabled={!text.trim() || busy}
                onClick={() => void launch()}
                data-testid="role-child-launch"
              >
                {busy ? t('children.dialog.launching') : t('team.child.launch')}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
