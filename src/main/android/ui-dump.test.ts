import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatUiDump, parseUiDump } from './ui-dump'

/** Écran Réglages réel (Android 16, émulateur 1080×2400 à 420 ppp), lu par `uiautomator dump`. */
const XML = readFileSync(join(__dirname, 'fixtures/reglages.xml'), 'utf8')

describe('lecture de l’écran Android', () => {
  it('vues utiles seulement ; une ligne cliquable prend le texte de ses enfants', () => {
    const nodes = parseUiDump(XML)
    expect(nodes.length).toBe(75)
    const centers: { x: number; y: number }[] = []
    const { lines, truncated } = formatUiDump(nodes, 160 / 420, 10_000, (c) => {
      centers.push(c)
      return `ref_${centers.length}`
    })
    expect(truncated).toBe(false)
    expect(lines[0]).toBe(
      '- LinearLayout "Search Settings" id=search_action_bar (cliquable) [ref_1]'
    )
    expect(lines).toContain(
      '- LinearLayout "Network & internet — Mobile, Wi‑Fi, hotspot" (cliquable) [ref_3]'
    )
    // Les textes déjà portés par la ligne cliquable ne sont pas répétés.
    expect(lines.filter((l) => l.includes('Network & internet'))).toHaveLength(1)
    // Centre en dp : 1080 px de large à 420 ppp → 411 dp ; milieu ≈ 206.
    expect(centers[2]?.x).toBeGreaterThan(195)
    expect(centers[2]?.x).toBeLessThan(215)
  })

  it('entités XML décodées, cases à cocher, vues désactivées', () => {
    const xml = `<hierarchy><node text="Wi&#10;Fi &amp; co" class="android.widget.Switch" checkable="true" checked="true" clickable="true" enabled="false" resource-id="pkg:id/wifi" content-desc="" bounds="[0,0][100,50]" /></hierarchy>`
    const { lines } = formatUiDump(parseUiDump(xml), 1, 1000, () => 'ref_1')
    expect(lines).toEqual(['- Switch "Wi Fi & co" id=wifi (coché) (cliquable) (désactivé) [ref_1]'])
  })
})
