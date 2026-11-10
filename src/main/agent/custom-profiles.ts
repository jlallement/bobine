/**
 * Profils des agents ACP déclarés par l'utilisateur (fiche 141) : bâtis à partir du réglage
 * `customAgents`, avec les seuls champs de données du cahier des charges de la fiche 140. Ni format
 * ni source : tout ce que l'app sait de l'agent vient d'ACP (capacités lues à `initialize`).
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CUSTOM_AGENT_PREFIX, type CustomAgent } from '@shared/custom-agents'
import { t } from 'i18next'
import type { AgentProfile } from './profiles'

/** Le profil d'un agent déclaré ; `~/` en tête de la commande désigne le dossier personnel. */
export function customProfile(agent: CustomAgent, home: string = homedir()): AgentProfile {
  const { apiKeyEnv } = agent
  return {
    id: agent.id,
    label: agent.label,
    command: agent.command.startsWith('~/') ? join(home, agent.command.slice(2)) : agent.command,
    args: [...agent.args],
    env: { ...agent.env },
    ...(agent.compactCommand ? { compactCommand: agent.compactCommand } : {}),
    ...(apiKeyEnv
      ? {
          apiKeys: [
            {
              env: apiKeyEnv,
              get label() {
                return t('customAgents.apiKey', { name: apiKeyEnv })
              }
            }
          ]
        }
      : {}),
    custom: agent
  }
}

export const isCustomProfile = (profile: Pick<AgentProfile, 'id'>) =>
  profile.id.startsWith(CUSTOM_AGENT_PREFIX)

/**
 * Remplace, dans la liste des profils de l'app (partagée par ceux qui la lisent), les agents
 * déclarés par ceux du réglage : après les vrais agents, avant les agents factices (rangés en
 * dernier, `resolveProfiles`).
 */
export function applyCustomProfiles(
  profiles: AgentProfile[],
  agents: readonly CustomAgent[]
): void {
  const builtIn = profiles.filter((p) => !isCustomProfile(p))
  const mockAt = builtIn.findIndex((p) => p.id.startsWith('mock'))
  const at = mockAt === -1 ? builtIn.length : mockAt
  const custom = agents.map((agent) => customProfile(agent))
  profiles.splice(0, profiles.length, ...builtIn.slice(0, at), ...custom, ...builtIn.slice(at))
}
