import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generate, literalType } from './i18n-types.mts'

describe('types littéraux des traductions (fiche 074)', () => {
  it('garde les textes mot pour mot', () => {
    expect(literalType({ a: { b: 'Prêt « ici »' }, 'needs-action': '{{count}} "x"' })).toBe(
      '{ readonly "a": { readonly "b": "Prêt « ici »" }; readonly "needs-action": "{{count}} \\"x\\"" }'
    )
  })

  it('refuse ce qui n’est ni un texte ni un groupe', () => {
    expect(() => literalType({ a: 1 })).toThrow(/fr\.json/)
    expect(() => literalType({ a: ['x'] })).toThrow(/fr\.json/)
  })

  it('le fichier du dépôt suit fr.json (sinon : pnpm i18n-types)', async () => {
    const file = join(import.meta.dirname, '..', 'src', 'shared', 'i18n', 'fr.generated.d.ts')
    expect(readFileSync(file, 'utf8')).toBe(await generate())
  })
})
