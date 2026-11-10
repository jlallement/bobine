import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isCurrent, PAGE_SCOPES, shiftDay, type DatedScope } from '@shared/usage-periods'
import type { UsageExportKind } from '@shared/usage-stats'
import { periodLabel } from '../../usage-board'

/** Ce que la page montre : une période (ou un jour choisi dans la grille), d'un jour donné. */
export interface ActivityView {
  scope: DatedScope
  date: string
}

/** Export demandé : la période affichée (par tour ou par jour), ou tout l'historique. */
export type ActivityExport = { kind: UsageExportKind; all?: boolean }

/**
 * Ligne de filtres de « Mon activité » (fiche 144) : Semaine · Mois · Année, flèches et libellé de
 * la période (ou la pastille du jour choisi), puis à droite l'agent et « Exporter… ». En fenêtre
 * étroite, le groupe de droite passe à la ligne.
 */
export function ActivityFilters({
  view,
  onView,
  agents,
  profileId,
  onProfile,
  onExport
}: {
  view: ActivityView
  onView: (view: ActivityView) => void
  agents: readonly { profileId: string; label: string }[]
  profileId: string | undefined
  onProfile: (profileId: string | undefined) => void
  onExport: (request: ActivityExport) => void
}) {
  const { t } = useTranslation()
  const current = isCurrent(view.scope, view.date, new Date())
  return (
    <div className="activity-filters" data-testid="activity-filters">
      <div className="activity-filters-group">
        <div className="segmented" role="radiogroup" aria-label={t('activity.scope.label')}>
          {PAGE_SCOPES.map((scope) => (
            <button
              key={scope}
              role="radio"
              aria-checked={view.scope === scope}
              className={view.scope === scope ? 'active' : ''}
              onClick={() => onView({ scope, date: view.date })}
              data-testid={`activity-scope-${scope}`}
            >
              {t(`activity.scope.${scope}`)}
            </button>
          ))}
        </div>
        {view.scope === 'day' ? (
          <span className="activity-day-chip" data-testid="activity-day">
            <span data-testid="activity-period">{periodLabel('day', view.date)}</span>
            <button
              className="icon-button small"
              aria-label={t('activity.day.back')}
              title={t('activity.day.back')}
              onClick={() => onView({ scope: 'week', date: view.date })}
              data-testid="activity-day-close"
            >
              <X size={13} />
            </button>
          </span>
        ) : (
          <span className="activity-nav">
            <button
              className="icon-button small"
              aria-label={t('activity.nav.previous')}
              onClick={() => onView({ ...view, date: shiftDay(view.scope, view.date, -1) })}
              data-testid="activity-previous"
            >
              <ChevronLeft size={15} />
            </button>
            <b data-testid="activity-period">{periodLabel(view.scope, view.date)}</b>
            <button
              className="icon-button small"
              aria-label={t('activity.nav.next')}
              disabled={current}
              onClick={() => onView({ ...view, date: shiftDay(view.scope, view.date, 1) })}
              data-testid="activity-next"
            >
              <ChevronRight size={15} />
            </button>
          </span>
        )}
      </div>
      <div className="activity-filters-group end">
        <select
          className="settings-input"
          value={profileId ?? ''}
          aria-label={t('usage.board.agent.label')}
          onChange={(e) => onProfile(e.target.value || undefined)}
          data-testid="usage-agent"
        >
          <option value="">{t('usage.board.agent.all')}</option>
          {agents.map((a) => (
            <option key={a.profileId} value={a.profileId}>
              {a.label}
            </option>
          ))}
        </select>
        {/* Non modal : « Enregistrer sous » ouvre une fenêtre du système. */}
        <Dropdown.Root modal={false}>
          <Dropdown.Trigger className="btn small" data-testid="usage-export">
            <Download size={13} aria-hidden />
            {t('usage.board.export.action')}
          </Dropdown.Trigger>
          <Dropdown.Content className="menu" align="end" sideOffset={6}>
            {(['turns', 'days'] as const).map((kind) => (
              <Dropdown.Item
                key={kind}
                className="menu-item"
                onSelect={() => onExport({ kind })}
                data-testid={`usage-export-${kind}`}
              >
                <span className="menu-text">{t(`usage.board.export.${kind}`)}</span>
              </Dropdown.Item>
            ))}
            <Dropdown.Separator className="menu-separator" />
            <Dropdown.Item
              className="menu-item"
              onSelect={() => onExport({ kind: 'turns', all: true })}
              data-testid="usage-export-all"
            >
              <span className="menu-text">{t('activity.export.all')}</span>
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      </div>
    </div>
  )
}
