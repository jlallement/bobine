import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IMPORT_MARKER, lockOwner, migrateUserData } from './user-data-migration'

/** Dossier « Application Support » jetable, avec l'ancien dossier de données. */
function appData(withOld = true) {
  const root = mkdtempSync(join(tmpdir(), 'migration-'))
  const from = join(root, 'bob-desktop')
  const to = join(root, 'bobine')
  if (withOld) {
    mkdirSync(join(from, 'conversations'), { recursive: true })
    writeFileSync(join(from, 'settings.json'), '{"theme":"dark"}')
  }
  return { from, to }
}

describe('dossier de données de l’ancien nom (fiche 069)', () => {
  it('renommé, avec un lien à l’ancienne place', () => {
    const { from, to } = appData()
    expect(migrateUserData(from, to, () => false)).toEqual({ kind: 'moved' })
    expect(readFileSync(join(to, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
    expect(lstatSync(from).isSymbolicLink()).toBe(true)
    expect(readlinkSync(from)).toBe('bobine')
    // L'ancien chemin mène au nouveau dossier.
    expect(readFileSync(join(from, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
    // Déjà fait : rien de plus.
    expect(migrateUserData(from, to, () => false)).toEqual({ kind: 'none' })
  })

  it('rien à faire sans ancien dossier', () => {
    const fresh = appData(false)
    expect(migrateUserData(fresh.from, fresh.to)).toEqual({ kind: 'none' })
    expect(existsSync(fresh.to)).toBe(false)
  })

  it('nouveau dossier vide (créé par Electron avant le code de l’app) : renommé quand même', () => {
    const { from, to } = appData()
    mkdirSync(to)
    expect(migrateUserData(from, to, () => false)).toEqual({ kind: 'moved' })
    expect(readFileSync(join(to, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}')
    expect(lstatSync(from).isSymbolicLink()).toBe(true)
  })

  it('les deux dossiers ont des données : conversations manquantes copiées une fois, rien écrasé', () => {
    const { from, to } = appData()
    const record = (id: string, title: string) => ({
      id,
      title,
      titleSource: 'message',
      profileId: 'bob',
      workspace: '/tmp',
      createdAt: '2026-10-12T10:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z'
    })
    writeFileSync(
      join(from, 'conversations', 'index.json'),
      JSON.stringify([
        record('ancienne', 'Ancienne'),
        record('commune', 'Version ancienne'),
        record('vide', 'Sans fil')
      ])
    )
    writeFileSync(join(from, 'conversations', 'ancienne.json'), '{"items":[],"nextId":1}')
    writeFileSync(join(from, 'conversations', 'commune.json'), '{"items":[],"nextId":99}')
    mkdirSync(join(to, 'conversations'), { recursive: true })
    writeFileSync(join(to, 'settings.json'), '{"theme":"light"}')
    writeFileSync(
      join(to, 'conversations', 'index.json'),
      JSON.stringify([record('commune', 'Version nouvelle')])
    )
    writeFileSync(join(to, 'conversations', 'commune.json'), '{"items":[],"nextId":2}')

    expect(migrateUserData(from, to, () => false)).toEqual({ kind: 'imported', conversations: 2 })
    const index = JSON.parse(readFileSync(join(to, 'conversations', 'index.json'), 'utf8')) as {
      id: string
      title: string
    }[]
    expect(index.map((r) => `${r.id}:${r.title}`)).toEqual([
      'commune:Version nouvelle',
      'ancienne:Ancienne',
      'vide:Sans fil'
    ])
    expect(readFileSync(join(to, 'conversations', 'ancienne.json'), 'utf8')).toContain('"nextId":1')
    // Le fil du nouveau dossier et ses réglages ne sont pas touchés ; l'ancien dossier reste entier.
    expect(readFileSync(join(to, 'conversations', 'commune.json'), 'utf8')).toContain('"nextId":2')
    expect(readFileSync(join(to, 'settings.json'), 'utf8')).toBe('{"theme":"light"}')
    expect(lstatSync(from).isDirectory()).toBe(true)
    expect(existsSync(join(from, 'conversations', 'ancienne.json'))).toBe(true)
    expect(existsSync(join(to, IMPORT_MARKER))).toBe(true)

    // Une seule fois : une conversation importée puis supprimée ne revient pas.
    writeFileSync(
      join(to, 'conversations', 'index.json'),
      JSON.stringify([record('commune', 'Version nouvelle')])
    )
    expect(migrateUserData(from, to, () => false)).toEqual({ kind: 'none' })
    expect(readFileSync(join(to, 'conversations', 'index.json'), 'utf8')).not.toContain('ancienne')
  })

  it('les deux dossiers ont des données, ancienne app ouverte : on attend', () => {
    const { from, to } = appData()
    mkdirSync(to)
    writeFileSync(join(to, 'settings.json'), '{}')
    symlinkSync('mac.local-4242', join(from, 'SingletonLock'))
    expect(migrateUserData(from, to, (pid) => pid === 4242)).toEqual({ kind: 'busy' })
    expect(existsSync(join(to, IMPORT_MARKER))).toBe(false)
  })

  it('ancienne app ouverte (verrou de Chromium, processus vivant) : on n’y touche pas', () => {
    const { from, to } = appData()
    symlinkSync('mac.local-4242', join(from, 'SingletonLock'))
    expect(lockOwner(from)).toBe(4242)
    expect(migrateUserData(from, to, (pid) => pid === 4242)).toEqual({ kind: 'busy' })
    expect(existsSync(to)).toBe(false)
    // Verrou périmé (l'app s'est arrêtée sans le retirer) : déplacé.
    expect(migrateUserData(from, to, () => false)).toEqual({ kind: 'moved' })
  })

  it('verrou illisible ou absent : pas de propriétaire', () => {
    const { from } = appData()
    expect(lockOwner(from)).toBeUndefined()
    symlinkSync('sans-pid', join(from, 'SingletonLock'))
    expect(lockOwner(from)).toBeUndefined()
  })
})
