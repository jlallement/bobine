import { describe, expect, it } from 'vitest'
import { releasedGesture, wheelSwipe } from './screen-gestures'

describe('releasedGesture', () => {
  const a = { x: 100, y: 400 }
  const b = { x: 100, y: 150 }

  it('a short click is a tap, wherever the pointer ended', () => {
    expect(releasedGesture(a, b, 3, 120, true)).toEqual({ kind: 'tap', at: a })
  })

  it('a click held still is a long press only where the device supports it', () => {
    expect(releasedGesture(a, a, 2, 820.4, true)).toEqual({ kind: 'tap', at: a, holdMs: 820 })
    expect(releasedGesture(a, a, 2, 820, false)).toEqual({ kind: 'tap', at: a })
    expect(releasedGesture(a, a, 0, 60_000, true)).toMatchObject({ holdMs: 5000 })
  })

  it('a drag is a swipe lasting as long as the gesture, within bounds', () => {
    expect(releasedGesture(a, b, 120, 300, true)).toEqual({
      kind: 'swipe',
      from: a,
      to: b,
      ms: 300
    })
    expect(releasedGesture(a, b, 120, 10, false)).toMatchObject({ ms: 50 })
    expect(releasedGesture(a, b, 120, 9000, false)).toMatchObject({ ms: 1500 })
  })
})

describe('wheelSwipe', () => {
  const screen = { width: 411, height: 914 }

  it('scrolling down pushes the content up from the pointer, away from the edges', () => {
    expect(wheelSwipe({ x: 200, y: 500 }, { dx: 0, dy: 120 }, 0.5, screen)).toEqual({
      kind: 'swipe',
      from: { x: 200, y: 500 },
      to: { x: 200, y: 260 },
      ms: 250
    })
    expect(wheelSwipe({ x: 2, y: 10 }, { dx: 0, dy: -100 }, 0.5, screen)).toMatchObject({
      from: { x: 24, y: 24 },
      to: { x: 24, y: 224 }
    })
    // Déjà en butée : rien.
    expect(wheelSwipe({ x: 200, y: 900 }, { dx: 0, dy: -400 }, 0.5, screen)).toBeNull()
  })

  it('ignores tiny wheel moves', () => {
    expect(wheelSwipe({ x: 200, y: 500 }, { dx: 1, dy: 1 }, 1, screen)).toBeNull()
  })
})
