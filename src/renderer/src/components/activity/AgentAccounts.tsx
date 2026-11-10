import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { numberFormat } from '@shared/i18n/format'
import { formatCost, quotaRatio, unitLabel, type AgentQuota } from '@shared/usage'
import type { AgentSpendView } from '@shared/usage-stats'
import { Row, SettingsCard, SettingsTitle } from '../settings/rows'

/**
 * « {agent} sur ce Mac » (fiches 091, 137, 144 et 147), sous les tableaux de « Mon activité » : le
 * quota du mois d'après le serveur de l'agent et sa dépense d'après sa base sur ce Mac, pour
 * chaque agent dont le profil sait les lire (Bob). Lus par les canaux génériques `usage:quotas` et
 * `usage:spends`.
 */
export function AgentAccounts({ profileId: only }: { profileId?: string | undefined }) {
  const { t } = useTranslation()
  const [quotas, setQuotas] = useState<AgentQuota[]>([])
  const [spends, setSpends] = useState<AgentSpendView[]>([])
  useEffect(() => {
    let live = true
    void window.api.usage.quotas().then(
      (list) => live && setQuotas(list),
      () => {}
    )
    void window.api.usage.spends().then(
      (list) => live && setSpends(list),
      () => {}
    )
    const off = window.api.usage.onQuotasChanged((list) => setQuotas(list))
    return () => {
      live = false
      off()
    }
  }, [])
  // Filtre sur un agent (fiche 147) : seulement ses comptes.
  const agents = [
    ...new Set([...quotas.map((q) => q.profileId), ...spends.map((s) => s.profileId)])
  ].filter((id) => !only || id === only)
  const amount = (n: number) => numberFormat({ maximumFractionDigits: 2 }).format(n)
  return agents.map((profileId) => {
    const quota = quotas.find((q) => q.profileId === profileId)
    const spend = spends.find((s) => s.profileId === profileId)
    const agent = quota?.profileLabel ?? spend?.profileLabel ?? profileId
    const ratio = quota ? quotaRatio(quota) : undefined
    return (
      <div key={profileId} data-testid="usage-account">
        <SettingsTitle>{t('usage.board.account.title', { agent })}</SettingsTitle>
        <SettingsCard>
          {quota && (
            <Row
              label={t('usage.board.account.quota')}
              hint={t('usage.board.account.quotaHint', { agent })}
            >
              <span className="usage-value" data-testid="usage-quota">
                {quota.limit === null
                  ? t('quota.amount', {
                      amount: amount(quota.used),
                      currency: unitLabel(quota.currency)
                    })
                  : t('usage.board.account.quotaValue', {
                      used: amount(quota.used),
                      limit: t('quota.amount', {
                        amount: amount(quota.limit),
                        currency: unitLabel(quota.currency)
                      }),
                      percent: Math.round((ratio ?? 0) * 100)
                    })}
              </span>
            </Row>
          )}
          {spend && (
            <>
              <Row
                label={t('usage.board.account.spend')}
                hint={t('usage.board.account.spendHint', { agent })}
              >
                <span />
              </Row>
              {(
                [
                  ['today', spend.today],
                  ['week', spend.week],
                  ['month', spend.month]
                ] as const
              ).map(([key, value]) => (
                <Row key={key} label={t(`usage.spend.${key}`)} sub>
                  <span className="usage-value" data-testid={`usage-spend-${key}`}>
                    {formatCost({ amount: value, currency: spend.currency })}
                  </span>
                </Row>
              ))}
            </>
          )}
        </SettingsCard>
      </div>
    )
  })
}
