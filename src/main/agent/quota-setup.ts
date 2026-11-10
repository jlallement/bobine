/**
 * Mise en place du quota des agents dans le main process (fiche 091, ADR-0017) : vrai
 * pseudo-terminal, agents installés, suppression par `session/delete`, première lecture peu après
 * le démarrage. Essais : jamais le vrai Bob — `BOBINE_QUOTA=off` coupe tout, et sous un dossier
 * personnel d'essai (`BOBINE_CONFIG_HOME`) seul l'agent factice est lu, dans un dossier sous lui.
 * Agents neufs (`--agents-neufs`, fiche 148) : dossier personnel vide, donc aucun agent connecté au
 * lancement : pas de lecture automatique (elle ne ferait qu'attendre, D11).
 */
import { homedir } from 'node:os'
import { app } from 'electron'
import type { AgentQuota } from '@shared/usage'
import type { EnvChanges } from '../agent-config/api-keys'
import { spawnNodePty } from '../terminal/node-pty'
import { findExecutable, type AgentProfile } from './profiles'
import { QuotaReader, quotaStatusDir } from './quota'
import { deleteAgentSessions } from './session-list'

/** Après l'agent de la conversation ouverte, pour ne pas retarder son démarrage. */
const STARTUP_DELAY_MS = 3000

export interface QuotaSetup {
  list: () => AgentQuota[]
  refresh: (profileId?: string) => Promise<void>
  /** L'agent s'est montré prêt : quota encore inconnu relu (fiche 205), en tâche de fond. */
  agentReady: (profileId: string) => void
  /** L'app quitte : lecture en cours arrêtée, aucune ensuite (fiche 208). */
  stop: () => void
}

export function setupQuotas(
  profiles: AgentProfile[],
  settings: { credentials: (profile: AgentProfile) => Promise<EnvChanges> },
  onChange: (quotas: AgentQuota[]) => void,
  options: { freshAgents?: boolean; env?: NodeJS.ProcessEnv } = {}
): QuotaSetup {
  const env = options.env ?? process.env
  const off = env['BOBINE_QUOTA'] === 'off'
  const testHome = env['BOBINE_CONFIG_HOME'] !== undefined
  // Dossier personnel des agents (celui qu'ils voient, essais compris) : un seul dossier de lecture
  // par machine, que Bob ne retient qu'une fois (D6).
  const home = env['BOBINE_CONFIG_HOME'] ?? env['HOME'] ?? homedir()
  const reader = new QuotaReader({
    profiles,
    statusDir: quotaStatusDir(home, env),
    spawnPty: spawnNodePty,
    env: () => env,
    isAvailable: (profile) =>
      !off && (testHome ? profile.id === 'mock' : !!findExecutable(profile.command, env['PATH'])),
    credentials: (profile) => settings.credentials(profile),
    deleteSessions: async (profile, cwd, sessionIds) =>
      deleteAgentSessions({
        profile,
        cwd,
        sessionIds,
        credentials: await settings.credentials(profile),
        clientVersion: app.getVersion()
      })
  })
  reader.subscribe(onChange)
  const startup = options.freshAgents
    ? undefined
    : setTimeout(() => void reader.refresh(undefined, { automatic: true }), STARTUP_DELAY_MS)
  return {
    list: () => reader.list(),
    refresh: (profileId) => reader.refresh(profileId),
    agentReady: (profileId) => void reader.agentReady(profileId),
    stop: () => {
      clearTimeout(startup)
      reader.stop()
    }
  }
}
