/**
 * Agents vivants (fiches 043, 102) : combien en garder, lesquels mettre en veille, comment les
 * arrêter. Sorti de `manager.ts` pour lui faire de la place ; sans état.
 *
 * Le plafond est le réglage « Conversations gardées actives » (Réglages › Conversation), sauf si
 * `BOBINE_MAX_LIVE` en impose un au lancement (essais). C'est une limite souple : une conversation
 * gardée (affichée, occupée, fille en cours, mère qui attend ses filles…) n'est jamais arrêtée,
 * quitte à dépasser le plafond.
 */
import type { AgentSnapshot } from '@shared/agent'
import type { AgentHost } from '../agent/agent-host'

/** Plafond imposé au lancement par `BOBINE_MAX_LIVE` (essais), prioritaire sur le réglage. */
export function imposedLiveLimit(env: NodeJS.ProcessEnv): number | undefined {
  const value = Number(env['BOBINE_MAX_LIVE'])
  return Number.isInteger(value) && value > 0 ? value : undefined
}

/**
 * Agents à mettre en veille pour revenir à `max` vivants : les moins récemment utilisés d'abord,
 * jamais un agent gardé. S'il n'y en a pas assez à arrêter, on s'en tient là.
 */
export function agentsToStop<T extends { lastUsed: number }>(
  live: readonly T[],
  max: number,
  kept: (agent: T) => boolean
): T[] {
  const excess = live.length - max
  if (excess <= 0) return []
  return live
    .filter((agent) => !kept(agent))
    .sort((a, b) => a.lastUsed - b.lastUsed)
    .slice(0, excess)
}

/**
 * Arrête l'agent d'une conversation (archivée, ou mise en veille pour faire de la place) : sa
 * session est fermée, puis son processus. Il n'émet plus rien dès cet appel.
 */
export function releaseAgent(conversation: { host?: AgentHost; snapshot?: AgentSnapshot }): void {
  const host = conversation.host
  conversation.host = undefined
  conversation.snapshot = undefined
  void host
    ?.closeSession()
    .catch(() => {})
    .finally(() => host.stop())
}
