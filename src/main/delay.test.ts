import { afterEach, describe, expect, it, vi } from 'vitest'
import { delay } from './delay'

describe('delay', () => {
  afterEach(() => vi.useRealTimers())

  it('résolue au bout du délai, pas avant', async () => {
    vi.useFakeTimers()
    let done = false
    const waiting = delay(100).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(99)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await waiting
    expect(done).toBe(true)
  })

  it('`unref` : le minuteur ne retient pas le processus', async () => {
    const spy = vi.spyOn(globalThis, 'setTimeout')
    await delay(1, { unref: true })
    const timer = spy.mock.results[0]?.value as NodeJS.Timeout
    expect(timer.hasRef()).toBe(false)
    await delay(1)
    const kept = spy.mock.results[1]?.value as NodeJS.Timeout
    expect(kept.hasRef()).toBe(true)
    spy.mockRestore()
  })
})
