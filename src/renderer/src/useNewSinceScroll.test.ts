import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useNewSinceScroll } from './useNewSinceScroll'

describe('« ↓ N nouveaux » (fiche 185, P8)', () => {
  it('compte ce qui arrive une fois le fil remonté, zéro en bas ou dans une autre conversation', () => {
    const { result, rerender } = renderHook(
      ({ atBottom, count, id }) => useNewSinceScroll(atBottom, count, id),
      { initialProps: { atBottom: true, count: 5, id: 'a' } }
    )
    expect(result.current).toBe(0)
    rerender({ atBottom: false, count: 5, id: 'a' })
    expect(result.current).toBe(0)
    rerender({ atBottom: false, count: 8, id: 'a' })
    expect(result.current).toBe(3)
    rerender({ atBottom: false, count: 8, id: 'b' })
    expect(result.current).toBe(0)
    rerender({ atBottom: true, count: 9, id: 'b' })
    expect(result.current).toBe(0)
  })
})
