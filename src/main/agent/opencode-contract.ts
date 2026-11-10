/**
 * Ce que l'app lit d'OpenCode en propre (fiches 055, 078) : un seul endroit, partagé par le profil
 * d'OpenCode, l'hôte d'agent et la sonde `pnpm opencode-probe`, qui vérifie à chaque version
 * d'OpenCode qu'ils tiennent. Les champs `_meta` d'OpenCode ne sont lus qu'ici (ADR-0011).
 *
 * Sans alias (`@shared`) ni import de valeur : la sonde le charge sous Node, sans bundler.
 */
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { ChildSession, SubagentStream, ToolStatusSource } from './adapters'

/** Méthode de connexion d'OpenCode (1.19 et 2) : `opencode auth login` dans un terminal. */
export const LOGIN_METHOD = 'opencode-login'

/**
 * Message d'un message refusé faute de connexion (2.2.5 : `-32000` « Authentication required:
 * provider authentication required », relevé dans le binaire ; recette 0.9 D10).
 */
export const AUTH_REQUIRED_MESSAGE = /authentication required/i

/** Titre des sessions jamais écrites (1.19 et 2.0.31) : « New session - <date ISO> ». */
export const EMPTY_SESSION_TITLE = /^New session - \d{4}-\d{2}-\d{2}T/

/**
 * Marque d'une mise à jour venue d'un sous-agent (OpenCode 2, `packages/cli/src/acp/child.ts`) :
 * sans la capacité client `opencode/child-session-updates`, OpenCode relaie tout le travail de ses
 * sous-agents dans le flux du parent (même `sessionId`), avec cette marque dans `_meta`.
 */
export const CHILD_SESSION_META = 'opencode/child-session'

/** Identifiant de session sûr : il peut être renvoyé tel quel à l'agent (`session/load`). */
const SESSION_ID = /^[\w-]{1,200}$/

/** Sous-agent dont vient cette mise à jour, ou `undefined` si elle vient de la conversation. */
export function childSessionOf(update: SessionUpdate): ChildSession | undefined {
  const meta: unknown = update._meta?.[CHILD_SESSION_META]
  if (typeof meta !== 'object' || meta === null) return undefined
  const m = meta as Record<string, unknown>
  const id = m['id']
  const parentId = m['parentID']
  if (typeof id !== 'string' || !SESSION_ID.test(id)) return undefined
  if (typeof parentId !== 'string' || !SESSION_ID.test(parentId)) return undefined
  const depth = typeof m['depth'] === 'number' && m['depth'] > 0 ? m['depth'] : 1
  const title = typeof m['title'] === 'string' && m['title'].trim() ? m['title'] : undefined
  return { id, parentId, depth, ...(title ? { title } : {}) }
}

/**
 * Mise à jour d'un sous-agent telle qu'on l'affiche sous sa carte : sans la marque, et sans le
 * préfixe « <titre> : » qu'OpenCode ajoute au titre de ses outils (la carte le dit déjà).
 * L'identifiant de l'outil garde son préfixe `ses_…:` (unique dans la conversation).
 */
export function childUpdateForCard(update: SessionUpdate, child: ChildSession): SessionUpdate {
  const { [CHILD_SESSION_META]: _marker, ...rest } = update._meta ?? {}
  const meta = Object.keys(rest).length > 0 ? { _meta: rest } : {}
  const { _meta: _old, ...base } = update
  if (base.sessionUpdate !== 'tool_call' && base.sessionUpdate !== 'tool_call_update') {
    return { ...base, ...meta } as SessionUpdate
  }
  const prefix = child.title ? `${child.title}: ` : undefined
  const title =
    prefix && typeof base.title === 'string' && base.title.startsWith(prefix)
      ? base.title.slice(prefix.length)
      : base.title
  return { ...base, ...(title !== undefined ? { title } : {}), ...meta } as SessionUpdate
}

/** Objet, ou `undefined`. */
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

/**
 * Sous-agent lancé en arrière-plan (OpenCode 2.0.32, recette du 2026-10-22) : l'outil rend la main
 * tout de suite, `rawOutput.metadata: { sessionID, status: "running" }` et « The subagent is working
 * in the background… ». OpenCode ne met jamais cette carte à jour ensuite, même au rejeu.
 */
export function runsInBackground(update: SessionUpdate): boolean {
  if (update.sessionUpdate !== 'tool_call_update') return false
  return record(record(update.rawOutput)?.['metadata'])?.['status'] === 'running'
}

/** Flux des sous-agents d'OpenCode 2, tel que le profil le déclare (`subagentStream`, ADR-0015). */
export const OPENCODE_SUBAGENT_STREAM: SubagentStream = {
  childOf: childSessionOf,
  forCard: childUpdateForCard,
  background: runsInBackground
}

/**
 * Un appel fait par `execute` (« Code Mode », fiche 079) est-il en erreur ? OpenCode 2.0.32 dit la
 * carte « completed » et met l'erreur dans `rawOutput.metadata` : `toolCalls[].status: "error"`
 * (relevé), `error: true` sur l'ensemble ; `isError` sur un appel est accepté aussi.
 */
export function executeFailed(update: SessionUpdate): boolean {
  if (update.sessionUpdate !== 'tool_call_update' || update.status !== 'completed') return false
  const metadata = record(record(update.rawOutput)?.['metadata'])
  if (!metadata) return false
  if (metadata['error'] === true) return true
  const calls = Array.isArray(metadata['toolCalls']) ? metadata['toolCalls'] : []
  return calls.some((call) => {
    const c = record(call)
    return c?.['status'] === 'error' || c?.['isError'] === true
  })
}

/** Échecs des appels d'`execute`, tels que le profil d'OpenCode les déclare (ADR-0015). */
export const OPENCODE_TOOL_STATUS: ToolStatusSource = {
  id: 'opencode-tool-calls',
  correct: (update) =>
    executeFailed(update) ? ({ ...update, status: 'failed' } as SessionUpdate) : update
}
