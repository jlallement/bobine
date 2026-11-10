import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { silenceBannerMs, watchSilence } from './silence-watch'

describe('silence de l’agent pendant un tour (fiche 194)', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }))
  afterEach(() => vi.useRealTimers())

  function watch(waiting = () => false) {
    let last = 0
    const calls: (number | undefined)[] = []
    const timer = watchSilence({
      lastActivity: () => last,
      waiting,
      scope: '[essai]',
      onSilent: (since) => calls.push(since)
    })
    return {
      calls,
      speak: (at: number) => (last = at),
      stop: () => clearInterval(timer)
    }
  }

  it('bandeau au bout de 5 min de silence, pas avant ; parti quand l’agent reparle', () => {
    const w = watch()
    vi.advanceTimersByTime(4 * 60_000 + 59_000)
    expect(w.calls).toEqual([])
    vi.advanceTimersByTime(15_000)
    expect(w.calls).toEqual([0])
    w.speak(Date.now())
    vi.advanceTimersByTime(15_000)
    expect(w.calls).toEqual([0, undefined])
    w.stop()
  })

  it('l’agent attend l’utilisateur (autorisation, question) : pas de bandeau', () => {
    const w = watch(() => true)
    vi.advanceTimersByTime(20 * 60_000)
    expect(w.calls).toEqual([])
    w.stop()
  })

  it('après une longue autorisation : le silence se compte depuis la réponse de l’utilisateur', () => {
    let waiting = true
    const w = watch(() => waiting)
    vi.advanceTimersByTime(10 * 60_000)
    waiting = false
    const answeredAt = Date.now()
    vi.advanceTimersByTime(4 * 60_000)
    expect(w.calls).toEqual([])
    vi.advanceTimersByTime(61_000)
    expect(w.calls).toHaveLength(1)
    // Depuis la fin de l'attente (à un contrôle près), pas depuis le dernier octet d'il y a 15 min.
    expect(answeredAt - (w.calls[0] ?? 0)).toBeLessThanOrEqual(15_000)
    w.stop()
  })

  it('seuil imposé par `BOBINE_SILENCE_MS` (essais), sinon 5 min', () => {
    expect(silenceBannerMs({})).toBe(300_000)
    expect(silenceBannerMs({ BOBINE_SILENCE_MS: '2000' })).toBe(2000)
    expect(silenceBannerMs({ BOBINE_SILENCE_MS: 'non' })).toBe(300_000)
  })
})
