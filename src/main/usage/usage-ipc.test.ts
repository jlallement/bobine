import { describe, expect, it, vi } from 'vitest'
import type { UsageBoard } from './setup'
import { usageHandlers } from './usage-ipc'

const board = (): UsageBoard => ({
  stats: vi.fn(() => ({}) as ReturnType<UsageBoard['stats']>),
  heatmap: vi.fn(() => ({}) as ReturnType<UsageBoard['heatmap']>),
  csv: vi.fn(() => ({ name: 'bobine-turns.csv', content: 'id\r\n' })),
  reset: vi.fn(),
  spends: vi.fn(() => []),
  hasAny: vi.fn(() => true)
})

describe('canaux de la consommation (fiche 137)', () => {
  it('requête vérifiée : période et jour connus, agent facultatif', () => {
    const b = board()
    const handlers = usageHandlers({ board: b })
    handlers['usage:stats']({ scope: 'week', date: '2026-10-24', profileId: 'bob' })
    handlers['usage:stats']({ scope: 'all', date: '2026-10-24', profileId: '' })
    expect(b.stats).toHaveBeenNthCalledWith(1, {
      scope: 'week',
      date: '2026-10-24',
      profileId: 'bob'
    })
    expect(b.stats).toHaveBeenNthCalledWith(2, { scope: 'all', date: '2026-10-24' })
    expect(() => handlers['usage:stats']({ scope: '7d', date: '2026-10-24' } as never)).toThrow(
      'scope'
    )
    expect(() => handlers['usage:stats']({ scope: 'day', date: '2026-02-30' })).toThrow('date')
    expect(() =>
      handlers['usage:stats']({ scope: 'day', date: '2026-10-24', profileId: 3 } as never)
    ).toThrow('profileId')
    expect(() => handlers['usage:stats'](null as never)).toThrow('scope')
  })

  it('grille d’activité : douze derniers mois ou une année (fiche 144)', () => {
    const b = board()
    const handlers = usageHandlers({ board: b })
    handlers['usage:heatmap']({ range: 'last12' })
    handlers['usage:heatmap']({ range: 2025, profileId: 'bob' })
    expect(b.heatmap).toHaveBeenNthCalledWith(1, { range: 'last12' })
    expect(b.heatmap).toHaveBeenNthCalledWith(2, { range: 2025, profileId: 'bob' })
    expect(() => handlers['usage:heatmap']({ range: '2025' } as never)).toThrow('range')
    expect(() => handlers['usage:heatmap']({ range: 1.5 } as never)).toThrow('range')
  })

  it('export : « Enregistrer sous », écrit au chemin choisi ; annulé, rien d’écrit', async () => {
    const write = vi.fn(async () => {})
    const saveCsv = vi.fn(async () => '/tmp/x.csv')
    const handlers = usageHandlers({ board: board(), saveCsv, write })
    expect(await handlers['usage:export']({ scope: 'all', date: '2026-10-24' }, 'turns')).toBe(
      '/tmp/x.csv'
    )
    expect(saveCsv).toHaveBeenCalledWith('bobine-turns.csv')
    expect(write).toHaveBeenCalledWith('/tmp/x.csv', 'id\r\n')
    saveCsv.mockResolvedValueOnce(null as never)
    expect(await handlers['usage:export']({ scope: 'all', date: '2026-10-24' }, 'days')).toBeNull()
    expect(write).toHaveBeenCalledTimes(1)
    await expect(
      handlers['usage:export']({ scope: 'all', date: '2026-10-24' }, 'xlsx' as never)
    ).rejects.toThrow('kind')
  })

  it('remise à zéro ; sans journal : une erreur, pas un tableau vide trompeur', () => {
    const b = board()
    usageHandlers({ board: b })['usage:reset']()
    expect(b.reset).toHaveBeenCalled()
    expect(() => usageHandlers({})['usage:stats']({ scope: 'week', date: '2026-10-24' })).toThrow()
    expect(usageHandlers({})['usage:spends']()).toEqual([])
  })

  it('quota : agent vérifié', async () => {
    const refresh = vi.fn(async () => {})
    const handlers = usageHandlers({ quotas: { list: () => [], refresh } })
    await handlers['usage:refreshQuota']('bob')
    expect(refresh).toHaveBeenCalledWith('bob')
    await expect(handlers['usage:refreshQuota']('' as never)).rejects.toThrow('profileId')
  })

  it('« hasAny » : le journal a-t-il un tour ? faux sans journal (fiche 185, F9)', () => {
    expect(usageHandlers({ board: board() })['usage:hasAny']()).toBe(true)
    expect(usageHandlers({})['usage:hasAny']()).toBe(false)
  })
})
