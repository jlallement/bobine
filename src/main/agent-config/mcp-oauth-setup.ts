/**
 * Serveurs MCP des agents dans les réglages (fiche 025), avec la connexion OAuth par l'agent
 * (fiche 293, ADR-0075) branchée sur l'app : environnement de lancement de l'agent (clés, réseau
 * d'entreprise), commande trouvée comme pour son lancement, page ouverte par `shell.openExternal`,
 * états envoyés aux fenêtres. Sorti d'`index.ts` (taille bornée, fiche 089).
 */
import { shell } from 'electron'
import { withEnvChanges } from './api-keys'
import type { SettingsStore } from '../settings-store'
import { broadcast } from '../app-windows'
import { envValue, launchSystem } from '../process-launch'
import { findExecutable, type AgentProfile } from '../agent/profiles'
import type { McpLocations } from './mcp-files'
import { McpSettings } from './mcp-settings'

export function setupMcpSettings(
  profiles: readonly AgentProfile[],
  locations: McpLocations,
  fallbackCwd: string,
  /** Réglages de l'app (créés après : lus à chaque lancement de commande). */
  settings: () => Pick<SettingsStore, 'credentials'>
): McpSettings {
  return new McpSettings(profiles, locations, {
    fallbackCwd,
    // Comme `spawnAgent` : l'environnement de l'app, celui du profil, puis clés et réseau.
    env: async (profile) =>
      withEnvChanges({ ...process.env, ...profile.env }, await settings().credentials(profile)),
    findCommand: (command, env) => findExecutable(command, envValue(env, 'PATH', launchSystem())),
    openExternal: (url) => shell.openExternal(url),
    onState: (state) => broadcast('mcp:authState', state)
  })
}
