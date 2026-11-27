import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpServerEntry } from '@shared/mcp'
import { testMcpServers } from './mcp-status'

const server = (name: string, over: Partial<McpServerEntry> = {}): McpServerEntry => ({
  name,
  transport: 'http',
  url: `https://${name}.test/mcp`,
  enabled: true,
  scope: 'global',
  file: '/f.json',
  ...over
})

const original = window.api
afterEach(() => {
  window.api = original
})

describe('« Tester » les serveurs MCP (fiche 060)', () => {
  it('un serveur connecté par l’agent n’est jamais testé par Bobine (fiche 293), ni un désactivé', async () => {
    const test = vi.fn(async () => ({ ok: true as const, tools: [], ms: 1 }))
    window.api = { ...original, mcp: { test } } as unknown as Window['api']
    await testMcpServers('opencode', [
      server('figma', { authPreset: 'figma' }),
      server('coupe', { enabled: false }),
      server('recherche')
    ])
    expect(test.mock.calls).toEqual([['opencode', 'global', 'recherche']])
  })
})
