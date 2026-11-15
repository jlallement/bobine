import { describe, expect, it } from 'vitest'
import { acceleratorKeys } from './app-menu'

const FR = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj', space: 'Espace' }

describe('raccourcis du menu ☰ (fiche 145)', () => {
  it('accélérateurs d’Electron écrits comme sous Linux', () => {
    expect(acceleratorKeys('CmdOrCtrl+N', FR)).toBe('Ctrl+N')
    expect(acceleratorKeys('CmdOrCtrl+Shift+U', FR)).toBe('Ctrl+Maj+U')
    expect(acceleratorKeys('Alt+CommandOrControl+B', FR)).toBe('Ctrl+Alt+B')
    expect(acceleratorKeys('Alt+CmdOrCtrl+Up', FR)).toBe('Ctrl+Alt+↑')
    expect(acceleratorKeys('CommandOrControl+Plus', FR)).toBe('Ctrl++')
    expect(acceleratorKeys('Shift+Alt+Space', FR)).toBe('Alt+Maj+Espace')
    expect(acceleratorKeys('CmdOrCtrl+,', FR)).toBe('Ctrl+,')
    expect(acceleratorKeys('Ctrl+`', FR)).toBe('Ctrl+`')
    expect(acceleratorKeys('F11', FR)).toBe('F11')
  })
})
