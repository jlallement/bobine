import { afterEach, describe, expect, it, vi } from 'vitest'
import { invokeRole, onRoleInvoked, resetRolesUi, roleLabelFromTyped } from './roles-store'

afterEach(() => {
  resetRolesUi()
  vi.useRealTimers()
})

describe('gestes des rôles (fiche 223)', () => {
  it('invokeRole : remis à la saisie abonnée', () => {
    const received = vi.fn()
    const stop = onRoleInvoked(received)
    expect(invokeRole('tech-lead')).toBe(true)
    expect(received).toHaveBeenCalledWith('tech-lead')
    stop()
  })

  it('sans saisie à l’écran : `false`, et remis à la prochaine saisie qui s’abonne, une fois', () => {
    expect(invokeRole('tech-lead')).toBe(false)
    const received = vi.fn()
    const stop = onRoleInvoked(received)
    expect(received).toHaveBeenCalledWith('tech-lead')
    stop()
    const again = vi.fn()
    onRoleInvoked(again)()
    expect(again).not.toHaveBeenCalled()
  })

  it('sans saisie pendant plus de 10 s : oublié', () => {
    vi.useFakeTimers()
    expect(invokeRole('tech-lead')).toBe(false)
    vi.advanceTimersByTime(10_001)
    const received = vi.fn()
    onRoleInvoked(received)()
    expect(received).not.toHaveBeenCalled()
  })

  it('nom tapé après `@` → libellé de l’assistant', () => {
    expect(roleLabelFromTyped('perf-expert')).toBe('Perf expert')
    expect(roleLabelFromTyped('  dba_senior ')).toBe('Dba senior')
    expect(roleLabelFromTyped('Expert sécu')).toBe('Expert sécu')
  })
})
