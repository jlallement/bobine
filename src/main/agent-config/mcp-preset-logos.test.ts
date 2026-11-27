/**
 * Logos des préréglages (fiche 293) : fichiers officiels livrés tels quels sous
 * `renderer/src/assets/brands/`. Ici (Node) parce que l'essai lit les octets du fichier.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MCP_PRESETS, presetById } from '@shared/mcp-presets'

const ROOT = join(__dirname, '..', '..', '..')
const BRANDS = join(ROOT, 'src', 'renderer', 'src', 'assets', 'brands')

describe('logos des préréglages de serveurs MCP (fiche 293)', () => {
  it('Figma : le fichier officiel, octet pour octet (sha256 de l’archive « Download our logos »)', () => {
    const logo = presetById('figma')?.logo ?? ''
    const bytes = readFileSync(join(BRANDS, logo))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '9798b710e015c7f3fa6101779e323568d6a5a022651d427021262ce850467b07'
    )
    expect(bytes.length).toBe(646)
    // Le même que celui de la maquette validée.
    const maquette = join(ROOT, 'docs', 'maquettes', '293', 'Figma Icon (Full-color).svg')
    expect(bytes.equals(readFileSync(maquette))).toBe(true)
  })

  it('chaque préréglage : son logo existe, sa liste publique est en https', () => {
    for (const preset of MCP_PRESETS) {
      expect(readFileSync(join(BRANDS, preset.logo)).length, preset.id).toBeGreaterThan(0)
      expect(new URL(preset.listUrl).protocol, preset.id).toBe('https:')
    }
  })
})
