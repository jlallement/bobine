import { Presentation } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { requestPresentation, usePresentation } from '../../presentation'

/** Pastille discrète en haut à droite tant que le mode présentation est actif (fiche 159). */
export function PresentationPill() {
  const { t } = useTranslation()
  if (!usePresentation()) return null
  return (
    <button
      className="presentation-pill no-drag"
      title={t('presentation.tip')}
      onClick={() => requestPresentation(false)}
      data-testid="presentation-pill"
    >
      <Presentation size={13} />
      {t('presentation.pill')}
    </button>
  )
}
