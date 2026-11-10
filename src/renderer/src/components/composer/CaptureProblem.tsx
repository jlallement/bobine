import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ScreenCaptureUnavailable } from '@shared/attachments'

/**
 * Capture d'écran impossible (fiche 124), sous la zone de saisie ou dans la fenêtre rapide :
 * pourquoi, et le réglage de macOS à ouvrir (celui de la commande du Diagnostic).
 */
export function CaptureProblem(props: {
  reason: ScreenCaptureUnavailable['reason']
  className: string
  onOpenSettings: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`capture-problem ${props.className}`}
      role="alert"
      data-testid="capture-problem"
      data-reason={props.reason}
    >
      <span className="capture-problem-text">
        {t(`composer.capture.unavailable.${props.reason}`)}
      </span>
      <button
        type="button"
        className="link-button"
        onClick={props.onOpenSettings}
        data-testid="capture-settings"
      >
        {t('composer.capture.unavailable.openSettings')}
      </button>
      <button
        type="button"
        className="icon-button small"
        aria-label={t('common.close')}
        onClick={props.onDismiss}
        data-testid="capture-problem-close"
      >
        <X size={13} />
      </button>
    </div>
  )
}
