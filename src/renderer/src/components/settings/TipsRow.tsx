import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Réglages › Général › Vous : « Astuces de Bobine » (fiche 191), activé par défaut ; le nombre
 * d'astuces masquées et « Tout réafficher ».
 */
export function TipsRow({
  enabled,
  onChange
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const [hidden, setHidden] = useState(0)
  useEffect(() => {
    void window.api.tips
      .state()
      .then((s) => setHidden(s.hidden.length))
      .catch(() => undefined)
    return window.api.tips.onChanged?.((s) => setHidden(s.hidden.length))
  }, [])
  return (
    <div className="settings-row" data-setting="tips">
      <div className="settings-row-text">
        <div className="settings-row-label">{t('settings.general.tips.label')}</div>
        <div className="settings-row-hint">
          {t('settings.general.tips.hint')}
          {hidden > 0 && (
            <>
              {' '}
              <span data-testid="settings-tips-hidden">
                {t('settings.general.tips.hidden', { count: hidden })}
              </span>
              {' · '}
              <button
                className="link-button"
                onClick={() => void window.api.tips.reset().then((s) => setHidden(s.hidden.length))}
                data-testid="settings-tips-reset"
              >
                {t('settings.general.tips.reset')}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="settings-row-control">
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
            data-testid="settings-tips"
          />
          <span />
        </label>
      </div>
    </div>
  )
}
