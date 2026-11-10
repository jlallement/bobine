import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, X, type LucideIcon } from 'lucide-react'
import type { HelpTopic } from '@shared/help-topics'
import type { TipId } from '@shared/tips'
import { openHelp } from '../help/HelpLink'
import '../../tips.css'

export interface TipAction {
  label: string
  run: () => void
  testId: string
}

/**
 * Astuce de Bobine (fiche 191) : une languette discrète (teinte d'accent très légère), posée sur
 * le bord haut de la saisie ou au pied d'une carte. Elle ne couvre rien ; « En savoir plus »
 * ouvre l'aide à la bonne section (fiche 186), « Ne plus montrer » la masque pour toujours,
 * × la ferme pour aujourd'hui.
 */
export function TipTab({
  id,
  children,
  actions = [],
  help,
  onNever,
  onClose,
  placement = 'composer',
  icon: Icon = Lightbulb
}: {
  id: TipId
  children: ReactNode
  actions?: TipAction[]
  help?: HelpTopic
  onNever: () => void
  onClose: () => void
  placement?: 'composer' | 'card'
  icon?: LucideIcon
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`tip-tab tip-${placement}`}
      role="note"
      aria-label={t('tips.label')}
      data-testid={`tip-${id}`}
    >
      <Icon size={14} className="tip-icon" aria-hidden />
      <span className="tip-text">{children}</span>
      <span className="tip-actions">
        {actions.map((a) => (
          <button key={a.testId} className="tip-link" onClick={a.run} data-testid={a.testId}>
            {a.label}
          </button>
        ))}
        {help && (
          <button className="tip-link" onClick={() => openHelp(help)} data-testid="tip-learn-more">
            {t('tips.learnMore')}
          </button>
        )}
        <button className="tip-never" onClick={onNever} data-testid="tip-never">
          {t('tips.never')}
        </button>
        <button
          className="tip-close"
          onClick={onClose}
          aria-label={t('tips.close')}
          title={t('tips.close')}
          data-testid="tip-close"
        >
          <X size={13} aria-hidden />
        </button>
      </span>
    </div>
  )
}
