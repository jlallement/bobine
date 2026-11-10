import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleDollarSign } from 'lucide-react'
import { formatCap } from '@shared/cost-cap'
import type { TranscriptItem } from '@shared/transcript'
import { TurnControlsContext } from '../../turn-controls'
import '../../turn-guards.css'

/**
 * Plafond de coût franchi (fiche 157) : ce que la conversation a coûté, et « Continuer (plafond
 * + X) » ou « Arrêter » ; une fois répondu, ce qui a été choisi. Sans `TurnControls` (fil d'un
 * sous-agent, essais), la carte se lit sans boutons.
 */
export function CostCapCard({ item }: { item: Extract<TranscriptItem, { kind: 'cost-cap' }> }) {
  const { t } = useTranslation()
  const controls = useContext(TurnControlsContext)
  const values = {
    spent: formatCap(item.spent, item.unit),
    limit: formatCap(item.limit, item.unit)
  }
  return (
    <div className="cost-cap-card" data-testid="cost-cap-card" data-answer={item.answer ?? ''}>
      <div className="cost-cap-title">
        <CircleDollarSign size={15} aria-hidden />
        <strong>{t('turnGuards.cap.title')}</strong>
      </div>
      <p className="cost-cap-detail">
        {t(item.interrupted ? 'turnGuards.cap.interrupted' : 'turnGuards.cap.ended', values)}
      </p>
      {item.held !== undefined && (
        <blockquote className="cost-cap-held" data-testid="cost-cap-held">
          <span>
            {t(item.answer === 'continue' ? 'turnGuards.cap.heldSent' : 'turnGuards.cap.held')}
          </span>
          {item.held && <q>{item.held}</q>}
        </blockquote>
      )}
      {item.answer ? (
        <p className="cost-cap-answer" data-testid="cost-cap-answer">
          {item.answer === 'continue'
            ? t('turnGuards.cap.continued', {
                limit: formatCap(item.raisedTo ?? item.limit + item.step, item.unit)
              })
            : t(item.held !== undefined ? 'turnGuards.cap.heldDropped' : 'turnGuards.cap.stopped')}
        </p>
      ) : (
        controls &&
        !item.superseded && (
          <div className="cost-cap-actions">
            <button
              type="button"
              className="btn primary small"
              onClick={() => controls.answerCostCap(item.id, 'continue')}
              data-testid="cost-cap-continue"
            >
              {t('turnGuards.cap.continue', { step: formatCap(item.step, item.unit) })}
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => controls.answerCostCap(item.id, 'stop')}
              data-testid="cost-cap-stop"
            >
              {t('turnGuards.cap.stop')}
            </button>
          </div>
        )
      )}
    </div>
  )
}
