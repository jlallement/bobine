import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ipcErrorText } from '../../ipc-errors'
import { handoverMessageCount, type HandoverTarget } from '@shared/handover'
import { shortModelName } from '@shared/models'

/** Ligne choisie dans « Continuer avec » : l'agent, et le modèle s'il en a choisi un. */
export interface HandoverChoice {
  target: HandoverTarget
  model?: string
}

/**
 * Confirmation avant de continuer avec un autre agent (fiche 108) : le modèle (modifiable), où
 * partiront les messages (agent, modèle, fournisseur et adresse, ou service de l'agent), ce qui
 * part et quand, et ce qui s'arrête. Rien ne part avant le prochain message de l'utilisateur.
 */
export function HandoverDialog({
  conversationId,
  fromLabel,
  choice,
  onClose
}: {
  conversationId: string
  /** Agent d'avant, qui ne recevra plus rien. */
  fromLabel: string
  choice: HandoverChoice
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { target } = choice
  const [model, setModel] = useState(choice.model ?? '')
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.api.conversations
      .view(conversationId)
      .then((view) => alive && setCount(handoverMessageCount(view.transcript.items)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversationId])

  const chosen = target.models.find((m) => m.value === model)
  const destination = chosen?.destination ?? target.destination
  const agent = target.label
  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await window.api.conversations.continueWith(
        conversationId,
        target.profileId,
        model || undefined
      )
      onClose()
    } catch (e) {
      setError(ipcErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog confirm-dialog handover-dialog"
          data-testid="handover-dialog"
        >
          <Dialog.Title className="confirm-title">
            {t('handover.dialog.title', { agent })}
          </Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('handover.dialog.description', { agent })}
          </Dialog.Description>
          {target.models.length > 0 && (
            <label className="form-field">
              <span className="field-label">{t('handover.dialog.model')}</span>
              <select
                className="field-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={busy}
                data-testid="handover-model"
              >
                <option value="">{t('handover.dialog.defaultModel', { agent })}</option>
                {target.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <section className="handover-where" data-testid="handover-where">
            <div className="handover-where-title">{t('handover.dialog.whereTitle')}</div>
            <dl>
              <dt>{t('handover.dialog.agent')}</dt>
              <dd>{agent}</dd>
              {target.models.length > 0 && (
                <>
                  <dt>{t('handover.dialog.model')}</dt>
                  <dd>
                    {chosen
                      ? shortModelName(chosen.name)
                      : t('handover.dialog.unknownModel', { agent })}
                  </dd>
                </>
              )}
              {destination.kind === 'provider' && (
                <>
                  <dt>{t('handover.dialog.provider')}</dt>
                  <dd>{destination.name}</dd>
                  <dt>{t('handover.dialog.address')}</dt>
                  <dd>
                    <code>{destination.url}</code>
                  </dd>
                </>
              )}
              {destination.kind === 'prefix' && (
                <>
                  <dt>{t('handover.dialog.provider')}</dt>
                  <dd>{t('handover.dialog.prefix', { provider: destination.provider, agent })}</dd>
                </>
              )}
              {destination.kind === 'agent' && (
                <>
                  <dt>{t('handover.dialog.service')}</dt>
                  <dd>{destination.text}</dd>
                </>
              )}
            </dl>
          </section>
          {count !== null && (
            <p className="confirm-text" data-testid="handover-sent">
              {t('handover.dialog.sent', { count })}
            </p>
          )}
          <p className="confirm-text">{t('handover.dialog.stops', { agent: fromLabel })}</p>
          {error && (
            <p className="field-error" role="alert" data-testid="handover-error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <Dialog.Close className="btn ghost" disabled={busy}>
              {t('common.cancel')}
            </Dialog.Close>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void confirm()}
              autoFocus
              data-testid="handover-confirm"
            >
              {busy
                ? t('handover.dialog.switching', { agent })
                : t('handover.dialog.confirm', { agent })}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
