/**
 * Magasin partagé des états de connexion (fiche 293) : relectures dans le désordre, événements
 * reçus pendant une relecture, rangement par agent **et dossier**, relecture réutilisée (menu).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState, McpAuthView } from '@shared/mcp'
import { MCP_AUTH_REUSE_MS, mcpAuthEntry, readMcpAuth, resetMcpAuthStore } from './mcp-auth'

const state = (name: string, status: McpAuthState['status']): McpAuthState => ({
  profileId: 'opencode',
  name,
  status
})
const view = (...servers: McpAuthState[]): McpAuthView => ({
  profileId: 'opencode',
  workspace: '/projets/demo',
  agentFound: true,
  servers,
  terminal: {}
})

const original = window.api
let emit: (state: McpAuthState) => void = () => {}
let pending: ((view: McpAuthView) => void)[] = []

beforeEach(() => {
  pending = []
  window.api = {
    ...original,
    mcp: {
      authStates: () => new Promise<McpAuthView>((resolve) => pending.push(resolve)),
      onAuthState: (listener: (s: McpAuthState) => void) => {
        emit = listener
        return () => {}
      }
    }
  } as unknown as Window['api']
  resetMcpAuthStore()
})
afterEach(() => {
  window.api = original
})

describe('magasin des états de connexion (fiche 293)', () => {
  it('une relecture ancienne qui finit après une récente ne l’écrase pas', async () => {
    const first = readMcpAuth('opencode')
    const second = readMcpAuth('opencode')
    pending[1]?.(view(state('figma', 'connected')))
    await second
    pending[0]?.(view(state('figma', 'to-connect')))
    // L'ancienne répond ce que la récente a rangé.
    expect((await first).states['figma']?.status).toBe('connected')
    expect(mcpAuthEntry('opencode', '/projets/demo')?.states['figma']?.status).toBe('connected')
  })

  it('un événement reçu pendant la relecture l’emporte, sauf pour un serveur que la relecture n’a plus', async () => {
    const reading = readMcpAuth('opencode')
    emit(state('figma', 'connecting'))
    emit(state('retire', 'connected'))
    pending[0]?.(view(state('figma', 'to-connect')))
    const entry = await reading
    expect(entry.states['figma']?.status).toBe('connecting')
    expect(entry.states['retire']).toBeUndefined()
  })

  it('un événement reçu avant la relecture ne l’emporte pas : la relecture est plus récente', async () => {
    const first = readMcpAuth('opencode')
    pending[0]?.(view(state('figma', 'to-connect')))
    await first
    emit(state('figma', 'connecting'))
    expect(mcpAuthEntry('opencode', '/projets/demo')?.states['figma']?.status).toBe('connecting')
    const reading = readMcpAuth('opencode')
    pending[1]?.(view(state('figma', 'connected')))
    expect((await reading).states['figma']?.status).toBe('connected')
  })

  it('rangé par dossier : la relecture d’un autre dossier ne touche pas celui-ci', async () => {
    const a = readMcpAuth('opencode')
    pending[0]?.(view(state('figma', 'connected')))
    await a
    const b = readMcpAuth('opencode')
    pending[1]?.({ ...view(state('figma', 'to-connect')), workspace: '/projets/autre' })
    expect((await b).workspace).toBe('/projets/autre')
    expect(mcpAuthEntry('opencode', '/projets/demo')?.states['figma']?.status).toBe('connected')
    expect(mcpAuthEntry('opencode', '/projets/autre')?.states['figma']?.status).toBe('to-connect')
    expect(mcpAuthEntry('opencode', '/projets/jamais')).toBeUndefined()
  })

  it('un événement vaut pour chaque dossier relu de cet agent (connexion attachée au nom), pas pour un autre agent', async () => {
    const a = readMcpAuth('opencode')
    pending[0]?.(view(state('figma', 'to-connect')))
    await a
    const b = readMcpAuth('opencode')
    pending[1]?.({ ...view(state('figma', 'to-connect')), workspace: '/projets/autre' })
    await b
    const c = readMcpAuth('bob')
    pending[2]?.({ ...view(), profileId: 'bob' })
    await c
    emit(state('figma', 'connected'))
    expect(mcpAuthEntry('opencode', '/projets/demo')?.states['figma']?.status).toBe('connected')
    expect(mcpAuthEntry('opencode', '/projets/autre')?.states['figma']?.status).toBe('connected')
    expect(mcpAuthEntry('bob', '/projets/demo')?.states['figma']).toBeUndefined()
  })

  it('menu (`reuse`) : une relecture en cours est réutilisée, une récente rendue telle quelle, une ancienne refaite', async () => {
    vi.useFakeTimers()
    try {
      const reuse = { workspace: '/projets/demo' }
      const first = readMcpAuth('opencode', reuse)
      const second = readMcpAuth('opencode', reuse)
      expect(pending).toHaveLength(1)
      pending[0]?.(view(state('figma', 'connected')))
      expect(await second).toBe(await first)
      await vi.advanceTimersByTimeAsync(MCP_AUTH_REUSE_MS - 1)
      await readMcpAuth('opencode', reuse)
      expect(pending).toHaveLength(1)
      // Autre dossier attendu : rien à réutiliser.
      void readMcpAuth('opencode', { workspace: '/projets/autre' })
      expect(pending).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(1)
      void readMcpAuth('opencode', reuse)
      expect(pending).toHaveLength(3)
      // Sans `reuse` (actions de l'onglet) : toujours relu.
      void readMcpAuth('opencode')
      expect(pending).toHaveLength(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('menu (`reuse`) : une relecture en échec n’est pas gardée, la suivante relit', async () => {
    let calls = 0
    window.api.mcp.authStates = () =>
      ++calls === 1 ? Promise.reject(new Error('x')) : Promise.resolve(view())
    const reuse = { workspace: '/projets/demo' }
    await expect(readMcpAuth('opencode', reuse)).rejects.toThrow('x')
    await readMcpAuth('opencode', reuse)
    expect(calls).toBe(2)
  })
})
