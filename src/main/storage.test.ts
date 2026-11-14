import { mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readJson, writeFileAtomic, writeFileAtomicAsync } from './storage'

describe('écritures atomiques', () => {
  it('synchrone : fichier remplacé, copie de la version précédente, pas de temporaire', () => {
    const dir = mkdtempSync(join(tmpdir(), 'storage-'))
    const file = join(dir, 'a.json')
    writeFileAtomic(file, '{"v":1}')
    writeFileAtomic(file, '{"v":2}', { backup: true })
    expect(readFileSync(file, 'utf8')).toBe('{"v":2}')
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{"v":1}')
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('asynchrone (fiche 043) : abandon propre si dépassée, chevauchements sans collision', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'storage-'))
    const file = join(dir, 'a.json')
    writeFileSync(file, '{"v":0}')
    const stale = writeFileAtomicAsync(file, '{"v":1}', { commit: () => false })
    const fresh = writeFileAtomicAsync(file, '{"v":2}', { backup: true })
    expect(await stale).toBe(false)
    expect(await fresh).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('{"v":2}')
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{"v":0}')
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
    expect(readJson(file)).toEqual({ ok: true, value: { v: 2 } })
  })
})

describe('écriture atomique et liens symboliques (relecture fiche 223)', () => {
  it('un temporaire préexistant qui est un lien n’écrit jamais dans sa cible', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'atomique-lien-'))
    const victim = join(dir, 'victime.txt')
    writeFileSync(victim, 'intact')
    const file = join(dir, 'role.md')
    symlinkSync(victim, `${file}.tmp`)
    symlinkSync(victim, `${file}.bak.tmp`)
    writeFileSync(file, 'ancien')
    expect(writeFileAtomic(file, 'nouveau', { backup: true })).toBe(true)
    expect(readFileSync(victim, 'utf8')).toBe('intact')
    expect(readFileSync(file, 'utf8')).toBe('nouveau')
    expect(await writeFileAtomicAsync(file, 'encore', { backup: true })).toBe(true)
    expect(readFileSync(victim, 'utf8')).toBe('intact')
  })
})
