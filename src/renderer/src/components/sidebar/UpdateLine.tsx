import { CircleArrowUp, X } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'
import { useUpdate } from '../common/useUpdate'
import { focusComposer } from '../../useAside'
import '../../update-notice.css'

/**
 * Avis de nouvelle version (fiche 274, ADR-0066) : une ligne au-dessus du pied de la barre
 * latérale. « Voir » ouvre la page de la version (vérifiée par le main) et, comme ✕ (« Plus
 * tard »), masque l'avis pour cette version. Rien si la vérification est coupée. Le numéro est la
 * seule chose venue de GitHub affichée, comme du texte.
 */
export function UpdateLine() {
  const { t } = useTranslation()
  const view = useUpdate()
  const available = view?.available
  if (!view?.enabled || !available || view.dismissed) return null
  const later = t('updates.line.later', { version: available.version })
  /**
   * « Voir » et ✕ font disparaître la ligne, et le bouton qui avait le focus avec elle : le focus
   * tombait sur la page (recette rc.4). Il va d'abord à la zone de saisie.
   */
  const close = (action: (version: string) => Promise<unknown>) => {
    focusComposer()
    void action(available.version)
  }
  return (
    <div className="update-line" role="status" data-testid="update-line">
      <CircleArrowUp size={15} aria-hidden />
      <span className="update-line-text">
        {available.prerelease ? (
          <>
            <span>
              <b data-testid="update-line-version">
                {t('updates.line.name', { version: available.version })}
              </b>
            </span>
            <span className="update-line-pre">{t('updates.line.preAvailable')}</span>
          </>
        ) : (
          <span>
            <Trans
              t={t}
              i18nKey="updates.line.available"
              values={{ version: available.version }}
              components={{ b: <b data-testid="update-line-version" /> }}
            />
          </span>
        )}
      </span>
      <button
        className="link-button"
        // Nom complet pour un lecteur d'écran : « Voir » seul ne dit pas quoi (recette rc.4).
        aria-label={t('updates.line.viewLabel', { version: available.version })}
        onClick={() => close(window.api.app.openUpdate)}
        data-testid="update-line-open"
      >
        {t('updates.line.view')}
      </button>
      <Tip label={later}>
        <button
          className="icon-button small"
          aria-label={later}
          onClick={() => close(window.api.app.dismissUpdate)}
          data-testid="update-line-later"
        >
          <X size={14} />
        </button>
      </Tip>
    </div>
  )
}
