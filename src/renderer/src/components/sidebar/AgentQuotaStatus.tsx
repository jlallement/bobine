import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale, numberFormat } from '@shared/i18n/format'
import { quotaRatio, unitLabel, usageLevel, type AgentQuota } from '@shared/usage'

/**
 * Nom de l'agent et son quota, en bas de la barre latérale (fiche 091) : nom, état, part consommée
 * et barre ; au clic sur le bloc, le détail (consommé, plafond, reste, source, heure de lecture) et
 * « Actualiser ».
 */
export function AgentQuotaStatus({
  quota,
  status,
  agentLabel,
  onRefresh
}: {
  quota: AgentQuota
  /** État de l'agent, déjà traduit (« Prêt »). */
  status: string
  agentLabel: string
  onRefresh: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [reading, setReading] = useState(false)
  const ratio = quotaRatio(quota)
  const level = ratio === undefined ? undefined : usageLevel(ratio)
  const amount = (n: number) =>
    t('quota.amount', {
      amount: numberFormat({ maximumFractionDigits: 2 }).format(n),
      currency: unitLabel(quota.currency)
    })
  const short =
    ratio === undefined
      ? t('quota.usedShort', { used: amount(quota.used) })
      : t('quota.short', { percent: Math.round(ratio * 100) })
  const left = quota.limit === null ? undefined : quota.limit - quota.used
  const time = new Date(quota.readAt).toLocaleTimeString(currentLocale(), {
    hour: '2-digit',
    minute: '2-digit'
  })
  const bar = ratio !== undefined && (
    <div className={`usage-bar${level ? ` ${level}` : ''}`}>
      <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  )

  return (
    <Popover.Root>
      <Popover.Trigger
        className="who agent-quota"
        aria-label={t('quota.label', { agent: agentLabel })}
        data-testid="agent-quota"
      >
        <div className="name">{agentLabel}</div>
        <div className="sub" data-testid="agent-status">
          {t('quota.withStatus', { status, quota: short })}
        </div>
        {bar}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="menu usage-popover"
          side="top"
          align="start"
          sideOffset={8}
          data-testid="quota-details"
        >
          <div className="menu-label">{t('quota.title', { agent: agentLabel })}</div>
          <div className="usage-section">
            <div className="usage-row">
              <span>{t('quota.month')}</span>
              <strong data-testid="quota-value">
                {quota.limit === null
                  ? amount(quota.used)
                  : t('quota.value', {
                      used: numberFormat({ maximumFractionDigits: 2 }).format(quota.used),
                      limit: amount(quota.limit)
                    })}
              </strong>
            </div>
            {bar}
            {left === undefined ? (
              <div className="usage-row sub">
                <span>{t('quota.limit')}</span>
                <span>{t('quota.unlimited')}</span>
              </div>
            ) : (
              <div className="usage-row sub">
                <span>{left >= 0 ? t('quota.left') : t('quota.over')}</span>
                <span data-testid="quota-left">{amount(Math.abs(left))}</span>
              </div>
            )}
            <div className="usage-hint">
              {t('quota.source', { agent: agentLabel, time })}
              {' · '}
              <button
                type="button"
                className="link-button"
                disabled={reading}
                onClick={() => {
                  setReading(true)
                  void onRefresh().finally(() => setReading(false))
                }}
                data-testid="quota-refresh"
              >
                {reading ? t('quota.reading') : t('quota.refresh')}
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
