import { ChartColumn, Info, Plus } from 'lucide-react'
import { EmptyState } from '../common/EmptyState'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePresentation } from '../../presentation'
import { numberFormat } from '@shared/i18n/format'
import { isCurrencyCode, unitLabel } from '@shared/usage'
import { dayKey } from '@shared/usage-periods'
import type { UsageQuery, UsageStats } from '@shared/usage-stats'
import { ipcErrorText } from '../../ipc-errors'
import {
  costUnits,
  isOther,
  metricCoverage,
  metricId,
  seriesColor,
  seriesOf,
  type ChartGrouping,
  type ChartMetric
} from '../../usage-board'
import { ActivityFilters, type ActivityExport, type ActivityView } from './ActivityFilters'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ActivityKpis } from './ActivityKpis'
import { AgentAccounts } from './AgentAccounts'
import { UsageChart } from './UsageChart'
import { ConversationTable, ModelTable, ProjectTable } from './UsageTables'
import '../../usage-board.css'
import { useProfileStatus } from '../common/Profile'

/**
 * « Mon activité » (fiche 144, d'après le tableau de la fiche 137) : une page de la fenêtre
 * principale, à la place du fil, pour toute la consommation enregistrée par Bobine (le journal de
 * la fiche 130). Filtres, grille d'activité sur un an, quatre chiffres comparés à la période
 * d'avant, graphique empilé, tableaux, compte des agents sur ce Mac. S'ouvre sur la semaine en
 * cours.
 */
export function ActivityPage({
  onOpenConversation,
  onNewConversation
}: {
  onOpenConversation: (id: string) => void
  /** Action de l'état vide (fiche 185, F9) : aucune activité encore. */
  onNewConversation?: () => void
}) {
  const { t } = useTranslation()
  // Lecture seule (fiche 196) : le journal n'est pas ouvert ; on le dit plutôt qu'une page vide.
  const { readOnly } = useProfileStatus()
  const [view, setView] = useState<ActivityView>(() => ({
    scope: 'week',
    date: dayKey(new Date())
  }))
  const [profileId, setProfileId] = useState<string | undefined>(undefined)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [grouping, setGrouping] = useState<ChartGrouping>('agent')
  const [metric, setMetric] = useState<ChartMetric>({ kind: 'turns' })
  const [note, setNote] = useState<string | null>(null)
  // Un tour fini, une remise à zéro (Réglages › Données) : la page se relit.
  const [reload, setReload] = useState(0)
  useEffect(() => window.api.usage.onChanged(() => setReload((n) => n + 1)), [])
  const query: UsageQuery = { ...view, ...(profileId ? { profileId } : {}) }
  useEffect(() => {
    let live = true
    window.api.usage
      .stats({ scope: view.scope, date: view.date, ...(profileId ? { profileId } : {}) })
      .then(
        (next) => {
          if (!live) return
          setStats(next)
          setError(null)
        },
        (e: unknown) => live && setError(ipcErrorText(e))
      )
    return () => {
      live = false
    }
  }, [view.scope, view.date, profileId, reload])
  // Aucun échange dans tout le journal (premier lancement, remise à zéro) : un état vide plutôt
  // qu'une page de zéros (fiche 185, F9).
  const [everUsed, setEverUsed] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    window.api.usage.hasAny().then(
      (any) => live && setEverUsed(any),
      () => live && setEverUsed(true)
    )
    return () => {
      live = false
    }
  }, [reload])
  // Mode présentation (fiche 159) : aucune unité de coût, donc aucun montant ni mesure en coût.
  const presenting = usePresentation()
  const units = stats && !presenting ? costUnits(stats.byModel) : []
  // Coût dans une unité qui n'est plus dans la période : on revient aux échanges.
  const shownMetric =
    metric.kind === 'cost' && !units.includes(metric.unit) ? { kind: 'turns' as const } : metric
  const exportCsv = ({ kind, all }: ActivityExport) => {
    setNote(null)
    window.api.usage.exportCsv(all ? { ...query, scope: 'all' } : query, kind).then(
      (path) => path && setNote(t('usage.board.export.done', { path })),
      (e: unknown) => setNote(ipcErrorText(e))
    )
  }
  return (
    <div className="activity-scroll" data-testid="activity">
      <section className="activity" data-testid="usage-board">
        {/* Rien à filtrer ni exporter tant que le journal est vide. */}
        {everUsed === true && (
          <ActivityFilters
            view={view}
            onView={setView}
            agents={stats?.agents ?? []}
            profileId={profileId}
            onProfile={setProfileId}
            onExport={exportCsv}
          />
        )}
        {note && (
          <p className="settings-row-hint usage-note" data-testid="usage-export-note">
            {note}
          </p>
        )}
        {error && <p className="settings-row-hint">{error}</p>}
        {readOnly && (
          <EmptyState
            level={2}
            icon={ChartColumn}
            title={t('activity.readOnly.title')}
            text={t('activity.readOnly.text')}
            testId="activity-readonly"
          />
        )}
        {everUsed === false && !readOnly && (
          <EmptyState
            level={2}
            icon={ChartColumn}
            accent
            title={t('activity.empty.title')}
            text={t('activity.empty.text')}
            action={
              onNewConversation && (
                <button className="btn" onClick={onNewConversation}>
                  <Plus size={14} />
                  {t('activity.empty.action')}
                </button>
              )
            }
            testId="activity-empty"
          />
        )}
        {everUsed === true && (
          <>
            <ActivityHeatmap
              view={view}
              profileId={profileId}
              reload={reload}
              onPick={(date) => setView({ scope: 'day', date })}
            />
            {stats && (
              <Board
                stats={stats}
                units={units}
                grouping={grouping}
                metric={shownMetric}
                onGrouping={setGrouping}
                onMetric={setMetric}
                onOpenConversation={onOpenConversation}
              />
            )}
          </>
        )}
        {!presenting && <AgentAccounts profileId={profileId} />}
      </section>
    </div>
  )
}

/** Chiffres clés, graphique et tableaux d'une période. */
function Board({
  stats,
  units,
  grouping,
  metric,
  onGrouping,
  onMetric,
  onOpenConversation
}: {
  stats: UsageStats
  units: string[]
  grouping: ChartGrouping
  metric: ChartMetric
  onGrouping: (grouping: ChartGrouping) => void
  onMetric: (metric: ChartMetric) => void
  onOpenConversation: (id: string) => void
}) {
  const { t } = useTranslation()
  const series = seriesOf(stats, grouping)
  const metrics: ChartMetric[] = [
    { kind: 'turns' },
    { kind: 'time' },
    { kind: 'tokens' },
    ...units.map((unit) => ({ kind: 'cost' as const, unit }))
  ]
  const metricLabel = (m: ChartMetric) =>
    m.kind !== 'cost'
      ? t(`usage.board.metric.${m.kind}`)
      : units.length > 1
        ? t('usage.board.metric.costIn', { unit: unitName(m.unit) })
        : t('usage.board.metric.cost')
  // Mesure qui ne couvre qu'une partie des agents de la période : la note le dit (fiche 147).
  const coverage = metricCoverage(stats.byModel, metric)
  const coverageNote =
    coverage.covered.length === 0
      ? null
      : metric.kind === 'tokens'
        ? t('usage.board.coverage.tokens', {
            covered: coverage.covered.join(', '),
            missing: coverage.missing.join(', '),
            count: coverage.missing.length
          })
        : t('usage.board.coverage.metric', {
            metric: metricLabel(metric),
            covered: coverage.covered.join(', ')
          })
  const modelSeries = new Map(stats.modelSeries.map((s) => [s.key, s]))
  const agentSeries = new Map(stats.agentSeries.map((s) => [s.key, s]))
  const other = series.find(isOther)
  return (
    <>
      <ActivityKpis stats={stats} units={units} />
      <div className="settings-card usage-chart-card">
        <div className="usage-chart-head">
          <span className="usage-chart-title" data-testid="usage-chart-title">
            {t(`activity.chart.title.${stats.bucket}.${metric.kind}`, {
              unit: metric.kind === 'cost' ? unitName(metric.unit) : ''
            })}
          </span>
          <span className="grow" />
          <div className="segmented" role="radiogroup" aria-label={t('usage.board.metric.label')}>
            {metrics.map((m) => (
              <button
                key={metricId(m)}
                role="radio"
                aria-checked={metricId(metric) === metricId(m)}
                className={metricId(metric) === metricId(m) ? 'active' : ''}
                onClick={() => onMetric(m)}
                data-testid={`usage-metric-${metricId(m)}`}
              >
                {metricLabel(m)}
              </button>
            ))}
          </div>
        </div>
        <div className="usage-chart-head">
          <span className="usage-legend" data-testid="usage-legend">
            {series.map((s) => (
              <span key={s.key}>
                <i style={{ background: seriesColor(s.slot) }} />
                {isOther(s) ? t('usage.board.other') : s.label}
              </span>
            ))}
          </span>
          <span className="grow" />
          <div className="segmented" role="radiogroup" aria-label={t('usage.board.grouping.label')}>
            {(['agent', 'model'] as const).map((g) => (
              <button
                key={g}
                role="radio"
                aria-checked={grouping === g}
                className={grouping === g ? 'active' : ''}
                onClick={() => onGrouping(g)}
                data-testid={`usage-grouping-${g}`}
              >
                {t(`usage.board.grouping.${g}`)}
              </button>
            ))}
          </div>
        </div>
        <UsageChart
          buckets={stats.buckets}
          kind={stats.bucket}
          scope={stats.query.scope}
          series={series}
          grouping={grouping}
          metric={metric}
        />
        {coverageNote && (
          <p className="usage-chart-foot usage-coverage" data-testid="usage-coverage">
            <Info size={13} aria-hidden />
            {coverageNote}
          </p>
        )}
        {other && <p className="usage-chart-foot">{t('usage.board.otherHint')}</p>}
      </div>
      {stats.byModel.length > 0 && (
        <>
          <ModelTable
            rows={stats.byModel}
            units={units}
            colorOf={(row) =>
              grouping === 'agent'
                ? (agentSeries.get(row.profileId) ?? other)
                : (modelSeries.get(row.key) ?? other)
            }
          />
          <div className="usage-two">
            <ProjectTable rows={stats.byProject} />
            <ConversationTable
              rows={stats.conversations}
              units={units}
              onOpen={onOpenConversation}
            />
          </div>
        </>
      )}
    </>
  )
}

/** Nom court d'une unité : « $ » pour USD, « Bobcoins » pour une unité libre. */
function unitName(unit: string): string {
  if (!isCurrencyCode(unit)) return unitLabel(unit)
  try {
    return (
      numberFormat({ style: 'currency', currency: unit, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? unit
    )
  } catch {
    return unit
  }
}
