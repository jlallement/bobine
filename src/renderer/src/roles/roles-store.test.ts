import { describe, expect, it, vi } from 'vitest'
import { invokeRole, onRoleInvoked, roleLabelFromTyped } from './roles-store'

describe('gestes des rôles (fiche 223)', () => {
  it('invokeRole : remis à la saisie abonnée ; `false` sans saisie', () => {
    expect(invokeRole('tech-lead')).toBe(false)
    const received = vi.fn()
    const stop = onRoleInvoked(received)
    expect(invokeRole('tech-lead')).toBe(true)
    expect(received).toHaveBeenCalledWith('tech-lead')
    stop()
    expect(invokeRole('tech-lead')).toBe(false)
    expect(received).toHaveBeenCalledTimes(1)
  })

  it('nom tapé après `@` → libellé de l’assistant', () => {
    expect(roleLabelFromTyped('perf-expert')).toBe('Perf expert')
    expect(roleLabelFromTyped('  dba_senior ')).toBe('Dba senior')
    expect(roleLabelFromTyped('Expert sécu')).toBe('Expert sécu')
  })
})
