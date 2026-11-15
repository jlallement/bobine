import { describe, expect, it } from 'vitest'
import { platformFeatures } from './platform'
import { windowChrome } from './window-chrome'

describe('cadre des fenêtres (fiche 145)', () => {
  it('macOS : sans barre de titre, feux sur le contenu, comme avant', () => {
    expect(windowChrome(platformFeatures('darwin'), 'hiddenInset', { x: 18, y: 19 })).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 19 }
    })
  })

  it('Linux : décorations du système (la barre de menu, jamais montrée : app-menu.ts)', () => {
    expect(windowChrome(platformFeatures('linux'), 'hidden', { x: 14, y: 14 })).toEqual({})
  })
})
