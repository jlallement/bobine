import { describe, expect, it } from 'vitest'
import { QuickShortcutRegistrar, type GlobalShortcuts } from './quick-entry'

function shortcuts(taken: string[] = []) {
  const registered = new Set<string>()
  const api: GlobalShortcuts = {
    register: (accelerator) => {
      if (taken.includes(accelerator)) return false
      registered.add(accelerator)
      return true
    },
    unregister: (accelerator) => {
      registered.delete(accelerator)
    }
  }
  return { api, registered }
}

describe('raccourci global de la fenêtre rapide (fiche 062)', () => {
  it('un seul raccourci à la fois, réenregistré quand le réglage change', () => {
    const { api, registered } = shortcuts()
    const registrar = new QuickShortcutRegistrar(api, () => {})
    expect(registrar.apply('alt-cmd-b')).toEqual({ shortcut: 'alt-cmd-b', refused: false })
    expect([...registered]).toEqual(['Alt+Command+B'])
    registrar.apply('alt-space')
    expect([...registered]).toEqual(['Alt+Space'])
    expect(registrar.apply('off')).toEqual({ shortcut: 'off', refused: false })
    expect([...registered]).toEqual([])
  })

  it('pris par une autre app : refusé, dit dans l’état', () => {
    const { api, registered } = shortcuts(['Alt+Space'])
    const registrar = new QuickShortcutRegistrar(api, () => {})
    expect(registrar.apply('alt-space')).toEqual({ shortcut: 'alt-space', refused: true })
    expect(registered.size).toBe(0)
    // Réessayé au prochain choix, même identique (l'autre app a pu le libérer).
    expect(registrar.apply('alt-cmd-b').refused).toBe(false)
    registrar.dispose()
    expect(registered.size).toBe(0)
  })
})
