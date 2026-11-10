import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import {
  contextRatio,
  conversationCost,
  formatCost,
  formatTokens,
  hasUsage,
  turnAverages,
  turnCost,
  usageLevel,
  withoutCost,
  type ConversationUsage,
  type TurnUsage
} from '@shared/usage'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'
import type { UsageActions } from '../../useTurnGuards'
import { CompactButton, CostCapRow } from './UsageGuards'
import { fullTime, messageTime } from '../../time'
import { usePresentation } from '../../presentation'

/** Échanges détaillés dans le panneau : les plus récents. */
const SHOWN_TURNS = 20

/**
 * Consommation de la conversation : anneau de remplissage du contexte (ou le coût, pour un agent
 * qui ne donne pas de contexte, comme Bob), détail au clic — contexte, jetons, coût, moyenne par
 * échange et une ligne par échange (fiches 019, 109, 113 : le seul endroit où le coût d'une
 * conversation se voit). « Toute la consommation… » mène au tableau de toutes (fiche 137).
 * N'affiche que ce que l'agent rapporte ; rien du tout s'il ne rapporte rien. Fiche 157 :
 * « Compacter » à côté quand le contexte est presque plein, plafond de la conversation au détail.
 */
export function UsageMeter({
  usage: reported,
  agentLabel,
  compact = false,
  actions,
  onOpenUsage
}: {
  usage?: ConversationUsage
  agentLabel: string
  /** Barre repliée (fiche 092) : l'anneau seul, le pourcentage passe dans l'infobulle. */
  compact?: boolean
  /** Compaction en un clic, plafond de la conversation (fiche 157). */
  actions?: UsageActions
  /** « Toute la consommation… » : Réglages › Consommation (fiche 137). */
  onOpenUsage?: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Mode présentation (fiche 159) : aucun montant.
  const presenting = usePresentation()
  const usage = presenting && reported ? withoutCost(reported) : reported
  if (!hasUsage(usage)) return null
  const ratio = contextRatio(usage)
  const gauge = ratio === undefined ? undefined : usageLevel(ratio)
  const level = gauge ? ` ${gauge}` : ''
  const percent = ratio === undefined ? undefined : Math.round(ratio * 100)
  // Toute la conversation, sessions précédentes comprises (fiche 164).
  const cost = conversationCost(usage)
  const r = 7
  const circumference = 2 * Math.PI * r

  return (
    <>
      <CompactButton actions={actions} level={gauge} />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Tip
          label={
            compact && percent !== undefined ? t('usage.compactTip', { percent }) : t('usage.label')
          }
        >
          <Popover.Trigger
            className={`chip usage-chip${level}`}
            aria-label={t('usage.label')}
            data-testid="usage-meter"
          >
            {ratio !== undefined ? (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <circle cx="9" cy="9" r={r} className="usage-track" />
                  <circle
                    cx="9"
                    cy="9"
                    r={r}
                    className="usage-fill"
                    strokeDasharray={`${circumference * ratio} ${circumference}`}
                    transform="rotate(-90 9 9)"
                  />
                </svg>
                <span className="usage-percent">
                  {t('usage.percent', { percent: percent ?? '' })}
                </span>
              </>
            ) : cost.total ? (
              <span>{formatCost(cost.total)}</span>
            ) : (
              <span>
                {t('usage.tokensValue', { tokens: formatTokens(usage.tokens?.total ?? 0, true) })}
              </span>
            )}
          </Popover.Trigger>
        </Tip>
        <Popover.Portal>
          <Popover.Content
            className="menu usage-popover"
            side="top"
            align="end"
            sideOffset={8}
            data-testid="usage-details"
          >
            <div className="menu-label">{t('usage.title', { agent: agentLabel })}</div>
            {usage.context && (
              <div className="usage-section">
                <div className="usage-row">
                  <span>{t('usage.context')}</span>
                  <strong>
                    {t('usage.contextValue', {
                      used: formatTokens(usage.context.used),
                      size: formatTokens(usage.context.size),
                      percent: percent ?? ''
                    })}
                  </strong>
                </div>
                <div className={`usage-bar${level}`}>
                  <span style={{ width: `${(ratio ?? 0) * 100}%` }} />
                </div>
                {gauge && <div className="usage-hint">{t('usage.contextHint')}</div>}
              </div>
            )}
            {usage.tokens && (
              <div className="usage-section" title={t('usage.tokensHint')}>
                <div className="usage-row">
                  <span>{t('usage.tokens.total', { count: usage.tokens.turns })}</span>
                  <strong>{formatTokens(usage.tokens.total)}</strong>
                </div>
                <TokenRows counts={usage.tokens} />
                {usage.lastTurn && (
                  <div className="usage-row sub">
                    <span>{t('usage.lastTurn')}</span>
                    <span>{formatTokens(usage.lastTurn.total)}</span>
                  </div>
                )}
              </div>
            )}
            {cost.total && (
              <div className="usage-section">
                <div className="usage-row">
                  <span>{t('usage.cost')}</span>
                  <strong data-testid="usage-cost">{formatCost(cost.total)}</strong>
                </div>
                {cost.session && (
                  <div className="usage-row sub" data-testid="usage-session-cost">
                    <span>{t('usage.sessionCost')}</span>
                    <span>{formatCost(cost.session)}</span>
                  </div>
                )}
                {cost.others.map((other) => (
                  <div
                    className="usage-row sub"
                    key={other.currency}
                    data-testid="usage-other-cost"
                  >
                    <span>{t('usage.otherAgentCost')}</span>
                    <span>{formatCost(other)}</span>
                  </div>
                ))}
              </div>
            )}
            <CostCapRow usage={usage} actions={actions} />
            <TurnSections usage={usage} />
            {onOpenUsage && (
              <button
                className="usage-all"
                onClick={() => {
                  setOpen(false)
                  onOpenUsage()
                }}
                data-testid="usage-open-board"
              >
                {t('usage.board.openAll')}
              </button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}

/**
 * Moyenne par échange (ce que coûtera vraisemblablement le prochain) et une ligne par échange, le
 * plus récent en haut (fiche 109). Rien tant qu'aucun échange n'a rapporté jetons ou coût.
 */
function TurnSections({ usage }: { usage: ConversationUsage }) {
  const { t } = useTranslation()
  const turns = usage.turns ?? []
  const average = turnAverages(turns)
  const currency = usage.cost?.currency
  const shown = turns.slice(-SHOWN_TURNS).reverse()
  // Agent qui ne donne que son coût (Bob) : pas de colonne de tirets.
  const withTokens = shown.some((turn) => turn.total !== undefined)
  const averageText = [
    ...(average.cost !== undefined && currency
      ? [formatCost({ amount: average.cost, currency })]
      : []),
    ...(average.tokens !== undefined
      ? [t('usage.tokensValue', { tokens: formatTokens(average.tokens) })]
      : [])
  ].join(' · ')
  if (!averageText && shown.length === 0) return null
  return (
    <div className="usage-section">
      {averageText && (
        <div className="usage-row" title={t('usage.averageHint')} data-testid="usage-average">
          <span>{t('usage.average')}</span>
          <strong>{averageText}</strong>
        </div>
      )}
      {shown.length > 0 && (
        <>
          <div className="usage-row sub">
            <span>{t('usage.turns.title')}</span>
          </div>
          <ol className="cost-turns" data-testid="usage-turns">
            {shown.map((turn, index) => (
              <TurnRow
                key={turns.length - index}
                turn={turn}
                currency={currency}
                withTokens={withTokens}
              />
            ))}
          </ol>
          {turns.length > shown.length && (
            <div className="usage-hint">
              {t('usage.turns.older', { count: turns.length - shown.length })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Un échange : heure, jetons entrée → sortie, coût. Un tiret quand l'agent ne le donne pas. */
function TurnRow({
  turn,
  currency,
  withTokens
}: {
  turn: TurnUsage
  currency: string | undefined
  withTokens: boolean
}) {
  const { t } = useTranslation()
  const cost = turnCost(turn)
  return (
    <li className={`cost-turn${withTokens ? '' : ' cost-only'}`} data-testid="usage-turn">
      <span className="cost-turn-at" {...(turn.at ? { title: fullTime(turn.at) } : {})}>
        {turn.at ? messageTime(turn.at) : '—'}
      </span>
      {withTokens && (
        <span className="cost-turn-tokens" title={t('usage.turns.tokensTip')}>
          {turn.total !== undefined
            ? t('usage.turns.tokens', {
                input: formatTokens(turn.input ?? 0, true),
                output: formatTokens(turn.output ?? 0, true)
              })
            : '—'}
        </span>
      )}
      <span className="cost-turn-cost">
        {cost !== undefined && currency ? formatCost({ amount: cost, currency }) : '—'}
      </span>
    </li>
  )
}

function TokenRows({ counts }: { counts: NonNullable<ConversationUsage['tokens']> }) {
  const { t } = useTranslation()
  const rows: [string, number][] = [
    [t('usage.tokens.input'), counts.input],
    [t('usage.tokens.output'), counts.output],
    [t('usage.tokens.cachedRead'), counts.cachedRead],
    [t('usage.tokens.cachedWrite'), counts.cachedWrite],
    [t('usage.tokens.thought'), counts.thought]
  ]
  return (
    <>
      {rows
        .filter(([, n]) => n > 0)
        .map(([label, n]) => (
          <div key={label} className="usage-row sub">
            <span>{label}</span>
            <span>{formatTokens(n)}</span>
          </div>
        ))}
    </>
  )
}
