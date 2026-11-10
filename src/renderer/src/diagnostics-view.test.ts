import { describe, expect, it } from 'vitest'
import type { McpAgentView, McpServerEntry, McpTestResult } from '@shared/mcp'
import { mcpGroup, orderGroups, pendingAgentGroup } from './diagnostics-view'

const server = (name: string, enabled = true): McpServerEntry =>
  ({ name, scope: 'global', enabled, transport: 'stdio', command: 'npx' }) as McpServerEntry

const view: McpAgentView = {
  profileId: 'bob',
  label: 'IBM Bob',
  files: { global: '~/.bob/settings/mcp_settings.json' },
  servers: [server('memory'), server('panne'), server('vieux', false), server('nouveau')]
}

const results: Record<string, McpTestResult> = {
  'bob:global:memory': {
    ok: true,
    server: { name: 'memory', version: '1.0' },
    tools: ['a', 'b'],
    ms: 5
  },
  'bob:global:panne': { ok: false, error: 'spawn npx ENOENT', ms: 1 }
}

describe('diagnostic — serveurs MCP (fiche 061)', () => {
  it('état de chaque serveur, la panne avec la marche à suivre', () => {
    const group = mcpGroup(
      [view],
      (key) => results[key],
      (e) => e
    )
    expect(group.checks.map((c) => [c.label, c.level, c.detail])).toEqual([
      ['memory (IBM Bob, global)', 'ok', 'memory 1.0 · 2 outils'],
      ['panne (IBM Bob, global)', 'error', 'spawn npx ENOENT'],
      ['vieux (IBM Bob, global)', 'optional', 'désactivé'],
      ['nouveau (IBM Bob, global)', 'pending', 'test…']
    ])
    expect(group.checks[1]?.action).toBe('open-mcp-settings')
  })

  it('aucun serveur, lecture, fichier illisible', () => {
    expect(
      mcpGroup(
        [],
        () => undefined,
        (e) => e
      ).checks[0]
    ).toMatchObject({
      level: 'optional',
      detail: 'aucun serveur configuré'
    })
    expect(
      mcpGroup(
        'loading',
        () => undefined,
        (e) => e
      ).checks[0]?.level
    ).toBe('pending')
    const broken = { ...view, servers: [], error: 'JSON invalide' }
    expect(
      mcpGroup(
        [broken],
        () => undefined,
        (e) => e
      ).checks[0]
    ).toMatchObject({
      level: 'warning',
      detail: 'JSON invalide'
    })
  })

  it('ordre : l’app, l’environnement, les agents, MCP, puis les simulateurs', () => {
    const g = (id: string) => ({ id, title: id, checks: [] })
    expect(
      orderGroups([
        g('ios'),
        g('mcp'),
        pendingAgentGroup('opencode', 'OpenCode'),
        g('android'),
        g('environment'),
        pendingAgentGroup('bob', 'IBM Bob'),
        g('app')
      ]).map((x) => x.id)
    ).toEqual(['app', 'environment', 'agent:opencode', 'agent:bob', 'mcp', 'ios', 'android'])
  })
})
