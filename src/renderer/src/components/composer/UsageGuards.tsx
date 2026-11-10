import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FoldVertical } from 'lucide-react'
import { capUnitOf, effectiveCap, formatCap, TOKEN_UNIT } from '@shared/cost-cap'
import { unitLabel, type ConversationUsage } from '@shared/usage'
import type { UsageActions } from '../../useTurnGuards'
import { Tip } from '../common/Menus'
import '../../turn-guards.css'

/**
 * Contexte presque plein (fiche 157) : « Compacter » à côté de la puce orange, qui envoie la
 * commande de compaction du profil (comme `/compact`). Rien sans commande, ni agent prêt.
 */
export function CompactButton({
  actions,
  level
}: {
  actions: UsageActions | undefined
  /** Niveau de la jauge de contexte (`warn` à 80 %, `full` à 95 %). */
  level: 'warn' | 'full' | undefined
}) {
  const { t } = useTranslation()
  if (!level || !actions?.onCompact) return null
  return (
    <Tip label={t('turnGuards.compact.tip', { command: actions.compactCommand ?? '' })}>
      <button
        type="button"
        className={`chip compact-chip ${level}`}
        onClick={actions.onCompact}
        data-testid="usage-compact"
      >
        <FoldVertical size={14} aria-hidden />
        <span className="chip-label">{t('turnGuards.compact.button')}</span>
      </button>
    </Tip>
  )
}

/**
 * Plafond de la conversation dans le détail de la consommation (fiche 157) : celui en vigueur,
 * une valeur propre, « Par défaut » (les montants des réglages) ou « Aucun » (aussi pour une
 * conversation créée sans plafond). Dans l'unité de l'agent ;
 * rien tant que l'agent n'a donné ni coût ni jetons.
 */
export function CostCapRow({
  usage,
  actions
}: {
  usage: ConversationUsage
  actions: UsageActions | undefined
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const unit = capUnitOf(usage)
  const { preferences, onSetCostCap, costCap } = actions ?? {}
  if (!unit || !preferences || !onSetCostCap) return null
  const cap = effectiveCap(costCap, preferences, usage)
  // Plafond propre dans une autre unité : celui des réglages s'applique (`effectiveCap`).
  const own = typeof costCap === 'object' && costCap.unit !== unit ? 'settings' : costCap
  const commit = () => {
    const limit = Number(draft.replace(',', '.'))
    if (draft.trim() && Number.isFinite(limit) && limit > 0) onSetCostCap({ limit, unit })
    setDraft('')
  }
  return (
    <div className="usage-section" data-testid="usage-cap">
      <div className="usage-row">
        <span>{t('turnGuards.cap.row')}</span>
        <strong data-testid="usage-cap-value">
          {cap
            ? own === 'settings'
              ? t('turnGuards.cap.fromSettings', { limit: formatCap(cap.limit, unit) })
              : formatCap(cap.limit, unit)
            : t('turnGuards.cap.none')}
        </strong>
      </div>
      <div className="usage-cap-edit">
        <input
          type="number"
          min={0}
          step={unit === TOKEN_UNIT ? 1000 : 0.5}
          className="settings-input usage-cap-input"
          aria-label={t('turnGuards.cap.input')}
          placeholder={cap ? String(cap.limit) : ''}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
          onBlur={commit}
          data-testid="usage-cap-input"
        />
        <span className="usage-cap-unit">
          {unit === TOKEN_UNIT ? t('turnGuards.cap.tokensUnit') : unitLabel(unit)}
        </span>
        <span className="grow" />
        <button
          type="button"
          className="usage-cap-choice"
          aria-pressed={own === 'settings'}
          title={t('turnGuards.cap.defaultTip')}
          onClick={() => onSetCostCap('settings')}
          data-testid="usage-cap-default"
        >
          {t('turnGuards.cap.default')}
        </button>
        <button
          type="button"
          className="usage-cap-choice"
          aria-pressed={!own || own === 'none'}
          title={t('turnGuards.cap.noneTip')}
          onClick={() => onSetCostCap('none')}
          data-testid="usage-cap-none"
        >
          {t('turnGuards.cap.none')}
        </button>
      </div>
    </div>
  )
}
