/**
 * Magasin partagé des états de connexion (fiche 293) : relectures dans le désordre, événements
 * reçus pendant une relecture.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { McpAuthState, McpAuthView } from '@shared/mcp'
import { mcpAuthEntry, readMcpAuth, resetMcpAuthStore } from './mcp-auth'

const state = (name: string, status: McpAuthState['status']): McpAuthState => ({
  profileId: 'opencode',
  name,
  status
})
const view = (...servers: McpAuthState[]): McpAuthView => ({
  profileId: 'opencode',
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
    expect(mcpAuthEntry('opencode')?.states['figma']?.status).toBe('connected')
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
    expect(mcpAuthEntry('opencode')?.states['figma']?.status).toBe('connecting')
    const reading = readMcpAuth('opencode')
    pending[1]?.(view(state('figma', 'connected')))
    expect((await reading).states['figma']?.status).toBe('connected')
  })
})
