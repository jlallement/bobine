import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, TriangleAlert, X } from 'lucide-react'
import type { AppAlert } from '@shared/app-alerts'
import '../../app-alerts.css'
import '../../safe-boundary.css'

/**
 * Avis de l'app en haut de la fenêtre principale (fiche 194) : problème interne de Bobine (un par
 * lancement, avec son compte), plantage du lancement précédent (rapport local, rien d'envoyé). Ils
 * restent jusqu'au ✕ ; le main les garde, la fenêtre les relit à son chargement.
 */
export function AppAlertsBar() {
  const [alerts, setAlerts] = useState<AppAlert[]>([])
  useEffect(() => {
    let live = true
    void window.api.app
      .alerts()
      .then((list) => live && setAlerts(list))
      .catch(() => {})
    const off = window.api.app.onAlerts(setAlerts)
    return () => {
      live = false
      off()
    }
  }, [])
  if (alerts.length === 0) return null
  return (
    <div className="app-alerts" data-testid="app-alerts">
      {alerts.map((alert) => (
        <AppAlertCard key={alert.kind} alert={alert} />
      ))}
    </div>
  )
}

function AppAlertCard({ alert }: { alert: AppAlert }) {
  const { t } = useTranslation()
  const internal = alert.kind === 'internal-error'
  const Icon = internal ? TriangleAlert : Info
  return (
    <div className="app-alert" role="status" data-testid={`app-alert-${alert.kind}`}>
      <Icon size={16} aria-hidden />
      <div className="app-alert-text">
        <b>
          {internal
            ? t('appAlert.internal.title', { count: alert.count })
            : t('appAlert.crashed.title')}
        </b>
        <small>{internal ? t('appAlert.internal.detail') : t('appAlert.crashed.detail')}</small>
        {internal && (
          <details className="safe-details">
            <summary>{t('errorBoundary.details')}</summary>
            <pre>{alert.detail}</pre>
          </details>
        )}
        <div className="app-alert-actions">
          {internal ? (
            <button className="btn small" onClick={() => void window.api.app.showLog()}>
              {t('errorBoundary.showLog')}
            </button>
          ) : (
            <button
              className="btn small"
              data-testid="app-alert-show-report"
              onClick={() => void window.api.app.showCrashReport()}
            >
              {t('appAlert.crashed.show')}
            </button>
          )}
        </div>
      </div>
      <button
        className="icon-button small"
        aria-label={t('appAlert.close')}
        title={t('appAlert.close')}
        data-testid="app-alert-close"
        onClick={() => void window.api.app.dismissAlert(alert.kind)}
      >
        <X size={14} />
      </button>
    </div>
  )
}
