import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generate } from './themes-css.mts'

describe('variables CSS des jetons de thème (fiche 134)', () => {
  it('le fichier du dépôt suit src/shared/themes.ts (sinon : pnpm themes-css)', async () => {
    const file = join(import.meta.dirname, '..', 'src', 'renderer', 'src', 'themes.generated.css')
    expect(readFileSync(file, 'utf8')).toBe(await generate())
  })
})
