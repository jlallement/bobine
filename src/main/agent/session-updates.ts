/**
 * Tri des `session/update` de l'agent : ce que l'hôte fait d'une mise à jour d'après l'état de la
 * session — commandes « / », mise à jour écartée (autre session, écho de nos messages, rejeu
 * ignoré), travail d'un sous-agent, ou mise à jour du fil (avec le mode ou les options qu'elle
 * change). Pur : testable sans agent. Les règles du rejeu sont faites pour des agents réels
 * (Bob 2.0.6 rejoue après sa réponse à `session/load`) : les changer demande un essai avec eux.
 */
import type {
  AvailableCommand,
  SessionConfigOption,
  SessionNotification
} from '../../shared/acp-sdk.mts'
import type { AgentCommand } from '@shared/agent'
import type { ChildSession, SubagentStream } from './adapters'

/** État de la session dont dépend le tri. */
export interface UpdateContext {
  /** Session de la conversation ; `undefined` tant que l'ouverture n'a pas répondu. */
  sessionId: string | undefined
  /** Un de nos tours est en cours. */
  busy: boolean
  /** Rejeu en cours (`session/load`) : seuls moments où les messages utilisateur viennent de l'agent. */
  replaying: boolean
  /** Rejeu à réconcilier avec le fil de l'app gardé (fiche 103), jusqu'au prochain message envoyé. */
  ignoreReplay: boolean
  /** Travail des sous-agents relayé dans le flux de la conversation (profil de l'agent). */
  subagentStream?: SubagentStream
}

export type UpdateRoute =
  /** Commandes « / » annoncées pour la session. */
  | { kind: 'commands'; commands: AgentCommand[] }
  /** Rien à faire. */
  | { kind: 'drop' }
  /** Rejeu d'une session dont le fil de l'app est gardé (fiche 103) : à réconcilier, pas à afficher. */
  | { kind: 'replayed' }
  /** Travail d'un sous-agent, à ranger sous sa carte. */
  | { kind: 'subagent'; stream: SubagentStream; child: ChildSession }
  /**
   * Mise à jour du fil, qui change aussi le mode courant (`mode`) ou les options de la session
   * (`configOptions`) ; `trackSubagents` : à montrer au suivi des sous-agents (hors rejeu).
   */
  | {
      kind: 'thread'
      mode?: string
      configOptions?: SessionConfigOption[]
      trackSubagents: boolean
    }

/** Mises à jour qui font partie du rejeu d'une conversation (le fil, pas l'état de la session). */
const REPLAYED_UPDATES = new Set<string>([
  'user_message_chunk',
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan'
])

export function routeUpdate(
  { sessionId, update }: SessionNotification,
  context: UpdateContext
): UpdateRoute {
  // Les commandes peuvent arriver juste avant que la réponse à `session/new` soit traitée
  // (même paquet) : on les accepte tant que l'identifiant de session n'est pas connu.
  if (
    update.sessionUpdate === 'available_commands_update' &&
    (context.sessionId === undefined || sessionId === context.sessionId)
  ) {
    return { kind: 'commands', commands: commandsOf(update.availableCommands) }
  }
  // Sessions enfants (sous-agents) : aucun agent cible n'en envoie (fiche 010) ; ignorées.
  if (sessionId !== context.sessionId) return { kind: 'drop' }
  // Nos propres messages sont émis par prompt() : un écho de l'agent pendant un de nos tours
  // est ignoré. Hors de nos tours, c'est le rejeu de l'historique — y compris quand l'agent
  // le rejoue APRÈS sa réponse à `session/load` (Bob 2.0.6).
  if (update.sessionUpdate === 'user_message_chunk' && !context.replaying && context.busy) {
    return { kind: 'drop' }
  }
  if (context.ignoreReplay && REPLAYED_UPDATES.has(update.sessionUpdate))
    return { kind: 'replayed' }
  // Travail d'un sous-agent relayé dans le flux de la conversation (OpenCode 2, fiche 078) :
  // rangé sous sa carte, jamais mêlé au fil.
  const stream = context.subagentStream
  const child = stream?.childOf(update)
  if (stream && child) return { kind: 'subagent', stream, child }
  const trackSubagents = !context.replaying
  if (update.sessionUpdate === 'current_mode_update') {
    return { kind: 'thread', mode: update.currentModeId, trackSubagents }
  }
  if (update.sessionUpdate === 'config_option_update') {
    return { kind: 'thread', configOptions: update.configOptions, trackSubagents }
  }
  return { kind: 'thread', trackSubagents }
}

/** Commandes « / » telles que l'app les montre : sans nom, écartées ; l'indice gardé. */
function commandsOf(available: readonly AvailableCommand[]): AgentCommand[] {
  return available
    .filter((c) => typeof c.name === 'string' && c.name.trim() !== '')
    .map((c) => ({
      name: c.name,
      description: c.description,
      ...(c.input && 'hint' in c.input && typeof c.input.hint === 'string'
        ? { hint: c.input.hint }
        : {})
    }))
}
