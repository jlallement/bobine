/** Phrase rendue par `browser_resize` (fiches 129, 295) : en anglais, pour l'agent (ADR-0014). */
import { describe, expect, it } from 'vitest'
import { resizeResult } from './resize-result'

describe('résultat de `browser_resize`', () => {
  it('sans réglage de l’utilisateur : la phrase d’avant, mot pour mot', () => {
    expect(resizeResult({ width: 375, height: 812 }, { scale: 0.6 }, false)).toBe(
      'Fenêtre : 375×812 px. Shown at 60% to fit the panel; screenshots and click coordinates use these 375×812 CSS pixels. The size is reset at the end of your turn.'
    )
    expect(resizeResult({ width: 612, height: 740 }, undefined, false)).toBe(
      'Fenêtre : 612×740 px.'
    )
  })

  it('avec un réglage de l’utilisateur : il reviendra à la fin du tour (rien de plus sur lui)', () => {
    const text = resizeResult({ width: 768, height: 1024 }, { scale: 0.5 }, true)
    expect(text).toContain('Shown at 50% to fit the panel')
    expect(text).not.toContain('The size is reset')
    expect(text).toContain(
      "The user's own screen size and theme settings for this browser come back at the end of your turn."
    )
    expect(resizeResult({ width: 612, height: 740 }, undefined, true)).toBe(
      "Fenêtre : 612×740 px. The user's own screen size and theme settings for this browser come back at the end of your turn."
    )
  })
})
