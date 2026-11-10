/**
 * Limite d'étapes de l'agent, côté hôte (fiche 209). Rien de propre à un agent : la raison d'arrêt
 * ACP `max_turn_requests` et ce que l'hôte a vu pendant le tour.
 *
 * - Un tour sans aucun travail de l'agent (ni texte, ni réflexion, ni outil, ni plan) qui finit
 *   par la limite est un **refus** : la limite vaut pour toute la session (Bob 2.0.9 : compte
 *   jamais remis à zéro dans un processus, vu ; `session/load` dans le même processus : non
 *   vérifié). Le message refusé est gardé pour être renvoyé.
 * - « Rouvrir la session et continuer » : l'agent est relancé et la même session rechargée (qui
 *   reconstruit la tâche chez Bob), puis le message renvoyé une fois (mécanisme de D10). Proposé
 *   seulement si l'agent sait recharger (`loadSession`), et pas juste après une réouverture refusée.
 * - « Nouvelle session avec le résumé » : session neuve du même agent (ADR-0030, `turn-limit`).
 */
import { t } from 'i18next'
import type { ContentBlock, SessionUpdate } from '../../shared/acp-sdk.mts'
import type { TurnLimitSeen } from '@shared/turn-limit'
import type { BlockedTurn } from './turn-auth'

/** Ce qui compte comme du travail de l'agent : un refus n'en envoie aucun. */
const WORK = new Set<SessionUpdate['sessionUpdate']>([
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan'
])

export class TurnLimitWatch {
  /** Message du tour en cours (ou du dernier), et sa session. */
  private turn: BlockedTurn | undefined
  /** Travail de l'agent vu pendant le tour. */
  private worked = false
  /** La session vient d'être rouverte pour la limite : un nouveau refus ne la propose plus. */
  private reopened = false
  /** Prochaine ouverture de session : une session neuve, pour la limite. */
  private renewal = false

  turnStarted(sessionId: string, blocks: ContentBlock[]): void {
    this.turn = { sessionId, blocks }
    this.worked = false
  }

  /** Mise à jour de la session pendant le tour. */
  note(update: SessionUpdate): void {
    if (WORK.has(update.sessionUpdate)) this.worked = true
  }

  /** Fin du tour : ce que la carte doit dire, ou `undefined` hors `max_turn_requests`. */
  ended(stopReason: string, canReload: boolean): TurnLimitSeen | undefined {
    const reopened = this.reopened
    this.reopened = false
    if (stopReason !== 'max_turn_requests') return undefined
    const refused = !this.worked
    return { refused, reopen: refused && canReload && !reopened }
  }

  /**
   * « Rouvrir » ou « Nouvelle session » : le message du dernier tour, à renvoyer. Refusé hors d'un
   * agent prêt dans la session de ce tour, ou pour rouvrir chez un agent qui ne sait pas recharger.
   */
  prepare(
    answer: 'reopen' | 'renew',
    now: { status: string; sessionId: string | undefined; support: { load: boolean } }
  ): BlockedTurn {
    const turn = this.turn
    if (now.status !== 'ready' || !turn || turn.sessionId !== now.sessionId) {
      throw new Error(t('agentHost.notReady', { status: now.status }))
    }
    if (answer === 'reopen' && !now.support.load) throw new Error(t('agentHost.turnLimit.noReload'))
    if (answer === 'reopen') this.reopened = true
    else this.renewal = true
    return turn
  }

  /** Session neuve à ouvrir (une fois) : pour la limite, au lieu de rouvrir la session. */
  takeRenewal(): boolean {
    const renewal = this.renewal
    this.renewal = false
    return renewal
  }
}
