import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { CirclePause, CircleSlash } from 'lucide-react'
import type { TranscriptItem } from '@shared/transcript'
import { turnLimitAnswers, type TurnLimitAnswer } from '@shared/turn-limit'
import type { ParseKeysWithoutVariables } from 'i18next'
import { TurnControlsContext } from '../../turn-controls'
import '../../turn-guards.css'

const BUTTONS: Record<TurnLimitAnswer, ParseKeysWithoutVariables> = {
  continue: 'turnGuards.limit.continue',
  reopen: 'turnGuards.limit.reopen',
  renew: 'turnGuards.limit.renew'
}

const ANSWERED: Record<TurnLimitAnswer, ParseKeysWithoutVariables> = {
  continue: 'turnGuards.limit.continued',
  reopen: 'turnGuards.limit.reopened',
  renew: 'turnGuards.limit.renewed'
}

/**
 * Tour arrêté par la limite d'étapes de l'agent (fiche 209), sur le modèle de la carte du plafond :
 * « Continuer » après du travail ; après un refus sans rien faire, « Rouvrir la session et
 * continuer » (si proposé) et « Nouvelle session avec le résumé ». Une fois répondue, ce qui a été
 * choisi. Sans `TurnControls` (fil d'un sous-agent, essais), la carte se lit sans boutons.
 */
export function TurnLimitCard({ item }: { item: Extract<TranscriptItem, { kind: 'turn-limit' }> }) {
  const { t } = useTranslation()
  const controls = useContext(TurnControlsContext)
  const answers = turnLimitAnswers(item)
  const Icon = item.refused ? CircleSlash : CirclePause
  return (
    <div
      className="cost-cap-card turn-limit-card"
      data-testid="turn-limit-card"
      data-refused={item.refused}
      data-answer={item.answer ?? ''}
    >
      <div className="cost-cap-title">
        <Icon size={15} aria-hidden />
        <strong>
          {t(item.refused ? 'turnGuards.limit.refusedTitle' : 'turnGuards.limit.title')}
        </strong>
      </div>
      <p className="cost-cap-detail">
        {t(item.refused ? 'turnGuards.limit.refusedDetail' : 'turnGuards.limit.detail')}
      </p>
      {item.answer ? (
        <p className="cost-cap-answer" data-testid="turn-limit-answer">
          {t(ANSWERED[item.answer])}
        </p>
      ) : (
        controls &&
        !item.superseded && (
          <div className="cost-cap-actions">
            {answers.map((answer, index) => (
              <button
                key={answer}
                type="button"
                className={`btn small ${index === 0 ? 'primary' : 'ghost'}`}
                disabled={controls.busy}
                onClick={() => controls.answerTurnLimit(item.id, answer)}
                data-testid={`turn-limit-${answer}`}
              >
                {t(BUTTONS[answer])}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
