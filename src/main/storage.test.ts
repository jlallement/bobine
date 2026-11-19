import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
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

describe('écriture atomique et droits du fichier (fiche 249)', () => {
  const modeOf = (file: string) => statSync(file).mode & 0o777
  it.skipIf(process.platform === 'win32')(
    'fichier remplacé : ses droits sont gardés, en synchrone comme en asynchrone',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'bob-mode-'))
      const file = join(dir, 'mcp.json')
      writeFileSync(file, '{}')
      chmodSync(file, 0o600)
      writeFileAtomic(file, '{"a":1}')
      expect(modeOf(file)).toBe(0o600)
      await writeFileAtomicAsync(file, '{"a":2}')
      expect(modeOf(file)).toBe(0o600)
      // Plus ouvert que l'umask : gardé tel quel aussi.
      chmodSync(file, 0o664)
      writeFileAtomic(file, '{"a":3}')
      expect(modeOf(file)).toBe(0o664)
    }
  )

  it.skipIf(process.platform === 'win32')(
    'nouveau fichier : `createMode` ; `mode` imposé l’emporte sur l’existant',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'bob-mode-'))
      const created = join(dir, 'neuf.json')
      writeFileAtomic(created, '{}', { createMode: 0o600 })
      expect(modeOf(created)).toBe(0o600)
      const forced = join(dir, 'cles.json')
      writeFileSync(forced, '{}')
      chmodSync(forced, 0o644)
      writeFileAtomic(forced, '{}', { mode: 0o600 })
      expect(modeOf(forced)).toBe(0o600)
    }
  )
})
