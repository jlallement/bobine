/**
 * Rejeu d'une trace ACP (fiche 139) dans le tri des mises à jour (`routeUpdate`) et le réducteur
 * du fil (`reduceTranscript`), comme `AgentHost` les enchaîne : adaptateurs du profil d'abord
 * (`ProfileUpdates` : diffs, échecs d'outils, marque des sous-agents ; travail des sous-agents), puis l'état de la session (ouverte, tour en
 * cours, rejeu de `session/load`). Pur : aucune connexion, aucun processus.
 *
 * Ce qui n'est pas rejoué : les outils de l'app (serveur MCP), le suivi des sous-agents par leur
 * session ou la base de Bob, le coût lu hors protocole. Le fil obtenu est celui que les messages de
 * l'agent, à eux seuls, donnent.
 */
import type { AnyMessage, SessionNotification } from '../../shared/acp-sdk.mts'
import type { AgentEvent, ElicitationPrompt } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptState } from '@shared/transcript'
import type { Trace } from './acp-trace'
import type { FileExists } from './new-files'
import { permissionRisks } from './permission-risk'
import { ProfileUpdates } from './profile-updates'
import type { AgentProfile } from './profiles'
import { routeUpdate } from './session-updates'

/** Ce que le rejeu reprend du profil de l'agent (ses adaptateurs). */
export type ReplayProfile = Pick<
  AgentProfile,
  'diffSource' | 'toolStatus' | 'subagentFormat' | 'subagentStream'
>

export interface TraceReplay {
  events: AgentEvent[]
  transcript: TranscriptState
}

type Message = Record<string, unknown> & { id?: string | number | null; method?: string }

const isRequest = (m: Message) => typeof m.method === 'string' && m.id !== undefined
const isNotification = (m: Message) => typeof m.method === 'string' && m.id === undefined
const isResponse = (m: Message) => m.method === undefined && m.id !== undefined
const key = (side: string, id: unknown) => `${side}:${String(id)}`

/** Texte du message de l'utilisateur : le premier bloc de texte (l'app joint le reste après). */
function promptText(params: unknown): string {
  const blocks = (params as { prompt?: { type: string; text?: string }[] }).prompt ?? []
  return blocks.find((b) => b.type === 'text')?.text ?? ''
}

function elicitationPrompt(params: Record<string, unknown>): ElicitationPrompt {
  const message = String(params['message'] ?? '')
  if (params['mode'] === 'url') return { mode: 'url', message, url: String(params['url'] ?? '') }
  return {
    mode: 'form',
    message,
    schema: (params['requestedSchema'] ?? { type: 'object', properties: {} }) as never,
    ...(typeof params['toolCallId'] === 'string' ? { toolCallId: params['toolCallId'] } : {})
  }
}

/** Dossier personnel fictif du rejeu (`<home>` des traces). */
const REPLAY_HOME = '/home-sonde'

/** Le rejeu ne lit pas le disque : aucun chemin n'existe, aucun lien n'est suivi. */
const noDisk = (): string => {
  throw new Error('rejeu : pas de disque')
}

/**
 * Chemins nettoyés de la trace (`<dossier>`, `<home>`, `<maison>`) remis sous des dossiers absolus
 * fictifs : les adaptateurs résolvent des chemins relatifs au dossier de la session.
 */
function withPaths(message: AnyMessage, workspace: string): AnyMessage {
  const text = JSON.stringify(message)
    .replaceAll('<dossier>', workspace)
    .replaceAll('<home>', REPLAY_HOME)
    .replaceAll('<maison>', '/maison')
  return JSON.parse(text) as AnyMessage
}

export function replayTrace(
  trace: Trace,
  profile: ReplayProfile = {},
  workspace = '/dossier',
  /** Le disque vu par l'adaptation (fichiers nouveaux, fiche 203) : par défaut, le vrai. */
  exists?: FileExists
): TraceReplay {
  const events: AgentEvent[] = []
  let transcript = emptyTranscript
  const emit = (event: AgentEvent) => {
    events.push(event)
    transcript = reduceTranscript(transcript, event)
  }
  /** Requêtes en attente de réponse, par côté et identifiant : leur méthode. */
  const pending = new Map<string, string>()
  let sessionId: string | undefined
  let busy = false
  let replaying = false

  const adapters = new ProfileUpdates(profile, workspace, exists)
  const { subagentStream } = profile

  const onUpdate = (notification: SessionNotification) => {
    const update = adapters.adapt(notification.update, !replaying)
    const route = routeUpdate(
      { ...notification, update },
      { sessionId, busy, replaying, ignoreReplay: false, subagentStream }
    )
    if (route.kind === 'thread') emit({ type: 'update', update })
    if (route.kind === 'subagent') {
      // Sous sa carte : la dernière carte de sous-agent du fil (l'hôte la suit par son titre).
      const card = transcript.items.findLast((i) => i.kind === 'tool' && i.subagent)
      if (card?.kind === 'tool')
        emit({
          type: 'subagent-update',
          toolCallId: card.toolCallId,
          update: route.stream.forCard(update, route.child)
        })
    }
  }

  const fromClient = (m: Message) => {
    if (isRequest(m)) pending.set(key('client', m.id), m.method ?? '')
    const params = (m['params'] ?? {}) as Record<string, unknown>
    switch (m.method) {
      case 'session/load':
        replaying = true
        sessionId = String(params['sessionId'])
        return
      case 'session/resume':
        sessionId = String(params['sessionId'])
        return
      case 'session/prompt':
        busy = true
        emit({ type: 'user-message', text: promptText(params) })
        return
      case 'session/cancel':
        emit({ type: 'cancel-requested' })
        return
    }
    if (isResponse(m)) {
      const method = pending.get(key('agent', m.id))
      pending.delete(key('agent', m.id))
      const result = (m['result'] ?? {}) as Record<string, unknown>
      const requestId = String(m.id)
      if (method === 'session/request_permission') {
        const outcome = result['outcome'] as { outcome?: string; optionId?: string } | undefined
        const optionId = outcome?.outcome === 'selected' ? (outcome.optionId ?? null) : null
        emit({ type: 'permission-resolved', requestId, optionId })
      }
      if (method === 'elicitation/create') {
        const action = (result['action'] ?? 'cancel') as 'accept' | 'decline' | 'cancel'
        const content = result['content'] as Record<string, unknown> | undefined
        emit({ type: 'elicitation-resolved', requestId, action, ...(content ? { content } : {}) })
      }
    }
  }

  const fromAgent = (m: Message) => {
    const params = (m['params'] ?? {}) as Record<string, unknown>
    if (isNotification(m) && m.method === 'session/update') {
      onUpdate(params as unknown as SessionNotification)
      return
    }
    // L'agent retire sa demande d'autorisation (fiche 214) : fermée tout de suite, comme l'hôte ;
    // la réponse du client qui suivrait n'ajoute rien (la demande n'est plus en attente).
    if (isNotification(m) && m.method === '$/cancel_request') {
      const cancelled = key('agent', params['requestId'] as number | string)
      if (pending.get(cancelled) === 'session/request_permission') {
        pending.delete(cancelled)
        emit({
          type: 'permission-resolved',
          requestId: String(params['requestId']),
          optionId: null,
          cancelledBy: 'agent'
        })
      }
      return
    }
    if (isRequest(m)) {
      pending.set(key('agent', m.id), m.method ?? '')
      if (m.method === 'session/request_permission') {
        const toolCall = adapters.permission(params['toolCall'] as never)
        // Comme `AgentHost` : les risques de la demande (fiche 211), sur le disque fictif du rejeu.
        const risks = permissionRisks(toolCall, { workspace, home: REPLAY_HOME, realpath: noDisk })
        emit({
          type: 'permission-request',
          requestId: String(m.id),
          toolCall: toolCall as never,
          options: params['options'] as never,
          ...(risks.length > 0 ? { risks } : {})
        })
      }
      if (m.method === 'elicitation/create')
        emit({
          type: 'elicitation-request',
          requestId: String(m.id),
          prompt: elicitationPrompt(params)
        })
      return
    }
    if (!isResponse(m)) return
    const method = pending.get(key('client', m.id))
    pending.delete(key('client', m.id))
    const result = m['result'] as Record<string, unknown> | undefined
    const error = m['error'] as { message?: string } | undefined
    if (method === 'session/new' && result) sessionId = String(result['sessionId'])
    // Rejeu tardif (Bob 2.0.6) : ce qui suit la réponse vient encore du rejeu, hors de nos tours.
    if (method === 'session/load') replaying = false
    if (method === 'session/prompt') {
      busy = false
      if (error) emit({ type: 'turn-error', message: error.message ?? 'erreur' })
      else
        emit({
          type: 'turn-end',
          stopReason: (result?.['stopReason'] ?? 'end_turn') as never,
          ...(result?.['usage'] ? { usage: result['usage'] as never } : {})
        })
    }
  }

  for (const line of trace.lines) {
    const message = withPaths(line.msg, workspace) as Message
    if (line.from === 'client') fromClient(message)
    else fromAgent(message)
  }
  return { events, transcript }
}
