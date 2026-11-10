import * as Dialog from '@radix-ui/react-dialog'
import { ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { lineCount } from '@shared/attachments'

/** Texte de la puce d'un texte collé : « Texte collé · N lignes » (fiche 155). */
export function PastedTextLabel({ name, text }: { name: string; text: string }) {
  const { t } = useTranslation()
  return (
    <>
      <ClipboardList size={14} />
      <span>{t('composer.attachment.pastedLines', { name, count: lineCount(text) })}</span>
    </>
  )
}

/**
 * Aperçu d'un long texte collé (fiche 155), dans la zone de saisie (on peut le remettre dans le
 * texte) ou dans le fil (lecture seule).
 */
export function PastedTextDialog(props: {
  name: string
  text: string
  onClose: () => void
  /** Remet le texte dans la saisie (absent dans le fil). */
  onPutBack?: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog confirm-dialog pasted-dialog" data-testid="pasted-dialog">
          <Dialog.Title className="confirm-title">{props.name}</Dialog.Title>
          <Dialog.Description className="confirm-text">
            {t('composer.pasted.size', {
              count: lineCount(props.text),
              chars: props.text.length.toLocaleString()
            })}
          </Dialog.Description>
          <pre className="pasted-text" data-testid="pasted-text">
            {props.text}
          </pre>
          <div className="confirm-actions">
            {props.onPutBack && (
              <button
                type="button"
                className="btn"
                onClick={props.onPutBack}
                data-testid="pasted-put-back"
              >
                {t('composer.pasted.putBack')}
              </button>
            )}
            <Dialog.Close asChild>
              <button type="button" className="btn primary">
                {t('common.close')}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
