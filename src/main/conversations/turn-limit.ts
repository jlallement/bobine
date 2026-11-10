/**
 * Réponse à la carte « limite d'étapes » (fiche 209). La carte est vérifiée dans le fil (encore
 * ouverte, réponse proposée par elle), marquée répondue tout de suite (plus de double clic), puis :
 *
 * - « Continuer » : le message fixe de l'app (`CONTINUE_PROMPT`, non traduit, ADR-0014), par le
 *   même chemin qu'un message de l'utilisateur (plafond de coût compris) ;
 * - « Rouvrir la session et continuer » : agent relancé, même session rechargée, message renvoyé ;
 * - « Nouvelle session avec le résumé » : session neuve du même agent (ADR-0030).
 *
 * Un échec est dit dans le fil ; la carte reste répondue (l'utilisateur peut écrire, ou Relancer).
 */
import type { IpcHandlers } from '@shared/ipc'
import { messageOf } from '@shared/errors'
import {
  parseTurnLimitAnswer,
  turnLimitAnswers,
  turnLimitOpen,
  type TurnLimitAnswer
} from '@shared/turn-limit'
import { log } from '../log'
import { CONTINUE_PROMPT } from './cost-cap'
import type { ConversationManager } from './manager'

export type { TurnLimitAnswer }

type Manager = Pick<ConversationManager, 'view' | 'post' | 'prompt'>
/** Relance de l'agent de la conversation pour la limite (`AgentHost.afterTurnLimit`). */
type Restart = (how: 'reopen' | 'renew') => Promise<void>

export async function answerTurnLimit(
  manager: Manager,
  restart: Restart,
  id: string,
  itemId: number,
  answer: TurnLimitAnswer
): Promise<void> {
  const item = manager.view(id).transcript.items.find((i) => i.id === itemId)
  if (item?.kind !== 'turn-limit' || !turnLimitOpen(item)) return
  if (!turnLimitAnswers(item).includes(answer)) return
  manager.post(id, { type: 'turn-limit-answer', itemId, answer })
  try {
    if (answer === 'continue') await manager.prompt(id, CONTINUE_PROMPT)
    else await restart(answer)
  } catch (error) {
    log.warn(`Limite d'étapes : « ${answer} » impossible (${id}) :`, error)
    manager.post(id, { type: 'notice', level: 'error', message: messageOf(error) })
  }
}

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function turnLimitHandlers(
  manager: Pick<ConversationManager, 'answerTurnLimit'>
): Pick<IpcHandlers, 'conversation:answerTurnLimit'> {
  return {
    'conversation:answerTurnLimit': async (id, itemId, answer) => {
      if (typeof itemId !== 'number' || !Number.isInteger(itemId)) {
        throw new Error('Paramètre invalide : itemId')
      }
      await manager.answerTurnLimit(str(id, 'id'), itemId, parseTurnLimitAnswer(answer))
      return undefined
    }
  }
}
