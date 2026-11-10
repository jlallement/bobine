/**
 * Serveurs MCP déclarés dans les fichiers des agents (fiche 025) : lecture et modification, dans le
 * format de chaque agent, que son profil déclare (`McpConfigSource`, fiche 140 : `bob-mcp.ts`,
 * `opencode-mcp.ts`). Les fichiers des agents restent la référence (ce qui est configuré ici marche
 * aussi dans le terminal de l'agent, et inversement) ; l'app ne garde rien de son côté.
 *
 * Les modifications passent par `jsonc-parser` : commentaires, mise en forme et réglages que l'app
 * ne gère pas sont gardés. Un fichier illisible n'est jamais réécrit.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from 'jsonc-parser'
import type { McpAgentView, McpScope, McpServer, McpServerEntry } from '@shared/mcp'
import type { McpConfigSource, McpEntry } from '../agent/adapters'
import { writeFileAtomic } from '../storage'
import { FORMATTING, pruneRemoved, writeOrRemove } from './config-prune'
import { t } from 'i18next'

export interface McpLocations {
  /** Dossier personnel (remplaçable pour les essais : jamais les vrais fichiers). */
  home: string
  /** `XDG_CONFIG_HOME`, que suit OpenCode. */
  xdgConfigHome?: string
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Serveurs d'une table (`{ nom: { … } }`), à cet endroit du fichier. */
export const tableEntries = (table: unknown, at: string[], native: boolean): McpEntry[] =>
  isObject(table)
    ? Object.entries(table).flatMap(([name, raw]) =>
        isObject(raw) ? [{ name, raw, path: [...at, name], native }] : []
      )
    : []

export const strings = (value: unknown): Record<string, string> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const entries = Object.entries(value).filter(
    (e): e is [string, string] => typeof e[1] === 'string'
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

export const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** Retire les clés d'un objet (champs propres à l'autre transport). */
export const without = (raw: Record<string, unknown> | undefined, keys: string[]) =>
  Object.fromEntries(Object.entries(raw ?? {}).filter(([k]) => !keys.includes(k)))

export function firstExisting(files: string[]): string {
  return files.find((f) => existsSync(f)) ?? files.at(-1) ?? ''
}

export { FORMATTING }

/** Contenu d'un fichier de configuration : objet, ou erreur de lecture (fichier à ne pas toucher). */
export function readConfig(
  file: string
): { text: string; data: Record<string, unknown> } | { error: string } {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return { text: '', data: {} }
    return { error: `${file} : illisible (${(error as Error).message})` }
  }
  const errors: ParseError[] = []
  const data: unknown = parse(text, errors, { allowTrailingComma: true })
  if (errors.length > 0 || (text.trim() && (typeof data !== 'object' || data === null))) {
    const first = errors[0]
    return {
      error: t('mcpFiles.invalidJson', {
        file,
        where: first ? ` (${printParseErrorCode(first.error)}, position ${first.offset})` : ''
      })
    }
  }
  return { text, data: (data ?? {}) as Record<string, unknown> }
}

export class AgentMcpConfig {
  private readonly format: McpConfigSource
  private readonly loc: McpLocations

  constructor(format: McpConfigSource, loc: McpLocations) {
    this.format = format
    this.loc = loc
  }

  file(scope: McpScope, workspace: string): string {
    if (scope === 'global') return this.format.globalFile(this.loc)
    // Sans dossier choisi (fiche 093), pas de fichier du projet : jamais celui du dossier courant.
    if (!workspace) throw new Error(t('conversations.error.noFolder'))
    return this.format.projectFile(workspace)
  }

  /** Serveurs déclarés (global, puis projet du dossier), ou l'erreur d'un fichier illisible. */
  view(profileId: string, label: string, workspace: string): McpAgentView {
    const global = this.file('global', workspace)
    const project = workspace ? this.file('project', workspace) : undefined
    const servers: McpServerEntry[] = []
    const errors: string[] = []
    for (const [scope, file] of [
      ['global', global],
      ...(project ? [['project', project] as const] : [])
    ] as const) {
      const config = readConfig(file)
      if ('error' in config) {
        errors.push(config.error)
        continue
      }
      for (const entry of this.format.entries(config.data)) {
        servers.push({ ...this.format.fromRaw(entry.name, entry.raw, entry.native), scope, file })
      }
    }
    return {
      profileId,
      label,
      files: {
        global: this.display(global),
        ...(project && project !== global ? { project: this.display(project) } : {})
      },
      servers,
      ...(errors.length ? { error: errors.join('\n') } : {})
    }
  }

  /** Ajoute ou remplace un serveur (`previousName` : renommage). */
  save(scope: McpScope, workspace: string, server: McpServer, previousName?: string): void {
    this.edit(scope, workspace, (text, data) => {
      const entries = this.format.entries(data)
      const previous = entries.find((e) => e.name === (previousName ?? server.name))
      let next = text
      if (previousName && previousName !== server.name) {
        if (entries.some((e) => e.name === server.name)) {
          throw new Error(t('mcpFiles.exists', { name: server.name }))
        }
        if (previous) next = this.apply(next, previous.path, undefined)
      }
      // Gardé là où il était écrit, sous la même forme ; un nouveau va où le format le veut.
      const target = previous
        ? { path: [...previous.path.slice(0, -1), server.name], native: previous.native }
        : this.format.placeNew(data, server.name)
      const raw = this.format.toRaw(server, previous?.raw, target.native)
      return this.apply(next, target.path, raw)
    })
  }

  /** Retire un serveur ; son conteneur vidé part aussi, et le fichier s'il est vide (fiche 126). */
  remove(scope: McpScope, workspace: string, name: string): void {
    const file = this.file(scope, workspace)
    const config = readConfig(file)
    if ('error' in config) throw new Error(config.error)
    const entry = this.format.entries(config.data).find((e) => e.name === name)
    if (!entry) return
    const text = this.apply(config.text || '{}', entry.path, undefined)
    writeOrRemove(file, pruneRemoved(text, entry.path))
  }

  setEnabled(scope: McpScope, workspace: string, name: string, enabled: boolean): void {
    this.edit(scope, workspace, (text, data) => {
      const entry = this.format.entries(data).find((e) => e.name === name)
      if (!entry) throw new Error(`Serveur introuvable : ${name}`)
      const { field, value } = this.format.enabledEdit(enabled, entry.native)
      return this.apply(text, [...entry.path, field], value)
    })
  }

  /** Chemin affiché : `~` pour le dossier personnel. */
  private display(file: string): string {
    const home = this.loc.home.replace(/\/+$/, '')
    return file.startsWith(`${home}/`) ? `~${file.slice(home.length)}` : file
  }

  private apply(text: string, path: string[], value: unknown): string {
    return applyEdits(text, modify(text, path, value, { formattingOptions: FORMATTING }))
  }

  private edit(
    scope: McpScope,
    workspace: string,
    change: (text: string, data: Record<string, unknown>) => string
  ): void {
    const file = this.file(scope, workspace)
    const config = readConfig(file)
    if ('error' in config) throw new Error(config.error)
    const next = change(config.text || '{}', config.data)
    mkdirSync(dirname(file), { recursive: true })
    writeFileAtomic(file, next.endsWith('\n') ? next : `${next}\n`)
  }
}
