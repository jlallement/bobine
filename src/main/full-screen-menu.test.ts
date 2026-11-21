import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { on: vi.fn() }, BrowserWindow: { getAllWindows: () => [] } }))

const { hideSystemFullScreenItem } = await import('./full-screen-menu')

describe('« Enter Full Screen » de macOS retiré (fiche 272, recette)', () => {
  it('macOS : la préférence de l’app le retire ; Linux et Windows : rien ne change', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      const setUserDefault = vi.fn()
      hideSystemFullScreenItem(platform, { setUserDefault })
      expect([platform, setUserDefault.mock.calls]).toEqual([
        platform,
        platform === 'darwin' ? [['NSFullScreenMenuItemEverywhere', 'boolean', false]] : []
      ])
    }
  })
})
