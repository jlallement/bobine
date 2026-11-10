import { useTranslation } from 'react-i18next'
import { ChevronRight, RefreshCw } from 'lucide-react'
import type { ContextBreakdown, ContextLine, ContextLineId } from '@shared/context-breakdown'
import { numberFormat } from '@shared/i18n/format'
import { formatTokens, usageLevel } from '@shared/usage'
import { Tip } from '../common/Menus'

/** Couleur de chaque ligne (barre et pastille), tirée du thème. */
const LINE_CLASS: Record<ContextLineId, string> = {
  messages: 'session-c1',
  bobine: 'session-c2',
  memory: 'session-c4',
  mcp: 'session-c3',
  agent: 'session-other',
  free: 'session-free'
}

/**
 * Contexte de la session (fiche 166) : place occupée par catégorie, sans aucun coût (fiche 113).
 * Avec le total de l'agent (`usage_update`) : barre, pourcentage, « Agent » et « Libre ». Sans
 * (Bob) : « ≈ N utilisés » et ce que Bobine connaît, rien de plus.
 */
export function SessionContext({
  breakdown,
  agentLabel,
  onMeasureMcp,
  onOpenMemory
}: {
  breakdown: ContextBreakdown
  agentLabel: string
  /** « Mesurer » : lance les serveurs MCP de l'agent pour lire leurs outils (fiche 166). */
  onMeasureMcp?: () => void
  /** Ligne « Mémoire » : ouvre Réglages › Mémoire (fiche 182). */
  onOpenMemory?: () => void
}) {
  const { t } = useTranslation()
  const { total, lines } = breakdown
  const tokens = (n: number) => formatTokens(n, true)
  const level = total ? usageLevel(total.ratio) : undefined
  return (
    <section className="session-section" data-testid="session-context">
      <h3 className="session-title">
        {t('sessionTab.context')}
        <span
          className="session-title-value"
          data-testid="session-context-total"
          {...(total ? { 'data-used': total.used, 'data-size': total.size } : {})}
        >
          {total
            ? t('sessionTab.contextTotal', {
                used: tokens(total.used),
                size: tokens(total.size),
                percent: numberFormat({ style: 'percent' }).format(total.ratio)
              })
            : t('sessionTab.contextUsed', { used: tokens(breakdown.estimated) })}
        </span>
      </h3>
      {total && (
        <div
          className={`session-bar${level ? ` ${level}` : ''}`}
          role="img"
          aria-label={t('sessionTab.contextTotal', {
            used: tokens(total.used),
            size: tokens(total.size),
            percent: numberFormat({ style: 'percent' }).format(total.ratio)
          })}
          data-testid="session-context-bar"
        >
          {lines
            .filter((line) => line.id !== 'free' && line.tokens > 0)
            .map((line) => (
              <span
                key={line.id}
                className={`session-bar-part ${LINE_CLASS[line.id]}`}
                style={{ width: `${(line.tokens / total.size) * 100}%` }}
              />
            ))}
        </div>
      )}
      <ul className="session-lines">
        {lines.map((line) => (
          <li
            key={line.id}
            className="session-line"
            data-line={line.id}
            // Valeur exacte, pour les essais (l'affichage est compact).
            data-tokens={line.tokens}
            data-testid="session-line"
          >
            <span className={`session-dot ${LINE_CLASS[line.id]}`} />
            <Tip label={t(`sessionTab.lineTip.${line.id}`)}>
              {line.id === 'memory' && onOpenMemory ? (
                <button
                  type="button"
                  className="session-line-label session-line-link"
                  onClick={onOpenMemory}
                  data-testid="session-memory-open"
                >
                  {t(`sessionTab.line.${line.id}`)}
                  <ChevronRight size={12} aria-hidden />
                </button>
              ) : (
                <span className="session-line-label">{t(`sessionTab.line.${line.id}`)}</span>
              )}
            </Tip>
            <LineValue line={line} format={tokens} onMeasure={onMeasureMcp} />
          </li>
        ))}
      </ul>
      <p className="session-hint" data-testid="session-context-hint">
        {total ? (
          <Tip label={t('sessionTab.estimateTip')}>
            <span>{t('sessionTab.estimateHint')}</span>
          </Tip>
        ) : (
          t('sessionTab.noTotal', { agent: agentLabel })
        )}
      </p>
    </section>
  )
}

/**
 * Valeur d'une ligne. Autres MCP : « … » pendant la mesure, « Mesurer » si rien n'est connu,
 * sinon la valeur connue, « 2 sur 3 mesurés » s'il en manque, et de quoi la rafraîchir.
 */
function LineValue({
  line,
  format,
  onMeasure
}: {
  line: ContextLine
  format: (n: number) => string
  onMeasure: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const value = line.estimated
    ? t('sessionTab.approx', { tokens: format(line.tokens) })
    : format(line.tokens)
  const mcp = line.mcp
  if (!mcp) {
    return (
      <span className="session-line-value" data-testid="session-line-value">
        {value}
      </span>
    )
  }
  if (mcp.testing) {
    return (
      <span className="session-line-value" data-testid="session-line-value">
        {t('sessionTab.measuring')}
      </span>
    )
  }
  const measure = onMeasure && (
    <Tip label={t('sessionTab.measureTip')}>
      <button
        type="button"
        className={mcp.measured === 0 ? 'session-measure' : 'icon-button small session-remeasure'}
        onClick={onMeasure}
        aria-label={t('sessionTab.measureTip')}
        data-testid="session-measure-mcp"
      >
        {mcp.measured === 0 ? t('sessionTab.measure') : <RefreshCw size={12} />}
      </button>
    </Tip>
  )
  if (mcp.measured === 0) {
    return (
      <span className="session-line-value" data-testid="session-line-value">
        {measure}
      </span>
    )
  }
  return (
    <span className="session-line-value" data-testid="session-line-value">
      {mcp.measured < mcp.servers && (
        <span className="session-line-note" data-testid="session-mcp-partial">
          {t('sessionTab.measuredOf', { count: mcp.measured, total: mcp.servers })}
        </span>
      )}
      {value}
      {measure}
    </span>
  )
}
