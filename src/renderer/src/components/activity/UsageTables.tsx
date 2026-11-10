import { useTranslation } from 'react-i18next'
import { usePresentation } from '../../presentation'
import { formatCost, formatTokens } from '@shared/usage'
import type {
  CostMap,
  UsageConversationRow,
  UsageModelRow,
  UsageProjectRow,
  UsageSeries
} from '@shared/usage-stats'
import { costPerTurn, orderedCosts, seriesColor } from '../../usage-board'
import { SettingsCard, SettingsTitle } from '../settings/rows'

/** Coûts d'une ligne, par unité, jamais additionnés ; « non communiqué » sans aucun. */
export function CostText({ costs, units }: { costs: CostMap; units: readonly string[] }) {
  const { t } = useTranslation()
  const list = orderedCosts(costs, units)
  if (list.length === 0) return <small>{t('usage.board.unknown')}</small>
  return <>{list.map(([currency, amount]) => formatCost({ amount, currency })).join(' · ')}</>
}

/**
 * « Par modèle » : modèle (ou l'agent, s'il n'en annonce pas), échanges, jetons entrée · sortie,
 * coût et coût par échange. La pastille a la couleur de la série du graphique affiché.
 */
export function ModelTable({
  rows,
  units,
  colorOf
}: {
  rows: readonly UsageModelRow[]
  units: readonly string[]
  colorOf: (row: UsageModelRow) => UsageSeries | undefined
}) {
  const { t } = useTranslation()
  const presenting = usePresentation()
  return (
    <>
      <SettingsTitle>{t('usage.board.byModel')}</SettingsTitle>
      <SettingsCard testId="usage-models">
        {/* Large : défile dans sa carte en fenêtre étroite, la page ne défile pas de côté. */}
        <div className="activity-table-scroll">
          <table className="usage-table wide">
            <thead>
              <tr>
                <th>{t('usage.board.columns.model')}</th>
                <th>{t('usage.board.columns.turns')}</th>
                <th>{t('usage.board.columns.tokens')}</th>
                {!presenting && <th>{t('usage.board.columns.cost')}</th>}
                {!presenting && <th>{t('usage.board.columns.perTurn')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const perTurn = units.flatMap((unit) => {
                  const amount = costPerTurn(row, unit)
                  return amount === undefined ? [] : [formatCost({ amount, currency: unit })]
                })
                return (
                  <tr key={row.key} data-testid="usage-model-row">
                    <td>
                      <span
                        className="usage-dot"
                        style={{ background: seriesColor(colorOf(row)?.slot ?? null) }}
                      />
                      {row.model ?? row.agentLabel}{' '}
                      <small>· {row.model ? row.agentLabel : t('usage.board.modelUnknown')}</small>
                    </td>
                    <td>{row.turns}</td>
                    <td>
                      {row.turnsWithoutTokens === row.turns ? (
                        <small>{t('usage.board.unknown')}</small>
                      ) : (
                        t('usage.board.inOut', {
                          input: formatTokens(row.input, true),
                          output: formatTokens(row.output, true)
                        })
                      )}
                    </td>
                    {!presenting && (
                      <td>
                        <CostText costs={row.costs} units={units} />
                      </td>
                    )}
                    {!presenting && <td>{perTurn.length ? perTurn.join(' · ') : '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </>
  )
}

/** « Par projet » : les worktrees comptent pour leur dépôt ; une barre proportionnelle. */
export function ProjectTable({ rows }: { rows: readonly UsageProjectRow[] }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...rows.map((r) => r.turns))
  return (
    <div>
      <SettingsTitle>{t('usage.board.byProject')}</SettingsTitle>
      <SettingsCard testId="usage-projects">
        <table className="usage-table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} data-testid="usage-project-row">
                <td className="usage-name" title={row.key || undefined}>
                  {row.name || <small>{t('usage.board.noFolder')}</small>}
                </td>
                <td>
                  <span className="usage-bar-cell">
                    <i style={{ width: `${Math.max(4, (row.turns / max) * 90)}px` }} />
                    {row.turns}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>
    </div>
  )
}

/** Les conversations qui ont le plus consommé ; un clic ouvre la conversation. */
export function ConversationTable({
  rows,
  units,
  onOpen
}: {
  rows: readonly UsageConversationRow[]
  units: readonly string[]
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <SettingsTitle>{t('usage.board.topConversations')}</SettingsTitle>
      <SettingsCard testId="usage-conversations">
        <table className="usage-table">
          <tbody>
            {rows.map((row) => {
              const costs = orderedCosts(row.costs, units)
                .map(([currency, amount]) => formatCost({ amount, currency }))
                .join(' · ')
              const tip = [row.agentLabel, formatTokens(row.tokens, true), costs]
                .filter(Boolean)
                .join(' · ')
              return (
                <tr key={row.id} data-testid="usage-conversation-row">
                  <td className="usage-name">
                    {row.title !== undefined ? (
                      <button
                        className="usage-link"
                        title={tip}
                        onClick={() => onOpen(row.id)}
                        data-testid="usage-conversation-open"
                      >
                        {row.title}
                      </button>
                    ) : (
                      <small title={tip}>{t('usage.board.deleted')}</small>
                    )}
                  </td>
                  <td>{row.turns}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </SettingsCard>
    </div>
  )
}
