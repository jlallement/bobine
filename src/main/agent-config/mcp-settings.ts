/**
 * Serveurs MCP des agents dans les réglages (fiche 025) : un `AgentMcpConfig` par profil qui en
 * déclare le format. Le dossier « projet » est celui de la conversation affichée.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { parseMcpServer, type McpAgentView, type McpScope, type McpTestResult } from '@shared/mcp'
import { log } from '../log'
import { probeMcpServer } from './mcp-probe'
import type { AgentProfile } from '../agent/profiles'
import { AgentMcpConfig, type McpLocations } from './mcp-files'

export class McpSettings {
  private readonly configs: { profile: AgentProfile; config: AgentMcpConfig }[]

  constructor(profiles: readonly AgentProfile[], locations: McpLocations) {
    this.configs = profiles.flatMap((profile) =>
      profile.mcpConfig
        ? [{ profile, config: new AgentMcpConfig(profile.mcpConfig, locations) }]
        : []
    )
  }

  list(workspace: string): McpAgentView[] {
    return this.configs.map(({ profile, config }) =>
      config.view(profile.id, profile.label, workspace)
    )
  }

  save(
    profileId: string,
    scope: McpScope,
    workspace: string,
    raw: unknown,
    previousName?: string
  ): McpAgentView[] {
    const server = parseMcpServer(raw)
    if (typeof server === 'string') throw new Error(server)
    this.config(profileId).save(scope, workspace, server, previousName)
    log.info(`MCP : serveur « ${server.name} » enregistré pour ${profileId} (${scope})`)
    return this.list(workspace)
  }

  remove(profileId: string, scope: McpScope, workspace: string, name: string): McpAgentView[] {
    this.config(profileId).remove(scope, workspace, name)
    log.info(`MCP : serveur « ${name} » retiré pour ${profileId} (${scope})`)
    return this.list(workspace)
  }

  setEnabled(
    profileId: string,
    scope: McpScope,
    workspace: string,
    name: string,
    enabled: boolean
  ): McpAgentView[] {
    this.config(profileId).setEnabled(scope, workspace, name, enabled)
    return this.list(workspace)
  }

  /**
   * « Tester » (fiche 060) : l'app se connecte au serveur tel qu'il est déclaré (même désactivé),
   * liste ce qu'il propose, puis le ferme.
   */
  async test(
    profileId: string,
    scope: McpScope,
    workspace: string,
    name: string
  ): Promise<McpTestResult> {
    const server = this.list(workspace)
      .find((v) => v.profileId === profileId)
      ?.servers.find((s) => s.scope === scope && s.name === name)
    if (!server) throw new Error(`Serveur introuvable : ${name}`)
    const result = await probeMcpServer(server, {
      cwd: existsSync(workspace) ? workspace : homedir()
    })
    log.info(
      `MCP : test de « ${name} » (${profileId}, ${scope}) : ${
        result.ok ? `${result.tools.length} outil(s)` : result.error.split('\n')[0]
      } en ${result.ms} ms`
    )
    return result
  }

  private config(profileId: string): AgentMcpConfig {
    const found = this.configs.find((c) => c.profile.id === profileId)
    if (!found) throw new Error(`Pas de serveurs MCP modifiables pour l’agent « ${profileId} »`)
    return found.config
  }
}
