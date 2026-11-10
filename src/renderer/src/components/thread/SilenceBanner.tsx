import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hourglass } from 'lucide-react'
import '../../silence-banner.css'

/** Minutes de silence affichées (au moins 1). */
export const silentMinutes = (since: number, now: number): number =>
  Math.max(1, Math.floor((now - since) / 60_000))

/**
 * Bandeau d'un agent qui n'a rien envoyé depuis longtemps pendant un tour (fiche 194), à la fin du
 * fil. Ton neutre : rien n'est en panne, l'agent peut travailler (longue commande, longue
 * réflexion). `role="status"`, jamais d'alerte ni de focus. « Attendre » le masque jusqu'au
 * prochain silence (`since` change quand l'agent reparle) ; « Arrêter » arrête la réponse.
 */
export function SilenceBanner({ since, onStop }: { since: number; onStop: () => void }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const [hiddenFor, setHiddenFor] = useState<number | undefined>()
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])
  if (hiddenFor === since) return null
  return (
    <div className="silence-banner" role="status" data-testid="silence-banner">
      <Hourglass size={16} aria-hidden />
      <div className="silence-banner-text">
        <b>{t('silenceBanner.title', { minutes: silentMinutes(since, now) })}</b>
        <small>{t('silenceBanner.detail')}</small>
      </div>
      <div className="silence-banner-actions">
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
