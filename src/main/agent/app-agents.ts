/**
 * Profils des agents de l'app et dossier personnel de leurs fichiers (sorti de `index.ts`, taille
 * bornée, fiche 089). `BOBINE_CONFIG_HOME` : autre dossier personnel, pour que les essais ne
 * touchent jamais les vrais fichiers de Bob et d'OpenCode (serveurs MCP, règles d'approbation,
 * rôles installés).
 */
import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveProfiles, type AgentProfile } from './profiles'

export interface AppAgents {
  profiles: AgentProfile[]
  /** `BOBINE_CONFIG_HOME`, s'il est posé. */
  configHome: string | undefined
  /** Dossier personnel des fichiers des agents (et `XDG_CONFIG_HOME` hors essais). */
  agentFiles: { home: string; xdgConfigHome?: string }
}

export function appAgents(env: NodeJS.ProcessEnv = process.env): AppAgents {
  const profiles = resolveProfiles({
    appPath: app.getAppPath(),
    execPath: process.execPath,
    isPackaged: app.isPackaged,
    env,
    mockStore: join(app.getPath('userData'), 'mock-agent-sessions')
  })
  const configHome = env['BOBINE_CONFIG_HOME']
  const xdg = env['XDG_CONFIG_HOME']
  return {
    profiles,
    configHome,
    agentFiles: {
      home: configHome ?? homedir(),
      ...(configHome || !xdg ? {} : { xdgConfigHome: xdg })
    }
  }
}
