import { Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Indication pendant qu'on glisse des fichiers sur la conversation. */
export function DropOverlay() {
  const { t } = useTranslation()
  return (
    <div className="file-drop-overlay" data-testid="drop-overlay">
      <div className="file-drop-label">
        <Paperclip size={18} /> {t('dropOverlay.hint')}
      </div>
    </div>
  )
}
