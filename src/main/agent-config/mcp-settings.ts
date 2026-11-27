/**
 * Serveurs MCP des agents dans les réglages (fiche 025) : un `AgentMcpConfig` par profil qui en
 * déclare le format. Le dossier « projet » est celui de la conversation affichée. Préréglages et
 * connexion OAuth par l'agent (fiche 293) : ajout « tous les dossiers », moteur `McpOAuth`.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  MCP_NAME,
  parseMcpServer,
  type McpAgentView,
  type McpAuthView,
  type McpConnectResult,
  type McpDisconnectResult,
  type McpScope,
  type McpTestResult
} from '@shared/mcp'
import {
  declaredPreset,
  MCP_PRESETS,
  presetById,
  presetForUrl,
  type McpPreset
} from '@shared/mcp-presets'
import { t } from 'i18next'
import { log } from '../log'
import { probeMcpServer } from './mcp-probe'
import type { AgentProfile } from '../agent/profiles'
import { AgentMcpConfig, type McpLocations } from './mcp-files'
import { McpOAuth, type McpOAuthDeps } from './mcp-oauth'

/** Ce que le moteur de connexion reçoit de l'app (le reste vient des réglages). */
export type McpOAuthAppDeps = Omit<McpOAuthDeps, 'profiles' | 'servers'>

/** Suffixes essayés quand le nom du préréglage est pris (`figma-2`…), sans rien écraser. */
const MAX_NAME_SUFFIX = 9

export class McpSettings {
  private readonly configs: { profile: AgentProfile; config: AgentMcpConfig }[]
  private readonly profiles: readonly AgentProfile[]
  private readonly presets: readonly McpPreset[]
  private readonly oauth: McpOAuth | undefined
  private readonly openExternal: ((url: string) => Promise<void> | void) | undefined

  constructor(
    profiles: readonly AgentProfile[],
    locations: McpLocations,
    oauth?: McpOAuthAppDeps,
    presets: readonly McpPreset[] = MCP_PRESETS
  ) {
    this.profiles = profiles
    this.presets = presets
    this.configs = profiles.flatMap((profile) =>
      profile.mcpConfig
        ? [{ profile, config: new AgentMcpConfig(profile.mcpConfig, locations) }]
        : []
    )
    this.openExternal = oauth?.openExternal
    this.oauth = oauth
      ? new McpOAuth({
          ...oauth,
          presets,
          profiles: () => this.profiles,
          servers: (profileId, workspace) =>
            this.list(workspace).find((v) => v.profileId === profileId)?.servers ?? []
        })
      : undefined
  }

  list(workspace: string): McpAgentView[] {
    return this.configs.map(({ profile, config }) => {
      const view = config.view(profile.id, profile.label, workspace)
      if (!profile.mcpOAuth) return view
      // Serveurs que l'agent connecte lui-même (fiche 293) : marqués par leur préréglage.
      const servers = view.servers.map((server) => {
        const preset = declaredPreset(view.servers, server.name, this.presets)
        return preset ? { ...server, authPreset: preset.id } : server
      })
      return { ...view, servers, oauth: true as const }
    })
  }

  /**
   * Lien « Liste de <préréglage> » de la ligne d'aide d'un agent sans la capacité (fiche 293) :
   * l'adresse est une donnée du préréglage, ouverte par le main ; le renderer ne donne que l'id.
   */
  async openPresetList(presetId: string): Promise<undefined> {
    const preset = presetById(presetId, this.presets)
    if (!preset) throw new Error('Paramètre invalide : presetId')
    if (!this.openExternal) throw new Error(t('mcpOAuth.error.unavailable'))
    await this.openExternal(preset.listUrl)
    return undefined
  }

  /**
   * « Connecter <préréglage> » (fiche 293) : ajoute le serveur pour tous les dossiers, dans le format
   * déjà présent du fichier de l'agent (fiche 025). Adresse déjà déclarée (sous n'importe quel nom,
   * dans l'un des deux fichiers) : rien d'écrit, son nom est rendu. Nom pris : `<nom>-2`… ; la
   * connexion de l'agent étant attachée au nom (relevé R4), ce serveur aura la sienne.
   */
  addPreset(
    profileId: string,
    presetId: string,
    workspace: string
  ): { name: string; added: boolean; views: McpAgentView[] } {
    const profile = this.profiles.find((p) => p.id === profileId)
    if (!profile?.mcpOAuth) {
      throw new Error(t('mcpOAuth.error.notOffered', { agent: profile?.label ?? profileId }))
    }
    const preset = presetById(presetId, this.presets)
    if (!preset) throw new Error('Paramètre invalide : presetId')
    const view = this.list(workspace).find((v) => v.profileId === profileId)
    // Un fichier illisible cache peut-être déjà ce serveur ou ce nom : rien n'est écrit.
    if (view?.error) throw new Error(view.error)
    const servers = view?.servers ?? []
    const existing = servers.find((s) => presetForUrl(s.url, this.presets) === preset)
    if (existing) return { name: existing.name, added: false, views: this.list(workspace) }
    const taken = new Set(servers.map((s) => s.name))
    const name = [preset.name, ...suffixes(preset.name)].find(
      (n) => !taken.has(n) && MCP_NAME.test(n)
    )
    if (!name)
      throw new Error(
        t('mcpOAuth.error.namesTaken', {
          first: preset.name,
          last: `${preset.name}-${MAX_NAME_SUFFIX}`
        })
      )
    this.config(profileId).save('global', workspace, {
      name,
      transport: 'http',
      url: preset.url,
      enabled: true
    })
    log.info(`MCP : préréglage « ${preset.id} » ajouté pour ${profileId} sous « ${name} » (global)`)
    return { name, added: true, views: this.list(workspace) }
  }

  authStates(profileId: string, workspace: string): Promise<McpAuthView> {
    return this.engine().view(profileId, workspace)
  }

  connect(profileId: string, name: string, workspace: string): Promise<McpConnectResult> {
    return this.engine().connect(profileId, name, workspace)
  }

  cancelConnect(profileId: string, name: string): boolean {
    return this.engine().cancel(profileId, name)
  }

  reopenPage(profileId: string, name: string): boolean {
    return this.engine().reopen(profileId, name)
  }

  disconnect(profileId: string, name: string, workspace: string): Promise<McpDisconnectResult> {
    return this.engine().disconnect(profileId, name, workspace)
  }

  /** Fermeture de l'app : connexion en cours arrêtée, arbre de processus compris. */
  stop(): void {
    this.oauth?.stop()
  }

  private engine(): McpOAuth {
    if (!this.oauth) throw new Error(t('mcpOAuth.error.unavailable'))
    return this.oauth
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
    // Serveur connecté par l'agent (fiche 293) : sans son jeton, il répond toujours 401 ; pas de
    // test de Bobine, son état vient de l'agent.
    const profile = this.profiles.find((p) => p.id === profileId)
    if (
      profile?.mcpOAuth &&
      server.transport === 'http' &&
      presetForUrl(server.url, this.presets)
    ) {
      throw new Error(t('mcpOAuth.error.noTest', { name, agent: profile.label }))
    }
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

function suffixes(name: string): string[] {
  return Array.from({ length: MAX_NAME_SUFFIX - 1 }, (_, i) => `${name}-${i + 2}`)
}
