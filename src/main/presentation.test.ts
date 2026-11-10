import { describe, expect, it, vi } from 'vitest'
import { Presentation } from './presentation'

describe('mode présentation (fiche 159)', () => {
  it('inactif au lancement, prévient seulement quand l’état change', () => {
    const presentation = new Presentation()
    const changed = vi.fn()
    presentation.onChange(changed)
    expect(presentation.active).toBe(false)
    presentation.set(false)
    expect(changed).not.toHaveBeenCalled()
    presentation.toggle()
    expect(presentation.active).toBe(true)
    presentation.set(true)
    presentation.toggle()
    expect(changed.mock.calls).toEqual([[true], [false]])
  })

  it('un écouteur retiré ne reçoit plus rien', () => {
    const presentation = new Presentation()
    const changed = vi.fn()
    presentation.onChange(changed)()
    presentation.toggle()
    expect(changed).not.toHaveBeenCalled()
  })
})
