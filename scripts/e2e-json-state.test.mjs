// État JSON partagé des essais e2e (fiche 293) : écriture atomique, lecture à attente bornée.
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readJson, writeJson } from '../e2e/json-state.mjs'

describe('état JSON partagé des essais e2e (fiche 293)', () => {
  it('écrit puis relit, sans laisser de fichier temporaire', () => {
    const dir = mkdtempSync(join(tmpdir(), 'json-state-'))
    const file = join(dir, 'etat.json')
    writeJson(file, { mode: 'hang' })
    writeJson(file, { mode: 'success', connected: { figma: 'ok' } })
    expect(readJson(file)).toEqual({ mode: 'success', connected: { figma: 'ok' } })
    expect(readdirSync(dir)).toEqual(['etat.json'])
  })

  it('fichier illisible : réessayé avec des pauses, puis l’erreur (jamais une boucle à vide)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'json-state-'))
    const file = join(dir, 'etat.json')
    writeFileSync(file, '{ coupé')
    const start = Date.now()
    expect(() => readJson(file)).toThrow()
    expect(Date.now() - start).toBeGreaterThanOrEqual(1000)
  })
})
