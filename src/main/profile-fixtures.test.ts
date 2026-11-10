/**
 * Profils réels des versions 0.7, 0.8 et 0.9 (fiche 196) : fabriqués avec les versions taguées
 * (`v0.7.0`, `v0.8.0`, `v0.9.1`), leur propre lanceur d'essais et l'agent factice — trois
 * conversations dont une épinglée et renommée, un réglage changé, la consommation. Ils doivent
 * s'ouvrir sans rien perdre, se réécrire sans rien perdre, et se reconstruire sans leur index.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversationStore } from './conversations/store'
import { checkBackup } from './conversations/backup'
import { PROFILE_FILE } from './profile-format'
import { openProfile } from './profile-startup'
import { ProfileStatusStore } from './profile-status'
import { readSettings, saveSettings } from './settings'
import { resetProtectedFiles, setReadOnlyProfile } from './storage'
import { openUsageDb } from './usage/usage-db'

const FIXTURES = join(__dirname, '..', '..', 'e2e', 'fixtures', 'profils')

function copy(version: string): string {
  const dir = mkdtempSync(join(tmpdir(), `profil-${version}-`))
  cpSync(join(FIXTURES, version), dir, { recursive: true })
  return dir
}

afterEach(() => {
  setReadOnlyProfile(undefined)
  resetProtectedFiles()
})

describe.each(['0.7', '0.8', '0.9'])('profil réel %s (fiche 196)', (version) => {
  it('s’ouvre sans avis ni perte, reçoit sa marque de version', () => {
    const data = copy(version)
    const status = new ProfileStatusStore()
    openProfile(data, '0.11.0', status)
    expect(status.status()).toEqual({ readOnly: false, notices: [] })
    expect(JSON.parse(readFileSync(join(data, PROFILE_FILE), 'utf8'))).toEqual({
      formatVersion: 1,
      app: '0.11.0'
    })
    const store = new ConversationStore(join(data, 'conversations'))
    const records = store.loadIndex()
    expect(store.damaged).toEqual([])
    expect(records.map((r) => r.title)).toEqual([
      'Épinglée et renommée',
      '/scenario diff',
      expect.stringMatching(/^Troisième conversation 0\.\d\.\d avec \*\*markdown\*\* et accents/)
    ])
    expect(records[0]?.pinned).toBe(true)
    for (const record of records) {
      expect(store.loadTranscript(record.id)?.items.length).toBeGreaterThan(1)
    }
    const { settings, damaged } = readSettings(join(data, 'settings.json'))
    expect(damaged).toBeUndefined()
    expect(settings).toMatchObject({ theme: 'dark', density: 'compact' })
    rmSync(data, { recursive: true, force: true })
  })

  it('se réécrit sans rien perdre (réglages, index, fils)', () => {
    const data = copy(version)
    const settingsFile = join(data, 'settings.json')
    const before = JSON.parse(readFileSync(settingsFile, 'utf8')) as unknown
    saveSettings(settingsFile, readSettings(settingsFile).settings)
    expect(JSON.parse(readFileSync(settingsFile, 'utf8'))).toEqual(before)

    const dir = join(data, 'conversations')
    const indexBefore = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as unknown
    const store = new ConversationStore(dir)
    const records = store.loadIndex()
    store.attachRecords((id) => records.find((r) => r.id === id))
    store.saveIndex(records)
    expect(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))).toEqual(indexBefore)
    for (const record of records) {
      const transcript = store.loadTranscript(record.id)
      if (!transcript) throw new Error(`fil illisible : ${record.id}`)
      store.saveTranscript(record.id, transcript)
      expect(new ConversationStore(dir).loadTranscript(record.id)).toEqual(transcript)
    }
    rmSync(data, { recursive: true, force: true })
  })

  it('index et copie perdus : les trois conversations reviennent de leurs fils (fiche 197)', () => {
    const data = copy(version)
    const dir = join(data, 'conversations')
    rmSync(join(dir, 'index.json'))
    rmSync(join(dir, 'index.json.bak'))
    const store = new ConversationStore(dir)
    const records = store.loadIndex()
    expect(store.recovered).toEqual({ count: 3, rebuilt: true })
    expect(records.map((r) => r.title).sort()).toEqual(
      [
        `Première conversation ${version === '0.9' ? '0.9.1' : `${version}.0`}`,
        '/scenario diff',
        `Troisième conversation ${version === '0.9' ? '0.9.1' : `${version}.0`} avec **markdown** et accents éàü`
      ].sort()
    )
    rmSync(data, { recursive: true, force: true })
  })

  it('consommation lisible, et le profil se restaure comme une sauvegarde d’avant la 0.11', () => {
    const data = copy(version)
    const db = openUsageDb(join(data, 'usage.sqlite'))
    expect(db.select().length).toBeGreaterThan(0)
    db.close()
    expect(checkBackup(data, mkdtempSync(join(tmpdir(), 'vide-')))).toMatchObject({
      ok: true,
      conversations: 3
    })
    rmSync(data, { recursive: true, force: true })
  })
})
