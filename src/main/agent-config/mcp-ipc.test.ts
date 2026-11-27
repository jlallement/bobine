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
    test: vi.fn(async () => ({ ok: false as const, error: 'x', ms: 1 })),
    addPreset: vi.fn(() => ({ name: 'figma', added: true, views: [] as McpAgentView[] })),
    authStates: vi.fn(async (profileId: string) => ({ profileId, agentFound: true, servers: [] })),
    connect: vi.fn(async () => ({ started: true as const })),
    cancelConnect: vi.fn(() => true),
    reopenPage: vi.fn(() => true),
    disconnect: vi.fn(async () => ({ done: true as const }))
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

  it('connexion par l’agent (fiche 293) : dossier courant, arguments vérifiés', async () => {
    const { handlers, mcp } = setup()
    handlers['mcp:addPreset']('opencode', 'figma')
    expect(mcp.addPreset).toHaveBeenCalledWith('opencode', 'figma', '/projet')
    await handlers['mcp:authStates']('opencode')
    expect(mcp.authStates).toHaveBeenCalledWith('opencode', '/projet')
    await handlers['mcp:connect']('opencode', 'figma')
    expect(mcp.connect).toHaveBeenCalledWith('opencode', 'figma', '/projet')
    handlers['mcp:cancelConnect']('opencode', 'figma')
    expect(mcp.cancelConnect).toHaveBeenCalledWith('opencode', 'figma')
    handlers['mcp:reopenPage']('opencode', 'figma')
    expect(mcp.reopenPage).toHaveBeenCalledWith('opencode', 'figma')
    await handlers['mcp:disconnect']('opencode', 'figma')
    expect(mcp.disconnect).toHaveBeenCalledWith('opencode', 'figma', '/projet')
    expect(() => handlers['mcp:connect']('opencode', 42 as unknown as string)).toThrow('name')
    expect(() => handlers['mcp:addPreset']('', 'figma')).toThrow('profileId')
    expect(() => handlers['mcp:reopenPage']('opencode', '')).toThrow('name')
    expect(mcp.connect).toHaveBeenCalledTimes(1)
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
