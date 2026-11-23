/**
 * Reprises d'OpenCode 2.3.0 qui ne joint pas son modèle (relevé du 2026-11-23, fiche 275 : proxy
 * injoignable) : aucune erreur au tour, seulement des `session_info_update` dont
 * `_meta["opencode/retry"]` vaut `null` (nouvelle tentative en cours), puis
 * `{ attempt, nextRetryAt, error: { type: "provider.transport", message } }` (tentative échouée,
 * la suivante à `nextRetryAt`). Lu ici seulement (ADR-0011) ; le reste de l'app voit un état
 * générique. La moindre surprise : `undefined`, rien d'affiché plutôt qu'un état faux.
 */
import type { AgentUnreachableView } from '@shared/agent'
import { maskUrlCredentials } from '@shared/url-credentials'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { RetryStatusSource } from './adapters'

const KEY = 'opencode/retry'
const MESSAGE_CHARS = 500

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

export function readOpenCodeRetry(update: SessionUpdate): AgentUnreachableView | null | undefined {
  if (update.sessionUpdate !== 'session_info_update') return undefined
  const meta = record(update._meta)
  if (!meta || !(KEY in meta)) return undefined
  const retry = meta[KEY]
  if (retry === null) return null
  const fields = record(retry)
  const attempt = fields?.['attempt']
  if (typeof attempt !== 'number' || !Number.isInteger(attempt) || attempt < 1) return undefined
  const next = fields?.['nextRetryAt']
  const at = typeof next === 'string' ? Date.parse(next) : NaN
  const message = record(fields?.['error'])?.['message']
  const text = typeof message === 'string' ? maskUrlCredentials(message.trim()) : ''
  return {
    attempt,
    ...(Number.isFinite(at) ? { at } : {}),
    ...(text ? { message: text.slice(0, MESSAGE_CHARS) } : {})
  }
}

/** Reprises d'OpenCode, telles que son profil les déclare (ADR-0015). */
export const OPENCODE_RETRY_STATUS: RetryStatusSource = {
  id: 'opencode-retry',
  read: readOpenCodeRetry
}
