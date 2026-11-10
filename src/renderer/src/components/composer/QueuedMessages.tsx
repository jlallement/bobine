import { Clock, CornerDownLeft, Paperclip, Pencil, Split, X } from 'lucide-react'
import type { QueuedMessageView } from '@shared/agent'
import { Tip } from '../common/Menus'
import { useTranslation } from 'react-i18next'

interface Props {
  items: QueuedMessageView[]
  /** L'agent répond : « Envoyer maintenant » interrompt sa réponse. */
  busy: boolean
  onSendNow: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}

/** Messages écrits pendant une réponse, en attente de la fin du tour (fiche 020). */
export function QueuedMessages({ items, busy, onSendNow, onEdit, onRemove }: Props) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <div className="queued" data-testid="queued">
      <div className="queued-head">
        <Clock size={12} />
        {busy ? t('queued.willSend', { count: items.length }) : t('queued.interrupted')}
      </div>
      {items.map((item) => (
        <div key={item.id} className="queued-item" data-testid="queued-item">
          {item.from && item.from.kind !== 'wake' && (
            <span className="queued-origin" data-testid="queued-origin">
              <Split size={11} />
              {t(item.from.kind === 'parent' ? 'children.from.parent' : 'children.from.child', {
                title: item.from.title
              })}
            </span>
          )}
          <span className="queued-text" title={item.text}>
            {/* Le réveil de la mère (fiche 097) : sa ligne traduite, pas le texte pour l'agent. */}
            {item.from?.kind === 'wake'
              ? t('children.from.wake')
              : item.text.trim() || item.attachments.map((a) => a.name).join(', ')}
          </span>
          {item.attachments.length > 0 && (
            <span className="queued-files" title={item.attachments.map((a) => a.name).join('\n')}>
              <Paperclip size={11} />
              {item.attachments.length}
            </span>
          )}
          <Tip label={busy ? t('queued.sendNowTip') : t('queued.send')}>
            <button
              type="button"
              className="icon-button small"
              aria-label={busy ? t('queued.sendNow') : t('queued.send')}
              onClick={() => onSendNow(item.id)}
              data-testid="queued-send-now"
            >
              <CornerDownLeft size={13} />
            </button>
          </Tip>
          <Tip label={t('queued.editTip')}>
            <button
              type="button"
              className="icon-button small"
              aria-label={t('queued.edit')}
              onClick={() => onEdit(item.id)}
              data-testid="queued-edit"
            >
              <Pencil size={13} />
            </button>
          </Tip>
          <Tip label={t('queued.remove')}>
            <button
              type="button"
              className="icon-button small"
              aria-label={t('queued.remove')}
              onClick={() => onRemove(item.id)}
              data-testid="queued-remove"
            >
              <X size={13} />
            </button>
          </Tip>
        </div>
      ))}
    </div>
  )
}
