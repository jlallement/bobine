/**
 * Canaux de Réglages › Serveurs MCP (fiches 025, 060), sortis d'`ipc.ts` (fiche 099) : les serveurs
 * des agents, lus et écrits dans leurs fichiers pour le dossier courant, et les outils de Bobine,
 * dont les familles se coupent (fiche 109).
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { McpScope } from '@shared/mcp'
import type { ConversationManager } from '../conversations/manager'
import type { SettingsStore } from '../settings-store'
import type { McpSettings } from './mcp-settings'

type McpChannels =
  | 'mcp:list'
  | 'mcp:save'
  | 'mcp:remove'
  | 'mcp:setEnabled'
  | 'mcp:test'
  | 'mcp:appTools'
  | 'mcp:setAppToolFamily'
  | 'conversation:appTools'

/* Les arguments IPC viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

function mcpScope(value: unknown): McpScope {
  if (value !== 'global' && value !== 'project') throw new Error('Paramètre invalide : scope')
  return value
}

export function mcpHandlers(
  mcp: Pick<McpSettings, 'list' | 'save' | 'remove' | 'setEnabled' | 'test'> | undefined,
  conversations: Pick<ConversationManager, 'settingsView' | 'appToolsCatalog' | 'appToolNames'>,
  appSettings: Pick<SettingsStore, 'setAppToolFamily'>
): Pick<IpcHandlers, McpChannels> {
  const settings = () => {
    if (!mcp) throw new Error(t('ipc.unavailable.mcp'))
    return mcp
  }
  const workspace = () => conversations.settingsView().workspace
  return {
    'mcp:list': () => settings().list(workspace()),
    'mcp:save': (profileId, scope, server, previousName) =>
      settings().save(
        str(profileId, 'profileId'),
        mcpScope(scope),
        workspace(),
        server,
        previousName === undefined ? undefined : str(previousName, 'previousName')
      ),
    'mcp:remove': (profileId, scope, name) =>
      settings().remove(
        str(profileId, 'profileId'),
        mcpScope(scope),
        workspace(),
        str(name, 'name')
      ),
    'mcp:setEnabled': (profileId, scope, name, enabled) => {
      if (typeof enabled !== 'boolean') throw new Error('Paramètre invalide : enabled')
      return settings().setEnabled(
        str(profileId, 'profileId'),
        mcpScope(scope),
        workspace(),
        str(name, 'name'),
        enabled
      )
    },
    'mcp:test': (profileId, scope, name) =>
      settings().test(str(profileId, 'profileId'), mcpScope(scope), workspace(), str(name, 'name')),
    'mcp:appTools': () => conversations.appToolsCatalog(),
    'mcp:setAppToolFamily': (id, enabled) => {
      if (typeof enabled !== 'boolean') throw new Error('Paramètre invalide : enabled')
      const family = str(id, 'id')
      if (!conversations.appToolsCatalog().some((f) => f.id === family && !f.required)) {
        throw new Error(`Paramètre invalide : id`)
      }
      appSettings.setAppToolFamily(family, enabled)
      return conversations.appToolsCatalog()
    },
    'conversation:appTools': (id) => conversations.appToolNames(str(id, 'id'))
  }
}
