import { useTranslation } from 'react-i18next'
import { CircleHelp } from 'lucide-react'
import type { HelpTopic } from '@shared/help-topics'
import '../../help-link.css'

/** Ouvre la fenêtre d'aide à la section d'un sujet (fiche 186). */
export const openHelp = (topic: HelpTopic): void => void window.api.help.open(topic)

/**
 * Petit « ? » à droite d'un titre (fiche 186) : discret (14 px, `--muted`), il ouvre l'aide à la
 * bonne section. `section` : le nom de la section, pour l'infobulle et les lecteurs d'écran.
 */
export function HelpLink({ topic, section }: { topic: HelpTopic; section: string }) {
  const { t } = useTranslation()
  const label = t('help.link', { section })
  return (
    <button
      type="button"
      className="help-link"
      title={label}
      aria-label={label}
      onClick={(event) => {
        // Pas de bascule d'un titre cliquable (carte repliable…).
        event.stopPropagation()
        openHelp(topic)
      }}
      data-testid={`help-link-${topic}`}
    >
      <CircleHelp size={14} aria-hidden />
    </button>
  )
}

/** « Comment ça marche », en bas à gauche d'un dialogue (fiche 186) : ne concurrence pas ses boutons. */
export function HelpFooterLink({ topic }: { topic: HelpTopic }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className="help-footer-link"
      onClick={() => openHelp(topic)}
      data-testid={`help-link-${topic}`}
    >
      <CircleHelp size={14} aria-hidden />
      {t('help.howItWorks')}
    </button>
  )
}
