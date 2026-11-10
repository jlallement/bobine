/**
 * Agent lancé hors d'une conversation, pour le gestionnaire (sorti de lui, plafond de lignes, fiche
 * 089) : essai du diagnostic (fiche 061), et « Reprendre une session… » (fiche 055) — sessions que
 * l'agent garde et que l'historique ne connaît pas, ni conversations ni apartés (fiche 180).
 */
import type { AgentSessionView } from '@shared/agent'
import { checkAgent, unknownSessions } from '../agent/agent-check'
import type { AgentProfile } from '../agent/profiles'
import type { AgentCheck } from '../diagnostics'
import type { SettingsStore } from '../settings-store'
import type { ConversationRecord } from './store'

/** Sessions d'aparté gardées par conversation (les plus récentes). */
export const MAX_ASIDE_SESSIONS = 50

/** Sessions de cet agent que l'historique connaît : celles des conversations et des apartés. */
export function knownSessionIds(
  records: readonly ConversationRecord[],
  profileId: string
): Set<string> {
  return new Set(
    records.flatMap((r) => [
      ...(r.profileId === profileId && r.sessionId ? [r.sessionId] : []),
      ...(r.asideSessions ?? []).filter((s) => s.profileId === profileId).map((s) => s.sessionId)
    ])
  )
}

/** Retient une session d'aparté que l'agent garde (il ne sait pas la supprimer). */
export function addAsideSession(
  record: ConversationRecord,
  profileId: string,
  sessionId: string
): void {
  record.asideSessions = [...(record.asideSessions ?? []), { profileId, sessionId }].slice(
    -MAX_ASIDE_SESSIONS
  )
}

export interface AgentSessionsInput {
  profile: AgentProfile
  only: string | undefined
  records: readonly ConversationRecord[]
  settings: Pick<SettingsStore, 'current' | 'credentials'>
  neutralFolder: string
  clientVersion: string | undefined
  /** Sessions à ne jamais proposer (essais du premier lancement, fiche 188). */
  hidden?: readonly string[]
}

/** Sessions de l'agent du dossier `only`, ou toutes (`agent-check.ts`). */
export async function agentSessions(input: AgentSessionsInput): Promise<AgentSessionView[]> {
  const { profile, records, settings } = input
  return unknownSessions({
    profile,
    only: input.only,
    known: new Set([...knownSessionIds(records, profile.id), ...(input.hidden ?? [])]),
    knownFolders: [...settings.current.recentWorkspaces, ...records.map((r) => r.workspace)],
    defaultWorkspace: input.neutralFolder,
    credentials: await settings.credentials(profile),
    clientVersion: input.clientVersion
  })
}

/** Essai de l'agent pour le diagnostic, dans `workspace` (`agent-check.ts`). */
export function checkAgentIn(
  profile: AgentProfile,
  workspace: string,
  app: {
    settings: Pick<SettingsStore, 'credentials' | 'keyInfo' | 'agentSeen'>
    pathEnv: string | undefined
    clientVersion: string | undefined
  },
  options: { trySession?: boolean }
): Promise<AgentCheck> {
  const { settings } = app
  return checkAgent({
    profile,
    workspace,
    pathEnv: app.pathEnv,
    clientVersion: app.clientVersion,
    credentials: () => settings.credentials(profile),
    apiKeyInfo: () => settings.keyInfo(profile)[0],
    onAnnounced: (seen) => settings.agentSeen(profile.id, seen),
    ...(options.trySession ? { trySession: true } : {})
  })
}
