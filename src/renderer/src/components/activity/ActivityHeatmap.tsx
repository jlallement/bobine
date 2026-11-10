import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale, numberFormat } from '@shared/i18n/format'
import { dateOfDay, dayKey, scopeRange, type HeatRange } from '@shared/usage-periods'
import type { UsageHeatDay, UsageHeatmap } from '@shared/usage-stats'
import { ipcErrorText } from '../../ipc-errors'
import { heatLevels } from '../../usage-board'
import type { ActivityView } from './ActivityFilters'

/** Carré de 12 px, 3 px entre deux : lisible à toutes les largeurs (la carte défile au besoin). */
const CELL = 12
const STEP = 15
/** Colonne des jours (lun., mer., ven.), hors de la zone qui défile. */
const LEFT = 30
const TOP = 18

/** « mardi 20 oct. » */
const tipDay = (day: string) =>
  dateOfDay(day).toLocaleDateString(currentLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  })

/**
 * Grille d'activité de « Mon activité » (fiche 144), comme celle de GitHub : un carré par jour,
 * semaines en colonnes (lundi en haut), sur les douze derniers mois ou une année civile passée.
 * Elle compte les échanges et suit le filtre d'agent ; quatre niveaux tirés de l'accent
 * (`--heat-1…4`). Les jours hors de la période affichée pâlissent ; un clic sur un jour l'affiche.
 * En fenêtre étroite, la grille garde sa taille et défile dans sa carte, calée à droite.
 */
export function ActivityHeatmap({
  view,
  profileId,
  reload,
  onPick
}: {
  view: ActivityView
  profileId: string | undefined
  /** Change quand le journal a changé : la grille se relit. */
  reload: number
  onPick: (day: string) => void
}) {
  const { t } = useTranslation()
  const [range, setRange] = useState<HeatRange>('last12')
  const [heat, setHeat] = useState<UsageHeatmap | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Jour survolé, et où le montrer (la grille a pu défiler) : relevé au survol.
  const [tip, setTip] = useState<{ index: number; x: number; left: boolean } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    window.api.usage.heatmap({ range, ...(profileId ? { profileId } : {}) }).then(
      (next) => {
        if (!live) return
        setHeat(next)
        setError(null)
      },
      (e: unknown) => live && setError(ipcErrorText(e))
    )
    return () => {
      live = false
    }
  }, [range, profileId, reload])
  // Calée à droite : les semaines récentes restent visibles, à l'ouverture comme quand la carte
  // rétrécit.
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    const pin = () => (element.scrollLeft = element.scrollWidth)
    pin()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(pin)
    observer.observe(element)
    return () => observer.disconnect()
  }, [heat])
  const days = heat?.days ?? []
  const level = heatLevels(days.map((d) => d.turns))
  const offset = days[0] ? (dateOfDay(days[0].day).getDay() + 6) % 7 : 0
  const columns = Math.ceil((days.length + offset) / 7)
  const position = (i: number) => ({
    x: Math.floor((i + offset) / 7) * STEP,
    y: TOP + ((i + offset) % 7) * STEP
  })
  const shown = scopeRange(view.scope, view.date)
  const first = dayKey(shown.from)
  const last = dayKey(new Date(shown.to.getTime() - 1))
  const width = columns * STEP
  const height = TOP + 7 * STEP
  const hovered = tip === null ? undefined : days[tip.index]
  const total = heat?.total ?? 0
  return (
    <div className="settings-card activity-heat-card" data-testid="activity-heat">
      <div className="activity-heat-head">
        <b data-testid="activity-heat-total">
          {t('activity.heat.total', { count: total, total: numberFormat().format(total) })}
        </b>
        <span>
          {range === 'last12'
            ? t('activity.heat.last12')
            : t('activity.heat.inYear', { year: range })}
        </span>
        <span className="grow" />
        <Dropdown.Root modal={false}>
          <Dropdown.Trigger
            className="btn small ghost"
            aria-label={t('activity.heat.range')}
            data-testid="activity-heat-range"
          >
            {range === 'last12' ? t('activity.heat.rangeLast12') : range}
            <ChevronDown size={13} aria-hidden />
          </Dropdown.Trigger>
          <Dropdown.Content className="menu" align="end" sideOffset={6}>
            {(['last12', ...(heat?.years ?? [])] as const).map((option) => (
              <Dropdown.Item
                key={option}
                className="menu-item"
                onSelect={() => setRange(option)}
                data-testid={`activity-heat-range-${option}`}
              >
                <span className="menu-check">{option === range && <Check size={14} />}</span>
                <span className="menu-text">
                  {option === 'last12' ? t('activity.heat.rangeLast12') : option}
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Content>
        </Dropdown.Root>
      </div>
      {error && <p className="settings-row-hint">{error}</p>}
      <div className="activity-heat-body" onMouseLeave={() => setTip(null)}>
        {/* lun., mer., ven. (le 19 octobre 2026 est un lundi) : visibles quand la grille défile. */}
        <svg className="activity-heat-days" width={LEFT} height={height} aria-hidden>
          {[0, 2, 4].map((row) => (
            <text key={row} x={0} y={TOP + row * STEP + 10}>
              {dateOfDay(`2026-10-${19 + row}`).toLocaleDateString(currentLocale(), {
                weekday: 'short'
              })}
            </text>
          ))}
        </svg>
        <div className="activity-heat-scroll" ref={scroller} onScroll={() => setTip(null)}>
          <div className="activity-heat-inner" style={{ width }}>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={t('activity.heat.label')}
            >
              <MonthLabels days={days} offset={offset} columns={columns} />
              {days.map((d, i) => {
                const { x, y } = position(i)
                const dim = d.day < first || d.day > last
                return (
                  <rect
                    key={d.day}
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2.5}
                    className={`activity-heat-cell heat-level-${level(d.turns)}${dim ? ' dim' : ''}`}
                    onMouseEnter={() => {
                      const box = scroller.current
                      const shown = LEFT + x - (box?.scrollLeft ?? 0)
                      setTip({ index: i, x: shown, left: shown > (box?.clientWidth ?? width) / 2 })
                    }}
                    onClick={() => onPick(d.day)}
                    data-day={d.day}
                    data-testid="activity-heat-day"
                  />
                )
              })}
              {/* Aujourd'hui cerclé finement ; le jour choisi, d'un anneau plus marqué. */}
              {days.map((d, i) => {
                const today = d.day === heat?.today
                const picked = view.scope === 'day' && d.day === view.date
                if (!today && !picked) return null
                const { x, y } = position(i)
                return (
                  <g key={`ring-${d.day}`}>
                    {today && <Ring x={x} y={y} pad={1.5} className="today" />}
                    {picked && <Ring x={x} y={y} pad={2} className="picked" />}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
        {/* Hors de la zone qui défile : elle ne la coupe pas. */}
        {hovered && tip !== null && (
          <HeatTip
            day={hovered}
            labels={heat?.labels ?? {}}
            at={{ x: tip.x, y: position(tip.index).y }}
            left={tip.left}
          />
        )}
      </div>
      <div className="activity-heat-foot">
        <span>{t('activity.heat.hint')}</span>
        <span className="grow" />
        {t('activity.heat.less')}
        {[0, 1, 2, 3, 4].map((n) => (
          <i key={n} className={`heat-level-${n}`} />
        ))}
        {t('activity.heat.more')}
      </div>
    </div>
  )
}

function Ring({ x, y, pad, className }: { x: number; y: number; pad: number; className: string }) {
  return (
    <rect
      x={x - pad}
      y={y - pad}
      width={CELL + 2 * pad}
      height={CELL + 2 * pad}
      rx={2.5 + pad}
      className={`activity-heat-ring ${className}`}
      data-testid={`activity-heat-${className}`}
    />
  )
}

/** Nom du mois au-dessus de la semaine où il commence. */
function MonthLabels({
  days,
  offset,
  columns
}: {
  days: readonly UsageHeatDay[]
  offset: number
  columns: number
}) {
  const start = days[0]?.day
  if (!start) return null
  const monday = dateOfDay(start)
  monday.setDate(monday.getDate() - offset)
  const mondayOf = (c: number) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * c)
  const labels: { c: number; text: string }[] = []
  for (let c = 0; c < columns; c++) {
    const date = mondayOf(c)
    // Le mois du premier jour affiché dans la colonne (la première commence en milieu de semaine).
    const shown = c === 0 ? dateOfDay(start) : date
    const before = c === 0 ? undefined : mondayOf(c - 1)
    if (before && before.getMonth() === shown.getMonth()) continue
    // Trop près du suivant pour être lu.
    if (c === 0 && shown.getDate() > 20) continue
    labels.push({
      c,
      text: shown.toLocaleDateString(currentLocale(), { month: 'short' })
    })
  }
  return labels.map(({ c, text }) => (
    <text key={c} x={c * STEP} y={11}>
      {text}
    </text>
  ))
}

/** Infobulle d'un jour : « 38 échanges · mardi 20 oct. », puis le partage par agent. */
function HeatTip({
  day,
  labels,
  at,
  left
}: {
  day: UsageHeatDay
  labels: Record<string, string>
  at: { x: number; y: number }
  left: boolean
}) {
  const { t } = useTranslation()
  const agents = Object.entries(day.byAgent).sort((a, b) => b[1] - a[1])
  return (
    <div
      className={`activity-heat-tip${left ? ' left' : ''}`}
      style={{ left: at.x + CELL / 2, top: at.y - 6 }}
      data-testid="activity-heat-tip"
    >
      <strong>{t('activity.heat.tip', { count: day.turns, day: tipDay(day.day) })}</strong>
      {agents.length > 0 && (
        <span>
          {agents
            .map(([id, count]) => t('activity.heat.agent', { agent: labels[id] ?? id, count }))
            .join(' · ')}
        </span>
      )}
    </div>
  )
}
