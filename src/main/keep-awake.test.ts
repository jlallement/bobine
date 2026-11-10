import { describe, expect, it, vi } from 'vitest'
import { KeepAwake } from './keep-awake'

describe('empêcher la mise en veille', () => {
  it('actif seulement pendant le travail d’un agent, et si le réglage le veut', () => {
    const blocker = { start: vi.fn(() => 7), stop: vi.fn() }
    const awake = new KeepAwake(blocker)
    awake.update(false, true)
    expect(blocker.start).not.toHaveBeenCalled()
    awake.update(true, true)
    awake.update(true, true)
    expect(blocker.start).toHaveBeenCalledTimes(1)
    expect(awake.active).toBe(true)
    awake.update(true, false)
    expect(blocker.stop).toHaveBeenCalledWith(7)
    expect(awake.active).toBe(false)
    awake.update(false, false)
    expect(blocker.stop).toHaveBeenCalledTimes(1)
  })
})
