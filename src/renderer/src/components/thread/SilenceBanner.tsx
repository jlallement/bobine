import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hourglass, RotateCcw } from 'lucide-react'
import { requestNetworkSettings } from '../../open-settings'
import { withCode } from './network-hint'
import '../../silence-banner.css'

/** Minutes de silence affichées (au moins 1). */
export const silentMinutes = (since: number, now: number): number =>
  Math.max(1, Math.floor((now - since) / 60_000))

/**
 * Bandeau d'un agent qui n'a rien envoyé depuis longtemps pendant un tour (fiche 194), à la fin du
 * fil. Ton neutre : rien n'est en panne, l'agent peut travailler (longue commande, longue
 * réflexion). `role="status"`, jamais d'alerte ni de focus. « Attendre » le masque jusqu'au
 * prochain silence (`since` change quand l'agent reparle) ; « Arrêter » arrête la réponse.
 * Proxy défini pour l'agent (fiche 275, identifiants masqués par le main) : il est cité comme
 * piste, avec « Réglages réseau ». Réglages réseau changés depuis le lancement de l'agent (fiche
 * 276) : la piste le dit, et « Relancer l'agent » prend la place de « Réglages réseau ».
 */
export function SilenceBanner({
  since,
  proxy,
  networkStale = false,
  onStop,
  onRestart
}: {
  since: number
  proxy?: string | undefined
  networkStale?: boolean
  onStop: () => void
  onRestart?: () => void
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const [hiddenFor, setHiddenFor] = useState<number | undefined>()
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  if (hiddenFor === since) return null
  const stale = networkStale && !!onRestart
  return (
    <div className="silence-banner" role="status" data-testid="silence-banner">
      <Hourglass size={16} aria-hidden />
      <div className="silence-banner-text">
        <b>{t('silenceBanner.title', { minutes: silentMinutes(since, now) })}</b>
        <small>{t('silenceBanner.detail')}</small>
        {stale ? (
          <small className="silence-banner-hint" data-testid="silence-network-stale">
            {t('silenceBanner.networkStale')}
          </small>
        ) : (
          proxy && (
            <small className="silence-banner-hint" data-testid="silence-proxy">
              {withCode((slot) => t('silenceBanner.proxy', { proxy: slot }), proxy)}
            </small>
          )
        )}
      </div>
      <div className="silence-banner-actions">
        {stale && (
          <button className="btn small primary" data-testid="silence-restart" onClick={onRestart}>
            <RotateCcw size={13} aria-hidden />
            {t('silenceBanner.restart')}
          </button>
        )}
        {proxy && !stale && (
          <button
            className="btn small"
            data-testid="silence-settings"
            onClick={requestNetworkSettings}
          >
            {t('silenceBanner.settings')}
          </button>
        )}
        <button
          className="btn small"
          data-testid="silence-wait"
          onClick={() => setHiddenFor(since)}
        >
          {t('silenceBanner.wait')}
        </button>
        <button className="btn small" data-testid="silence-stop" onClick={onStop}>
          {t('silenceBanner.stop')}
        </button>
      </div>
    </div>
  )
}
