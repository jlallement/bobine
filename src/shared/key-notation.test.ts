import { afterEach, describe, expect, it } from 'vitest'
import { QUICK_SHORTCUTS } from './quick-entry'
import { displayKeys, formatKeys, setKeyNotation, SHORTCUTS } from './shortcuts'

const FR = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj' }

describe('notation des raccourcis (fiche 145)', () => {
  afterEach(() => setKeyNotation(true))

  it('macOS : tels quels', () => {
    expect(formatKeys('⇧⌘U, ⌥⌘↑ et ⌃`', null)).toBe('⇧⌘U, ⌥⌘↑ et ⌃`')
  })

  it('ailleurs : Ctrl, Alt, Maj dans cet ordre, ⌘ et ⌃ donnent Ctrl', () => {
    expect(formatKeys('⌘1', FR)).toBe('Ctrl+1')
    expect(formatKeys('⇧⌘U', FR)).toBe('Ctrl+Maj+U')
    expect(formatKeys('⌥⌘↑', FR)).toBe('Ctrl+Alt+↑')
    expect(formatKeys('⌃`', FR)).toBe('Ctrl+`')
    expect(formatKeys('Réglages (⌘,)', FR)).toBe('Réglages (Ctrl+,)')
    expect(formatKeys('⌘ Entrée : étape suivante', FR)).toBe('Ctrl+Entrée : étape suivante')
    expect(formatKeys('⌥-clic : montrer', FR)).toBe('Alt-clic : montrer')
    expect(formatKeys('⇧⌥Espace', FR)).toBe('Alt+Maj+Espace')
    expect(formatKeys('| ⌘K | Rechercher |', FR)).toBe('| Ctrl+K | Rechercher |')
    expect(formatKeys('Sans raccourci', FR)).toBe('Sans raccourci')
  })

  it('les listes suivent la notation réglée ; les accélérateurs restent CmdOrCtrl', () => {
    const activity = () => SHORTCUTS.find((s) => s.command === 'activity')
    expect(activity()?.keys).toBe('⇧⌘U')
    setKeyNotation(false)
    expect(activity()?.keys).toBe('Ctrl+Maj+U')
    expect(QUICK_SHORTCUTS['alt-cmd-b'].keys).toBe('Ctrl+Alt+B')
    expect(displayKeys('Aide : ⌘?')).toBe('Aide : Ctrl+?')
    expect(activity()?.accelerator).toBe('CmdOrCtrl+Shift+U')
    expect(QUICK_SHORTCUTS['alt-cmd-b'].accelerator).toBe('Alt+CommandOrControl+B')
    for (const s of SHORTCUTS) expect(s.accelerator).not.toMatch(/(^|\+)(Cmd|Command)\+/)
  })
})
