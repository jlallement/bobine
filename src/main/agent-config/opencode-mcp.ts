/**
 * Serveurs MCP d'OpenCode (fiches 025, 078), tels que son profil les déclare (`McpConfigSource`,
 * fiche 140).
 *
 * - OpenCode 1.19 : `~/.config/opencode/opencode.json(c)` (global), `opencode.json(c)` du projet
 *   (cherché du dossier jusqu'à la racine git) ; `{ "mcp": { nom: { type: "local", command: [...],
 *   environment, enabled } | { type: "remote", url, headers, enabled } } }`.
 * - OpenCode 2.0.31 (fiche 078) : mêmes fichiers ; lit encore ce format, et son format natif
 *   `{ "mcp": { "servers": { nom: { …, disabled } }, "timeout": … } }`. Un serveur est modifié dans
 *   la forme où il est écrit (`native`) ; un nouveau serveur va dans `mcp.servers` si le fichier l'a
 *   déjà, sinon au format 1, que lisent les deux versions.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { t } from 'i18next'
import type { McpConfigSource } from '../agent/adapters'
import { firstExisting, isObject, list, strings, tableEntries, without } from './mcp-files'

/**
 * Membres du format natif d'OpenCode 2 sous `mcp` (`servers`, `timeout`) : ils ne sont pas des
 * serveurs, sauf s'ils en ont la forme (un serveur nommé « servers », comme le lit OpenCode).
 */
const OPENCODE_MEMBERS = new Set(['servers', 'timeout'])
const isOpenCodeMember = (name: string, raw: unknown) =>
  OPENCODE_MEMBERS.has(name) && !(isObject(raw) && typeof raw['type'] === 'string')

export const OPENCODE_MCP: McpConfigSource = {
  summary: () => t('capabilities.mcpFiles.opencode'),
  globalFile: (loc) => {
    const dir = join(loc.xdgConfigHome ?? join(loc.home, '.config'), 'opencode')
    return firstExisting([join(dir, 'opencode.jsonc'), join(dir, 'opencode.json')])
  },
  projectFile: (workspace) => {
    // Comme OpenCode : du dossier jusqu'à la racine git ; sinon, à créer dans le dossier.
    for (let dir = workspace; ; dir = dirname(dir)) {
      const found = ['opencode.jsonc', 'opencode.json']
        .map((f) => join(dir, f))
        .find((f) => existsSync(f))
      if (found) return found
      if (existsSync(join(dir, '.git')) || dirname(dir) === dir) {
        return join(existsSync(join(dir, '.git')) ? dir : workspace, 'opencode.json')
      }
    }
  },
  entries: (data) => {
    const mcp = data['mcp']
    if (!isObject(mcp)) return []
    const legacy = Object.fromEntries(
      Object.entries(mcp).filter(([name, raw]) => !isOpenCodeMember(name, raw))
    )
    const native = isOpenCodeMember('servers', mcp['servers']) ? mcp['servers'] : undefined
    return [
      ...tableEntries(native, ['mcp', 'servers'], true),
      ...tableEntries(legacy, ['mcp'], false)
    ]
  },
  placeNew: (data, name) => {
    const mcp = data['mcp']
    return isObject(mcp) && isObject(mcp['servers']) && isOpenCodeMember('servers', mcp['servers'])
      ? { path: ['mcp', 'servers', name], native: true }
      : { path: ['mcp', name], native: false }
  },
  fromRaw: (name, raw, native) => {
    const enabled = native ? raw['disabled'] !== true : raw['enabled'] !== false
    if (raw['type'] === 'remote' || typeof raw['url'] === 'string') {
      const headers = strings(raw['headers'])
      return {
        name,
        transport: 'http',
        url: typeof raw['url'] === 'string' ? raw['url'] : '',
        ...(headers ? { headers } : {}),
        enabled
      }
    }
    const [command = '', ...args] = list(raw['command'])
    const env = strings(raw['environment'])
    return {
      name,
      transport: 'stdio',
      command,
      ...(args.length ? { args } : {}),
      ...(env ? { env } : {}),
      enabled
    }
  },
  toRaw: (server, previous, native) => {
    const base = without(previous, [
      'type',
      'command',
      'environment',
      'url',
      'headers',
      'enabled',
      'disabled'
    ])
    const fields =
      server.transport === 'http'
        ? {
            type: 'remote',
            url: server.url,
            ...(server.headers ? { headers: server.headers } : {})
          }
        : {
            type: 'local',
            command: [server.command, ...(server.args ?? [])],
            ...(server.env ? { environment: server.env } : {})
          }
    const off = native ? { disabled: true } : { enabled: false }
    return { ...fields, ...base, ...(server.enabled ? {} : off) }
  },
  enabledEdit: (enabled, native) =>
    native
      ? { field: 'disabled', value: enabled ? undefined : true }
      : { field: 'enabled', value: enabled ? undefined : false }
}
