import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import type { TurnRetryView } from '@shared/agent'
import '../../turn-retry.css'

/** Secondes avant la tentative, arrondies au-dessus (jamais « dans 0 s »). */
export function secondsLeft(at: number, now: number): number {
  return Math.max(1, Math.ceil((at - now) / 1000))
}

/**
 * Bandeau d'un tour qui attend pour réessayer après une panne réseau ou une limite de débit
 * (fiche 142), à la fin du fil, à la place de l'indicateur d'activité : la cause, le décompte de
 * la prochaine tentative, et « Réessayer maintenant » ; une fois les tentatives épuisées,
 * « Connexion impossible » et « Réessayer ».
 */
export function TurnRetryBanner({ retry, onRetry }: { retry: TurnRetryView; onRetry: () => void }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const { at } = retry
  useEffect(() => {
    if (at === undefined) return
    // Heure relue tout de suite pour une nouvelle tentative, puis quatre fois par seconde.
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 250)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [at])
  const exhausted = at === undefined
  const title = exhausted
    ? retry.cause === 'rate-limit'
      ? t('turnRetry.rateLimitExhausted')
      : t('turnRetry.exhausted')
    : retry.cause === 'rate-limit'
      ? t('turnRetry.rateLimit')
      : t('turnRetry.network')
  const detail = exhausted
    ? t('turnRetry.exhaustedDetail', { max: retry.max })
    : t('turnRetry.countdown', {
        seconds: secondsLeft(at, now),
        attempt: retry.attempt,
        max: retry.max
      })
  return (
    <div
      className="turn-retry"
      role="status"
      data-testid="turn-retry"
      data-cause={retry.cause}
      data-attempt={exhausted ? 'exhausted' : retry.attempt}
    >
      <WifiOff size={16} aria-hidden />
      <div className="turn-retry-text">
        <b>{title}</b>
        <small data-testid="turn-retry-detail">{detail}</small>
      </div>
      <button className="btn small" data-testid="turn-retry-now" onClick={onRetry}>
        {exhausted ? t('turnRetry.retry') : t('turnRetry.retryNow')}
      </button>
    </div>
  )
}
