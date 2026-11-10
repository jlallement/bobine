/**
 * Ce que l'hôte d'agent dit et retient à `initialize` (sorti d'`AgentHost`, plafond de lignes, fiche
 * 089) : capacités de l'app ; gestion des sessions, contenu accepté dans un message, méthodes de
 * connexion. Et la traduction d'un formulaire demandé par l'agent (`elicitation/create`).
 */
import type { ElicitationPrompt } from '@shared/agent'
import type { PromptCapabilities } from '@shared/attachments'
import { TERMINAL_OUTPUT_CAPABILITY } from '@shared/terminal-output'
import {
  PROTOCOL_VERSION,
  type CreateElicitationRequest,
  type ElicitationSchema,
  type InitializeRequest,
  type InitializeResponse
} from '../../shared/acp-sdk.mts'

/** `initialize` : ce que l'app sait faire. */
export function initializeParams(clientVersion: string | undefined): InitializeRequest {
  return {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {
      elicitation: { form: {}, url: {} },
      // Résumés de contexte affichés dans le fil (fiche 019).
      session: { compaction: {} },
      // Sortie des commandes affichée par l'app (extension de Codex et Claude Code, fiche 018).
      _meta: TERMINAL_OUTPUT_CAPABILITY
    },
    clientInfo: { name: 'bobine', version: clientVersion ?? '0.0.0' }
  }
}

/** Formulaire ou page demandés par l'agent, pour l'interface ; `undefined` : forme inconnue. */
export function elicitationPrompt(params: CreateElicitationRequest): ElicitationPrompt | undefined {
  if (params.mode === 'form' && 'requestedSchema' in params) {
    return {
      mode: 'form',
      message: params.message,
      schema: params.requestedSchema as ElicitationSchema,
      ...('toolCallId' in params && typeof params.toolCallId === 'string'
        ? { toolCallId: params.toolCallId }
        : {})
    }
  }
  if (params.mode === 'url' && 'url' in params && typeof params.url === 'string') {
    return { mode: 'url', message: params.message, url: params.url }
  }
  return undefined
}

/** Capacités de gestion de session annoncées par l'agent à `initialize`. */
export interface SessionSupport {
  load: boolean
  resume: boolean
  close: boolean
  delete: boolean
  /** `session/fork` (instable dans ACP) : copie complète de la session. */
  fork: boolean
  /** Autres dossiers que le dossier de travail (`additionalDirectories`, fiche 179). */
  additionalDirectories: boolean
}

/** Rien d'annoncé (avant `initialize`). */
export const NO_SESSION_SUPPORT: SessionSupport = {
  load: false,
  resume: false,
  close: false,
  delete: false,
  fork: false,
  additionalDirectories: false
}

export function sessionSupportOf(init: InitializeResponse): SessionSupport {
  const caps = init.agentCapabilities
  const session = caps?.sessionCapabilities
  return {
    load: caps?.loadSession === true,
    resume: !!session?.resume,
    close: !!session?.close,
    delete: !!session?.delete,
    fork: !!session?.fork,
    additionalDirectories: !!session?.additionalDirectories
  }
}

export function promptCapabilitiesOf(init: InitializeResponse): PromptCapabilities {
  const prompt = init.agentCapabilities?.promptCapabilities
  return { image: prompt?.image === true, embeddedContext: prompt?.embeddedContext === true }
}

/**
 * Méthodes que l'app sait déclencher : celles de type « agent » (l'agent ouvre lui-même le
 * navigateur, comme le SSO de Bob). Les méthodes « terminal » demanderaient une capacité client
 * que l'app n'annonce pas.
 */
export function authMethodsOf(
  init: InitializeResponse
): { id: string; name: string; description?: string }[] {
  return (init.authMethods ?? [])
    .filter((m) => !('type' in m) || m.type !== 'terminal')
    .map((m) => ({ id: m.id, name: m.name, description: m.description ?? undefined }))
}
