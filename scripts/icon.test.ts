import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SPOOL_LOWER, SPOOL_UPPER } from '../src/shared/spool'

describe('icône de l’app (fiche 069)', () => {
  it('la bobine de l’interface a le même dessin que build/icon.svg', () => {
    const svg = readFileSync(join(import.meta.dirname, '..', 'build', 'icon.svg'), 'utf8')
    expect(svg).toContain(SPOOL_UPPER)
    expect(svg).toContain(SPOOL_LOWER)
  })
})
