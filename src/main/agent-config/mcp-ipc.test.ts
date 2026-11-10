import { describe, expect, it, vi } from 'vitest'
import type { AppToolFamily, McpAgentView } from '@shared/mcp'
import { mcpHandlers } from './mcp-ipc'

const family: AppToolFamily = {
  id: 'terminal',
  title: 'appToolFamilies.terminal.title',
  summary: 'appToolFamilies.terminal.summary',
  condition: 'appToolFamilies.always',
  tools: [{ name: 'terminal_read', description: 'Read.' }],
  tokens: 40,
  enabled: true
}

function setup() {
  const conversations = {
    settingsView: () => ({ workspace: '/projet' }) as never,
    appToolsCatalog: vi.fn(() => [family]),
    appToolNames: vi.fn((id: string) => ({
      names: id === 'c1' ? ['ask_user', 'terminal_read'] : [],
      tokens: 0
    }))
  }
  const appSettings = { setAppToolFamily: vi.fn() }
  const mcp = {
    list: vi.fn((): McpAgentView[] => []),
    save: vi.fn((): McpAgentView[] => []),
    remove: vi.fn((): McpAgentView[] => []),
    setEnabled: vi.fn((): McpAgentView[] => []),
    test: vi.fn(async () => ({ ok: false as const, error: 'x', ms: 1 }))
  }
  return { conversations, mcp, appSettings, handlers: mcpHandlers(mcp, conversations, appSettings) }
}

describe('canaux de Réglages › Serveurs MCP (fiche 099)', () => {
  it('outils de Bobine : les familles, et les noms reçus par une conversation', () => {
    const { handlers } = setup()
    expect(handlers['mcp:appTools']()).toEqual([family])
    expect(handlers['conversation:appTools']('c1')).toEqual({
      names: ['ask_user', 'terminal_read'],
      tokens: 0
    })
    expect(() => handlers['conversation:appTools']('' as string)).toThrow('Paramètre invalide')
    expect(() => handlers['conversation:appTools'](42 as unknown as string)).toThrow(
      'Paramètre invalide'
    )
  })

  it('serveurs des agents : dossier courant, arguments vérifiés', () => {
    const { handlers, mcp } = setup()
    handlers['mcp:list']()
    expect(mcp.list).toHaveBeenCalledWith('/projet')
    handlers['mcp:setEnabled']('bob', 'project', 'recherche', false)
    expect(mcp.setEnabled).toHaveBeenCalledWith('bob', 'project', '/projet', 'recherche', false)
    expect(() => handlers['mcp:remove']('bob', 'partout' as 'global', 'x')).toThrow('scope')
    expect(() =>
      handlers['mcp:setEnabled']('bob', 'global', 'x', 'oui' as unknown as boolean)
    ).toThrow('enabled')
  })

  it('sans réglages MCP (essais) : erreur claire, les outils de Bobine restent lisibles', () => {
    const { conversations, appSettings } = setup()
    const handlers = mcpHandlers(undefined, conversations, appSettings)
    expect(() => handlers['mcp:list']()).toThrow()
    expect(handlers['mcp:appTools']()).toEqual([family])
  })

  it('familles d’outils de Bobine : coupées dans les réglages, arguments vérifiés (fiche 109)', () => {
    const { handlers, appSettings } = setup()
    expect(handlers['mcp:setAppToolFamily']('terminal', false)).toEqual([family])
    expect(appSettings.setAppToolFamily).toHaveBeenCalledWith('terminal', false)
    expect(() => handlers['mcp:setAppToolFamily']('inconnue', false)).toThrow('id')
    expect(() => handlers['mcp:setAppToolFamily']('terminal', 'non' as unknown as boolean)).toThrow(
      'enabled'
    )
  })
})
