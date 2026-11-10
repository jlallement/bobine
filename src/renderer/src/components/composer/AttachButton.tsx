import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Camera, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ItemText, MenuContent, Tip } from '../common/Menus'

/**
 * 📎 et capture d'écran (fiche 062). Quand la place manque (repli de la barre, fiche 092), la
 * capture passe dans un petit menu sous 📎 ; le bouton de capture reste dans la page, caché par le
 * CSS, pour que la mesure du repli le voie.
 */
export function AttachButton({
  folded,
  disabled,
  onPickFiles,
  onCaptureScreen
}: {
  /** Capture repliée dans le menu de 📎. */
  folded: boolean
  disabled: boolean
  onPickFiles: () => void
  onCaptureScreen: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const capture = onCaptureScreen && (
    <Tip label={t('composer.capture.tip')}>
      <button
        type="button"
        className="chip icon-chip capture-chip"
        onClick={onCaptureScreen}
        disabled={disabled}
        aria-label={t('composer.capture.label')}
        data-testid="capture"
      >
        <Camera size={15} />
      </button>
    </Tip>
  )
  if (folded && onCaptureScreen) {
    return (
      <>
        <Dropdown.Root modal={false}>
          <Tip label={t('composer.attach.menuTip')}>
            <Dropdown.Trigger
              className="chip icon-chip"
              disabled={disabled}
              aria-label={t('composer.attach.label')}
              data-testid="attach"
            >
              <Paperclip size={15} />
            </Dropdown.Trigger>
          </Tip>
          <MenuContent testId="attach-menu-content">
            <Dropdown.Item className="menu-item" onSelect={onPickFiles} data-testid="attach-files">
              <Paperclip size={16} className="menu-icon" />
              <ItemText title={t('composer.attach.files')} />
            </Dropdown.Item>
            <Dropdown.Item
              className="menu-item"
              onSelect={onCaptureScreen}
              data-testid="attach-capture"
            >
              <Camera size={16} className="menu-icon" />
              <ItemText title={t('composer.capture.item')} />
            </Dropdown.Item>
          </MenuContent>
        </Dropdown.Root>
        {capture}
      </>
    )
  }
  return (
    <>
      <Tip label={t('composer.attach.tip')}>
        <button
          type="button"
          className="chip icon-chip"
          onClick={onPickFiles}
          disabled={disabled}
          aria-label={t('composer.attach.label')}
          data-testid="attach"
        >
          <Paperclip size={15} />
        </button>
      </Tip>
      {capture}
    </>
  )
}
