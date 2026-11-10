/**
 * Serveurs MCP de Bob (fiche 025), tels que son profil les déclare (`McpConfigSource`, fiche 140).
 * Bob 2.0.6 : `~/.bob/settings/mcp.json` (global), `<dossier>/.bob/mcp.json` (projet) ;
 * `{ "mcpServers": { nom: { command, args, env | url, headers, disabled } } }`.
 */
import { join } from 'node:path'
import { t } from 'i18next'
import type { McpConfigSource } from '../agent/adapters'
import { list, strings, tableEntries, without } from './mcp-files'

export const BOB_MCP: McpConfigSource = {
  summary: () => t('capabilities.mcpFiles.bob'),
  globalFile: (loc) => join(loc.home, '.bob', 'settings', 'mcp.json'),
  projectFile: (workspace) => join(workspace, '.bob', 'mcp.json'),
  entries: (data) => tableEntries(data['mcpServers'], ['mcpServers'], false),
  placeNew: (_data, name) => ({ path: ['mcpServers', name], native: false }),
  fromRaw: (name, raw) => {
    const env = strings(raw['env'])
    const headers = strings(raw['headers'])
    const args = list(raw['args'])
    const enabled = raw['disabled'] !== true
    return typeof raw['url'] === 'string'
      ? { name, transport: 'http', url: raw['url'], ...(headers ? { headers } : {}), enabled }
      : {
          name,
          transport: 'stdio',
          command: typeof raw['command'] === 'string' ? raw['command'] : '',
          ...(args.length ? { args } : {}),
          ...(env ? { env } : {}),
          enabled
        }
  },
  toRaw: (server, previous) => {
    const base = without(previous, ['command', 'args', 'env', 'url', 'headers', 'disabled'])
    const fields =
      server.transport === 'http'
        ? { url: server.url, ...(server.headers ? { headers: server.headers } : {}) }
        : {
            command: server.command,
            ...(server.args?.length ? { args: server.args } : {}),
            ...(server.env ? { env: server.env } : {})
          }
    return { ...base, ...fields, ...(server.enabled ? {} : { disabled: true }) }
  },
  enabledEdit: (enabled) => ({ field: 'disabled', value: enabled ? undefined : true })
}
