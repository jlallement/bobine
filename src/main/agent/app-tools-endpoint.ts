/**
 * Point d'accès MCP des outils de l'app pour la session de l'agent (fiches 029, 241) : l'ouvre avec
 * les outils de la session, le révoque, et, à la fin de chaque tour, lui ajoute les familles devenues
 * utiles dans le dossier (projet Xcode ou Android créé pendant la conversation).
 *
 * L'agent qui suit `notifications/tools/list_changed` relit la liste : la famille est dite ajoutée
 * (`live`). Sinon (agent qui n'ouvre pas le flux, ou n'en tient pas compte — Bob : inconnu), le fil
 * dit qu'il faut redémarrer l'agent (`pending`), à chaque fin de tour tant qu'il en manque ; la
 * session suivante les a (`session`).
 */
import type { AgentEvent } from '@shared/agent'
import { messageOf } from '@shared/errors'
import { log, type LogScope } from '../log'
import type { AppTool } from '../mcp/tools'
import type { ToolEndpoint } from '../mcp/tool-server'
import type { AppToolsBridge } from './app-tools-bridge'

/** Attente de la relecture après la notification : OpenCode 2.3.0 relit dans la seconde. */
export const RELIST_WAIT_MS = 10_000

export interface AppToolsEndpointOptions {
  bridge: AppToolsBridge
  server?:
    | {
        register: (
          tools: readonly AppTool[],
          scope?: LogScope,
          onListed?: (names: string[]) => void
        ) => ToolEndpoint | undefined
      }
    | undefined
  scope: () => LogScope
  emit: (event: AgentEvent) => void
  relistWaitMs?: number
}

export class AppToolsEndpoint {
  private endpoint: ToolEndpoint | undefined
  /** L'agent a laissé passer une notification de cette session : on ne l'attend plus. */
  private ignored = false
  /** Familles annoncées « à redémarrer » dans cette session, que l'agent n'a pas encore. */
  private readonly warned = new Set<string>()

  private readonly options: AppToolsEndpointOptions

  constructor(options: AppToolsEndpointOptions) {
    this.options = options
  }

  /** Nouvelle session : ses outils, servis si l'agent accepte un serveur MCP par HTTP. */
  open(http: boolean): void {
    this.close()
    const tools = this.options.bridge.sessionTools()
    this.endpoint = http
      ? this.options.server?.register(tools, this.options.scope(), (names) => this.listed(names))
      : undefined
  }

  close(): void {
    this.endpoint?.dispose()
    this.endpoint = undefined
    this.ignored = false
    this.warned.clear()
  }

  /** Adresse à donner à l'agent dans `mcpServers` ; `undefined` : pas d'outils de l'app. */
  get url(): string | undefined {
    return this.endpoint?.url
  }

  /** Noms des outils que l'agent a (menu ⚙, fiche 099). */
  names(): string[] {
    return this.options.bridge.names(this.endpoint !== undefined)
  }

  /** Session ouverte : ses familles du dossier, pour que le fil retire un avis « à redémarrer ». */
  sessionOpened(): void {
    if (!this.endpoint) return
    for (const family of this.options.bridge.givenFamilies()) {
      this.options.emit({ type: 'app-tools', family, state: 'session' })
    }
  }

  /** Fin de tour : familles devenues utiles dans le dossier, ajoutées ou annoncées. */
  async turnEnded(): Promise<void> {
    // Lancé sans attendre par l'hôte : une erreur (dossier illisible…) est notée, jamais relancée.
    await this.offerWorkspaceTools().catch((error: unknown) =>
      log.warn(`Outils du dossier : ${messageOf(error)}`)
    )
  }

  private async offerWorkspaceTools(): Promise<void> {
    const endpoint = this.endpoint
    if (!endpoint) return
    const { bridge } = this.options
    const missing = bridge.missingFamilies()
    if (missing.length === 0) return
    const tools = bridge.serveFamilies(missing)
    if (tools && endpoint.update && !this.ignored) {
      const outcome = await endpoint.update(tools, this.options.relistWaitMs ?? RELIST_WAIT_MS)
      if (outcome === 'ignored') this.ignored = true
      // Session refermée pendant l'attente : la suivante a ses propres outils.
      if (this.endpoint !== endpoint) return
    }
    const still = bridge.missingFamilies()
    for (const family of missing) {
      if (still.includes(family)) {
        this.warned.add(family)
        this.options.emit({ type: 'app-tools', family, state: 'pending' })
      } else if (!this.warned.has(family)) {
        this.options.emit({ type: 'app-tools', family, state: 'live' })
      }
    }
  }

  /** L'agent a relu la liste : les familles annoncées « à redémarrer » qu'il a désormais. */
  private listed(names: string[]): void {
    this.options.bridge.listed(names)
    const given = this.options.bridge.givenFamilies()
    for (const family of [...this.warned]) {
      if (!given.includes(family)) continue
      this.warned.delete(family)
      this.options.emit({ type: 'app-tools', family, state: 'live' })
    }
  }
}
