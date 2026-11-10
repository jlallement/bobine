/**
 * Sessions qu'un agent garde (fiche 055), lues par `session/list` — ou supprimées par
 * `session/delete` (fiche 091) — sans ouvrir de session : un agent lancé pour l'occasion est
 * initialisé, interrogé, puis arrêté. Rien n'est créé chez l'agent, rien n'est envoyé au modèle.
 */
import { methods } from '../../shared/acp-sdk.mts'
import type { AgentSessionView } from '@shared/agent'
import type { EnvChanges } from '../agent-config/api-keys'
import { errorMessage, race } from './process-utils'
import { withAgent } from './short-lived-agent'
import type { AgentProfile } from './profiles'
import { t } from 'i18next'

/** Au-delà, les sessions les plus anciennes ne sont pas proposées. */
export const MAX_LISTED_SESSIONS = 500

export interface ListOptions {
  profile: AgentProfile
  /** Dossier où lancer l'agent. */
  cwd: string
  /**
   * Demandes à faire, fusionnées : un dossier, ou `undefined` pour la liste sans dossier. OpenCode
   * 1.19 ne donne sans dossier que les sessions hors dépôt git : celles d'un dépôt ne viennent
   * qu'en nommant son dossier.
   */
  folders: readonly (string | undefined)[]
  credentials?: EnvChanges
  clientVersion?: string
  timeoutMs?: number
}

export async function listAgentSessions(options: ListOptions): Promise<AgentSessionView[]> {
  const { profile, timeoutMs = 30_000 } = options
  return withAgent(options, async ({ connection, failed, init }) => {
    if (!init.agentCapabilities?.sessionCapabilities?.list) {
      throw new Error(t('sessionList.cannotList', { agent: profile.label }))
    }
    const sessions = new Map<string, AgentSessionView>()
    for (const folder of options.folders) {
      const seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await race(
          failed,
          timeoutMs,
          t('sessionList.noSessions'),
          connection.agent.request(methods.agent.session.list, {
            ...(folder ? { cwd: folder } : {}),
            ...(cursor ? { cursor } : {})
          })
        )
        for (const s of page.sessions) {
          if (typeof s.sessionId !== 'string' || typeof s.cwd !== 'string') continue
          sessions.set(s.sessionId, {
            sessionId: s.sessionId,
            cwd: s.cwd,
            ...(s.title ? { title: s.title } : {}),
            ...(s.updatedAt ? { updatedAt: s.updatedAt } : {})
          })
        }
        const next = page.nextCursor ?? undefined
        // Curseur déjà vu : l'agent tourne en rond, on s'arrête là.
        cursor = next && !seen.has(next) ? next : undefined
        if (cursor) seen.add(cursor)
      } while (cursor && sessions.size < MAX_LISTED_SESSIONS)
      if (sessions.size >= MAX_LISTED_SESSIONS) break
    }
    return [...sessions.values()].slice(0, MAX_LISTED_SESSIONS)
  })
}

export interface DeleteOptions {
  profile: AgentProfile
  /** Dossier où lancer l'agent. */
  cwd: string
  sessionIds: readonly string[]
  credentials?: EnvChanges
  clientVersion?: string
  timeoutMs?: number
}

/**
 * Supprime ces sessions de l'historique de l'agent (`session/delete`), sans en ouvrir : les tâches
 * vides laissées par la lecture d'un quota (fiche 091). Rend le nombre de sessions supprimées.
 */
export async function deleteAgentSessions(options: DeleteOptions): Promise<number> {
  const { profile, timeoutMs = 30_000 } = options
  if (options.sessionIds.length === 0) return 0
  return withAgent(options, async ({ connection, failed, init }) => {
    if (!init.agentCapabilities?.sessionCapabilities?.delete) {
      throw new Error(t('sessionList.cannotDelete', { agent: profile.label }))
    }
    let deleted = 0
    for (const sessionId of options.sessionIds) {
      await race(
        failed,
        timeoutMs,
        t('sessionList.deleteTimeout'),
        connection.agent.request(methods.agent.session.delete, { sessionId })
      )
      deleted++
    }
    return deleted
  })
}

/** Issue de la suppression d'une session : faite, introuvable chez l'agent, ou ratée. */
export type DeleteOutcome = 'deleted' | 'missing' | 'failed'

/** Code JSON-RPC « ressource introuvable » (ACP : session inconnue). */
const NOT_FOUND = -32002

/**
 * La session est introuvable chez l'agent : code ACP `-32002`, ou un message qui parle d'une
 * session introuvable. Un « not found » qui ne parle pas de session (commande, fichier, modèle)
 * reste un échec, retenté.
 */
export function sessionNotFound(error: unknown): boolean {
  if ((error as { code?: unknown } | null)?.code === NOT_FOUND) return true
  const text = errorMessage(error)
  return /\bsession\b[^.]*\bnot found\b|\bno such session\b|\bunknown session\b/i.test(text)
}

/**
 * Supprime ces sessions une à une (sessions d'essai du premier lancement, fiche 188) : une session
 * que l'agent dit introuvable, ou un agent qui ne sait pas supprimer, n'est pas un échec à
 * retenter. Lève seulement si l'agent ne démarre pas.
 */
export async function deleteEachSession(
  options: DeleteOptions
): Promise<Record<string, DeleteOutcome>> {
  const { timeoutMs = 30_000 } = options
  const outcomes: Record<string, DeleteOutcome> = {}
  if (options.sessionIds.length === 0) return outcomes
  return withAgent(options, async ({ connection, failed, init }) => {
    const canDelete = !!init.agentCapabilities?.sessionCapabilities?.delete
    for (const sessionId of options.sessionIds) {
      if (!canDelete) {
        outcomes[sessionId] = 'missing'
        continue
      }
      try {
        await race(
          failed,
          timeoutMs,
          t('sessionList.deleteTimeout'),
          connection.agent.request(methods.agent.session.delete, { sessionId })
        )
        outcomes[sessionId] = 'deleted'
      } catch (error) {
        outcomes[sessionId] = sessionNotFound(error) ? 'missing' : 'failed'
      }
    }
    return outcomes
  })
}
