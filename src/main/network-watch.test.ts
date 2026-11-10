import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNetworkWatch } from './network-watch'

describe('retour du réseau', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const setup = () => {
    let online = false
    const power = new EventEmitter()
    const isOnline = vi.fn(() => online)
    const watch = createNetworkWatch({ isOnline, power, intervalMs: 1000 })
    return { watch, power, isOnline, setOnline: (value: boolean) => (online = value) }
  }

  it('prévient quand le réseau revient, une fois par retour', () => {
    const { watch, setOnline } = setup()
    const restored = vi.fn()
    watch.onRestored(restored)
    vi.advanceTimersByTime(3000)
    expect(restored).not.toHaveBeenCalled()
    setOnline(true)
    vi.advanceTimersByTime(1000)
    expect(restored).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(restored).toHaveBeenCalledTimes(1)
    setOnline(false)
    vi.advanceTimersByTime(1000)
    setOnline(true)
    vi.advanceTimersByTime(1000)
    expect(restored).toHaveBeenCalledTimes(2)
  })

  it('prévient à la sortie de veille', () => {
    const { watch, power, setOnline } = setup()
    setOnline(true)
    const restored = vi.fn()
    watch.onRestored(restored)
    power.emit('resume')
    expect(restored).toHaveBeenCalledTimes(1)
  })

  it('ne sonde que tant que quelqu’un attend', () => {
    const { watch, power, isOnline } = setup()
    const stop = watch.onRestored(() => {})
    vi.advanceTimersByTime(2000)
    expect(isOnline).toHaveBeenCalledTimes(3)
    stop()
    stop()
    vi.advanceTimersByTime(5000)
    expect(isOnline).toHaveBeenCalledTimes(3)
    expect(power.listenerCount('resume')).toBe(0)
  })
})
