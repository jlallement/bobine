/**
 * Mise en place du quota des agents dans le main process (fiche 091, ADR-0017, ADR-0054) : vrai
 * pseudo-terminal, agents installés, suppression par `session/delete`. Aucune lecture au
 * lancement : le quota d'un agent est lu quand il sert (`agentReady`, fiche 242) ou sur demande.
 * Essais : jamais le vrai Bob — `BOBINE_QUOTA=off` coupe tout, et sous un dossier personnel d'essai
 * (`BOBINE_CONFIG_HOME`) seul l'agent factice est lu, dans un dossier sous lui. Profil jetable dont
 * les agents voient le vrai dossier personnel (`disposable`, fiche 242) : aucune lecture, pas même
 * demandée — celle de Bob crée une tâche dans son vrai `~/.bob`. Le dernier quota lu est gardé
 * (`memoryFile`) et montré dès le lancement suivant (fiche 282).
 */
import { homedir } from 'node:os'
import { app } from 'electron'
import type { AgentQuota } from '@shared/usage'
import type { EnvChanges } from '../agent-config/api-keys'
import { spawnNodePty } from '../terminal/node-pty'
import { findExecutable, type AgentProfile } from './profiles'
import { QuotaReader, quotaMemoryFile, quotaStatusDir } from './quota'
import { deleteAgentSessions } from './session-list'

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
  options: {
    disposable?: boolean
    env?: NodeJS.ProcessEnv
    /** Fichier des derniers quotas lus, montrés dès le lancement (fiche 282). */
    memoryFile?: string
    readOnly?: () => boolean
  } = {}
): QuotaSetup {
  const env = options.env ?? process.env
  const off = env['BOBINE_QUOTA'] === 'off' || !!options.disposable
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
    ...(options.memoryFile
      ? { memory: quotaMemoryFile(options.memoryFile, options.readOnly) }
      : {}),
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
  return {
    list: () => reader.list(),
    refresh: (profileId) => reader.refresh(profileId),
    agentReady: (profileId) => void reader.agentReady(profileId),
    stop: () => reader.stop()
  }
}
