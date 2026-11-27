/**
 * Serveurs MCP des agents dans les réglages (fiche 025), avec la connexion OAuth par l'agent
 * (fiche 293, ADR-0077) branchée sur l'app : environnement de lancement de l'agent (clés, réseau
 * d'entreprise), commande trouvée comme pour son lancement, page ouverte par `shell.openExternal`
 * (notée dans un fichier en essai, `BOBINE_OPEN_LOG`), états envoyés aux fenêtres. Sorti
 * d'`index.ts` (taille bornée, fiche 089).
 */
import { app } from 'electron'
import { withEnvChanges } from './api-keys'
import type { SettingsStore } from '../settings-store'
import { broadcast } from '../app-windows'
import { fileOpeners } from '../file-openers'
import { envValue, launchSystem } from '../process-launch'
import { startProcess } from '../process-tree'
import { findExecutable, type AgentProfile } from '../agent/profiles'
import type { McpLocations } from './mcp-files'
import { McpSettings, type McpOAuthAppDeps } from './mcp-settings'
import { forcedMcpAuth } from './mcp-oauth-forced'

export function setupMcpSettings(
  profiles: readonly AgentProfile[],
  locations: McpLocations,
  fallbackCwd: string,
  /** Réglages de l'app (créés après : lus à chaque lancement de commande). */
  settings: () => Pick<SettingsStore, 'credentials'>
): McpSettings {
  const forced = forcedMcpAuth({ isPackaged: app.isPackaged, env: process.env })
  const findCommand: McpOAuthAppDeps['findCommand'] = (command, env) =>
    findExecutable(command, envValue(env, 'PATH', launchSystem()))
  return new McpSettings(profiles, locations, {
    fallbackCwd,
    // Comme `spawnAgent` : l'environnement de l'app, celui du profil, puis clés et réseau.
    env: async (profile) =>
      withEnvChanges({ ...process.env, ...profile.env }, await settings().credentials(profile)),
    findCommand,
    openExternal: fileOpeners().openExternal,
    onState: (state) => broadcast('mcp:authState', state),
    // Essais de bout en bout seulement (jamais dans l'app installée) : fausse commande.
    ...(forced ? forced.deps(process.execPath, startProcess) : {})
  })
}
