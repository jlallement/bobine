import { describe, expect, it, vi } from 'vitest'
import { roundtableHandlers, type RoundtableService } from './ipc'

function service(): RoundtableService & Record<string, ReturnType<typeof vi.fn>> {
  return {
    options: vi.fn(() => ({ agents: [], freeSlots: 5, inGit: true, lastExchange: false })),
    start: vi.fn(() => ({ ok: true as const, roundtableId: 'rt' })),
    synthesize: vi.fn(),
    rebuttal: vi.fn(),
    decide: vi.fn(),
    relaunch: vi.fn(),
    stop: vi.fn()
  }
}

const participants = [
  { profileId: 'opencode', model: { controlId: 'model', value: 'a/b', name: 'B' } },
  { profileId: 'bob' }
]

describe('canaux du tour de table (fiche 285)', () => {
  it('sans orchestrateur, chaque canal refuse clairement', async () => {
    const handlers = roundtableHandlers(undefined)
    expect(() => handlers['roundtable:options']('c')).toThrow(/pas encore disponible/)
    await expect(handlers['roundtable:synthesize']('c', 'rt')).rejects.toThrow(
      /pas encore disponible/
    )
  })

  it('les arguments passent par les `parse…` du contrat avant l’orchestrateur', async () => {
    const s = service()
    const handlers = roundtableHandlers(s)
    const bad: unknown[] = ['', 42, null, 'a\u0000b', 'x'.repeat(201)]
    for (const id of bad) {
      expect(() => handlers['roundtable:options'](id as string)).toThrow(/Paramètre invalide/)
      await expect(handlers['roundtable:stop']('c', id as string)).rejects.toThrow(
        /Paramètre invalide/
      )
    }
    await expect(handlers['roundtable:relaunch']('c', 'rt', 'Z' as 'A')).rejects.toThrow(/letter/)
    expect(() =>
      handlers['roundtable:start']('c', { question: ' ', participants } as never)
    ).toThrow(/question/)
    expect(() =>
      handlers['roundtable:start']('c', {
        question: 'Q',
        participants: [{ profileId: '../evil' }, { profileId: 'bob' }]
      } as never)
    ).toThrow(/profileId/)
    expect(() =>
      handlers['roundtable:start']('c', {
        question: 'Q',
        participants: [{ profileId: 'bob' }, { profileId: 'bob' }]
      } as never)
    ).toThrow(/doublon/)
    for (const name of ['options', 'start', 'stop', 'relaunch'])
      expect(s[name]).not.toHaveBeenCalled()
  })

  it('arguments valides : transmis tels que vérifiés', async () => {
    const s = service()
    const handlers = roundtableHandlers(s)
    expect(await handlers['roundtable:start']('c', { question: '  Q  ', participants })).toEqual({
      ok: true,
      roundtableId: 'rt'
    })
    expect(s['start']).toHaveBeenCalledWith('c', { question: 'Q', participants })
    await handlers['roundtable:stop']('c', 'rt')
    expect(s['stop']).toHaveBeenCalledWith('c', 'rt', undefined)
    await handlers['roundtable:relaunch']('c', 'rt', 'B')
    expect(s['relaunch']).toHaveBeenCalledWith('c', 'rt', 'B')
  })
})
