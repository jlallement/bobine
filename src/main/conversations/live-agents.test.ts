import { describe, expect, it, vi } from 'vitest'
import type { AgentHost } from '../agent/agent-host'
import { agentsToStop, imposedLiveLimit, releaseAgent } from './live-agents'

const agent = (id: string, lastUsed: number) => ({ id, lastUsed })
const ids = (agents: { id: string }[]) => agents.map((a) => a.id)

describe('agentsToStop', () => {
  const live = [agent('c', 30), agent('a', 10), agent('d', 40), agent('b', 20)]

  it('les moins récemment utilisés d’abord, juste ce qu’il faut pour revenir au plafond', () => {
    expect(ids(agentsToStop(live, 2, () => false))).toEqual(['a', 'b'])
    expect(ids(agentsToStop(live, 3, () => false))).toEqual(['a'])
  })

  it('sous le plafond ou à égalité : aucun', () => {
    expect(agentsToStop(live, 4, () => false)).toEqual([])
    expect(agentsToStop(live, 12, () => false)).toEqual([])
    expect(agentsToStop([], 2, () => false)).toEqual([])
  })

  it('jamais un agent gardé : on passe au suivant, et on s’arrête faute de candidats (limite souple)', () => {
    expect(ids(agentsToStop(live, 2, (a) => a.id === 'a'))).toEqual(['b', 'c'])
    expect(ids(agentsToStop(live, 1, (a) => a.id !== 'b'))).toEqual(['b'])
    expect(agentsToStop(live, 1, () => true)).toEqual([])
  })

  it('ne réordonne pas la liste reçue', () => {
    agentsToStop(live, 1, () => false)
    expect(ids(live)).toEqual(['c', 'a', 'd', 'b'])
  })
})

describe('imposedLiveLimit', () => {
  it('BOBINE_MAX_LIVE : un entier positif, sinon rien (le réglage vaut)', () => {
    expect(imposedLiveLimit({ BOBINE_MAX_LIVE: '2' })).toBe(2)
    expect(imposedLiveLimit({ BOBINE_MAX_LIVE: '20' })).toBe(20)
    expect(imposedLiveLimit({})).toBeUndefined()
    for (const value of ['', '0', '-1', '2.5', 'deux']) {
      expect(imposedLiveLimit({ BOBINE_MAX_LIVE: value })).toBeUndefined()
    }
  })
})

describe('releaseAgent', () => {
  it('détache l’agent tout de suite, ferme sa session puis arrête son processus', async () => {
    const calls: string[] = []
    const host = {
      closeSession: vi.fn(() => {
        calls.push('close')
        return Promise.reject(new Error('déjà fermée'))
      }),
      stop: vi.fn(() => calls.push('stop'))
    } as unknown as AgentHost
    const conversation: Parameters<typeof releaseAgent>[0] = {
      host,
      snapshot: { status: 'ready' } as never
    }
    releaseAgent(conversation)
    expect(conversation.host).toBeUndefined()
    expect(conversation.snapshot).toBeUndefined()
    await vi.waitFor(() => expect(calls).toEqual(['close', 'stop']))
    // Sans agent : rien à faire.
    releaseAgent(conversation)
    expect(calls).toEqual(['close', 'stop'])
  })
})
