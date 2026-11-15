import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAltAlone } from './AppMenu'

const key = (type: 'keydown' | 'keyup', key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key, ...init }))
  })

describe('Alt seul ouvre le menu ☰ (fiche 145)', () => {
  it('Alt appuyé puis relâché, sans autre touche', () => {
    const onAlt = vi.fn()
    renderHook(() => useAltAlone(onAlt))
    key('keydown', 'Alt', { altKey: true })
    key('keyup', 'Alt')
    expect(onAlt).toHaveBeenCalledTimes(1)
  })

  it('ni Alt+lettre, ni AltGr, ni Ctrl+Alt, ni après une perte du focus (Alt+Tab)', () => {
    const onAlt = vi.fn()
    renderHook(() => useAltAlone(onAlt))
    key('keydown', 'Alt', { altKey: true })
    key('keydown', 'f', { altKey: true })
    key('keyup', 'Alt')
    key('keydown', 'AltGraph')
    key('keyup', 'AltGraph')
    key('keydown', 'Alt', { altKey: true, ctrlKey: true })
    key('keyup', 'Alt')
    key('keydown', 'Alt', { altKey: true })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    key('keyup', 'Alt')
    key('keydown', 'Alt', { altKey: true, isComposing: true })
    key('keyup', 'Alt')
    expect(onAlt).not.toHaveBeenCalled()
  })
})
