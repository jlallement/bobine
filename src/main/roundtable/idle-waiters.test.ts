import { afterEach, describe, expect, it, vi } from 'vitest'
import { IdleWaiters, LATE_COST_MS } from './idle-waiters'

afterEach(() => {
  vi.useRealTimers()
})

describe('agents des participants libérés (contre-recette N1)', () => {
  it('coût lu après coup : libéré dès sa lecture, au plus tard à l’échéance', async () => {
    vi.useFakeTimers()
    const idle = new IdleWaiters(() => 'ready')
    const released: string[] = []
    idle.releaseSeats(
      [
        { childId: 'bob' },
        { childId: 'lent' },
        { childId: 'ocode' },
        { childId: 'parti', removed: true }
      ],
      (id) => id !== 'ocode',
      undefined,
      (id) => released.push(id)
    )
    await vi.advanceTimersByTimeAsync(0)
    // Sans coût lu après coup : tout de suite.
    expect(released).toEqual(['ocode'])
    idle.onEvent('bob', { type: 'usage-report', cost: { amount: 0.0125, currency: 'bobcoins' } })
    await vi.advanceTimersByTimeAsync(0)
    expect(released).toEqual(['ocode', 'bob'])
    // Coût jamais lu : à l'échéance, pas avant.
    await vi.advanceTimersByTimeAsync(LATE_COST_MS - 1)
    expect(released).not.toContain('lent')
    await vi.advanceTimersByTimeAsync(1)
    expect(released).toEqual(['ocode', 'bob', 'lent'])
  })

  it('coût lu avant la fin du tour : attendu de nouveau ; lu après : libéré aussitôt', async () => {
    vi.useFakeTimers()
    const idle = new IdleWaiters(() => 'ready')
    const released: string[] = []
    idle.onEvent('bob', { type: 'usage-report', cost: { amount: 0.01, currency: 'bobcoins' } })
    idle.onEvent('bob', { type: 'turn-end', stopReason: 'end_turn' })
    idle.releaseSeats(
      [{ childId: 'bob' }],
      () => true,
      1000,
      (id) => released.push(id)
    )
    await vi.advanceTimersByTimeAsync(999)
    expect(released).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(released).toEqual(['bob'])
  })

  it('statut listé qui quitte « démarre » sans évènement de l’agent : l’attente est rendue à la relecture', async () => {
    let status = 'starting'
    const idle = new IdleWaiters(() => status)
    let done = false
    void idle.wait('c', 60_000).then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    // Lancement abandonné : la liste dit « prêt », l'agent n'émet rien.
    status = 'ready'
    idle.recheck()
    await Promise.resolve()
    expect(done).toBe(true)
  })
})
