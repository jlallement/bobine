import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, WifiOff } from 'lucide-react'
import type { AgentUnreachableView } from '@shared/agent'
import { requestNetworkSettings } from '../../open-settings'
import { secondsLeft } from './TurnRetryBanner'
import { withCode } from './network-hint'
import '../../silence-banner.css'

/**
 * Agent qui ne joint pas son modèle et réessaie de lui-même (fiche 275), à la fin du fil, à la
 * place de l'indicateur d'activité : tentative et décompte, piste réseau (le proxy de l'agent,
 * identifiants masqués par le main, sinon Wi-Fi et VPN), message de l'agent replié et non traduit
 * (ADR-0014). État générique : le format de chaque agent est lu par son profil, côté main.
 * Réglages réseau changés depuis le lancement de l'agent (fiche 276) : la piste le dit, et
 * « Relancer l'agent » prend la place de « Réglages réseau ».
 */
export function AgentUnreachableBanner({
  unreachable,
  agent,
  proxy,
  networkStale = false,
  onStop,
  onRestart
}: {
  unreachable: AgentUnreachableView
  agent: string
  proxy?: string | undefined
  networkStale?: boolean
  onStop: () => void
  onRestart?: () => void
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const { at } = unreachable
  useEffect(() => {
    if (at === undefined) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [at])
  const stale = networkStale && !!onRestart
  const detail =
    at !== undefined && at > now
      ? t('agentRetry.detail', { attempt: unreachable.attempt, seconds: secondsLeft(at, now) })
      : t('agentRetry.detailNow', { attempt: unreachable.attempt })
  return (
    <div
      className="silence-banner silence-banner-warn"
      role="status"
      data-testid="agent-unreachable"
      data-attempt={unreachable.attempt}
    >
      <WifiOff size={16} aria-hidden />
      <div className="silence-banner-text">
        <b>{t('agentRetry.title', { agent })}</b>
        <small data-testid="agent-unreachable-detail">{detail}</small>
        <small
          className="silence-banner-hint"
          data-testid="agent-unreachable-hint"
          {...(stale ? { 'data-stale': '' } : {})}
        >
          {stale
            ? t('agentRetry.networkStale', { agent })
            : proxy
              ? withCode((slot) => t('agentRetry.proxy', { proxy: slot }), proxy)
              : t('agentRetry.noProxy')}
        </small>
        {unreachable.message && (
          <details className="silence-banner-details">
            <summary>{t('agentRetry.agentMessage')}</summary>
            <pre data-testid="agent-unreachable-message">{unreachable.message}</pre>
          </details>
        )}
      </div>
      <div className="silence-banner-actions">
        {stale ? (
          <button
            className="btn small primary"
            data-testid="agent-unreachable-restart"
            onClick={onRestart}
          >
            <RotateCcw size={13} aria-hidden />
            {t('agentRetry.restart')}
          </button>
        ) : (
          <button
            className="btn small"
            data-testid="agent-unreachable-settings"
            onClick={requestNetworkSettings}
          >
            {t('agentRetry.settings')}
          </button>
        )}
        <button className="btn small" data-testid="agent-unreachable-stop" onClick={onStop}>
          {t('agentRetry.stop')}
        </button>
      </div>
    </div>
  )
}
