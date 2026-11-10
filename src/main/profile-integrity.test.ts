/**
 * Intégrité du profil (fiches 196, 197) : écritures sans reste, fichiers protégés, lecture seule,
 * version du format, champs inconnus gardés, avis au lancement.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ApprovalStore } from './approvals'
import { checkProfile, compareVersions, markProfile, PROFILE_FILE } from './profile-format'
import { namesOf, noteUnsavedAtQuit, openProfile, reportDamage } from './profile-startup'
import { plainError, ProfileStatusStore } from './profile-status'
import { readSettings, saveSettings } from './settings'
import {
  MAX_CORRUPT_COPIES,
  readJson,
  resetProtectedFiles,
  setReadOnlyProfile,
  sweepTempFiles,
  writeFileAtomic,
  writeFileAtomicAsync
} from './storage'

const temp = () => mkdtempSync(join(tmpdir(), 'profil-'))

afterEach(() => {
  setReadOnlyProfile(undefined)
  resetProtectedFiles()
})

describe('écritures (fiche 196)', () => {
  it('une écriture en échec ne laisse pas son fichier temporaire (synchrone et asynchrone)', async () => {
    const dir = temp()
    // Le fichier visé est un dossier : le renommage échoue après l'écriture du temporaire.
    const target = join(dir, 'cible.json')
    mkdirSync(join(target, 'dedans'), { recursive: true })
    expect(() => writeFileAtomic(target, '{}')).toThrow()
    await expect(writeFileAtomicAsync(target, '{}')).rejects.toThrow()
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('balayage au lancement : seuls les temporaires d’écriture, pas les sous-dossiers', () => {
    const dir = temp()
    for (const name of ['a.json.tmp', 'b.json.123-4.tmp', 'garde.json', 'note.tmpx']) {
      writeFileSync(join(dir, name), 'x')
    }
    mkdirSync(join(dir, 'sous'))
    writeFileSync(join(dir, 'sous', 'c.json.tmp'), 'x')
    expect(sweepTempFiles([dir, join(dir, 'absent')])).toBe(2)
    expect(readdirSync(dir).sort()).toEqual(['garde.json', 'note.tmpx', 'sous'])
    expect(existsSync(join(dir, 'sous', 'c.json.tmp'))).toBe(true)
  })

  it('fichier illisible qui ne peut pas être déplacé : jamais écrasé', () => {
    const dir = temp()
    const file = join(dir, 'reglages.json')
    writeFileSync(file, '{"precieux":true}')
    chmodSync(file, 0o000)
    chmodSync(dir, 0o500)
    const read = readJson(file)
    chmodSync(dir, 0o700)
    expect(read).toEqual({ ok: false, reason: 'corrupt' })
    expect(() => writeFileAtomic(file, '{}')).toThrow(/gardé tel quel/)
    chmodSync(file, 0o600)
    expect(readFileSync(file, 'utf8')).toBe('{"precieux":true}')
  })

  it('profil en lecture seule : rien n’est écrit ni déplacé, sauf les fichiers exemptés', async () => {
    const dir = temp()
    writeFileSync(join(dir, 'abime.json'), '{oups')
    setReadOnlyProfile(dir, ['agents.pids'])
    expect(writeFileAtomic(join(dir, 'a.json'), '{}')).toBe(false)
    expect(await writeFileAtomicAsync(join(dir, 'sous', 'b.json'), '{}')).toBe(false)
    expect(readJson(join(dir, 'abime.json'))).toEqual({ ok: false, reason: 'corrupt' })
    expect(writeFileAtomic(join(dir, 'agents.pids'), '{}')).toBe(true)
    expect(readdirSync(dir).sort()).toEqual(['abime.json', 'agents.pids'])
  })
})

describe('version du format du profil (fiche 196)', () => {
  it('sans marque : profil d’avant, format 1 ; la marque est posée', () => {
    const dir = temp()
    expect(checkProfile(dir, '0.11.0')).toEqual({ kind: 'ok' })
    markProfile(dir, '0.11.0')
    expect(JSON.parse(readFileSync(join(dir, PROFILE_FILE), 'utf8'))).toEqual({
      formatVersion: 1,
      app: '0.11.0'
    })
  })

  it('format plus récent : refusé ; même format par une version plus récente : descente dite', () => {
    const dir = temp()
    writeFileSync(join(dir, PROFILE_FILE), '{"formatVersion":2,"app":"1.4.0"}')
    expect(checkProfile(dir, '0.11.0')).toEqual({ kind: 'newer', formatVersion: 2, app: '1.4.0' })
    writeFileSync(join(dir, PROFILE_FILE), '{"formatVersion":1,"app":"0.12.3"}')
    expect(checkProfile(dir, '0.11.0')).toEqual({ kind: 'ok', writtenBy: '0.12.3' })
    expect(compareVersions('0.11.0', '0.9.1')).toBeGreaterThan(0)
  })

  it('préversions de l’app dans l’ordre semver (fiche 218)', () => {
    const ordered = [
      '0.11.2',
      '1.0.0-beta.1',
      '1.0.0-beta.2',
      '1.0.0-beta.10',
      '1.0.0-rc.1',
      '1.0.0'
    ]
    for (let i = 0; i < ordered.length - 1; i++) {
      const [older, newer] = [ordered[i] ?? '', ordered[i + 1] ?? '']
      expect(compareVersions(newer, older), `${newer} > ${older}`).toBeGreaterThan(0)
      expect(compareVersions(older, newer), `${older} < ${newer}`).toBeLessThan(0)
    }
    expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.1')).toBe(0)
    expect(compareVersions('illisible', '1.0.0')).toBe(0)
    // Profil marqué par la 1.0.0, ouvert par la bêta : la « descente » est dite.
    const dir = temp()
    writeFileSync(join(dir, PROFILE_FILE), '{"formatVersion":1,"app":"1.0.0"}')
    expect(checkProfile(dir, '1.0.0-beta.1')).toEqual({ kind: 'ok', writtenBy: '1.0.0' })
    writeFileSync(join(dir, PROFILE_FILE), '{"formatVersion":1,"app":"1.0.0-beta.1"}')
    expect(checkProfile(dir, '1.0.0-beta.2')).toEqual({ kind: 'ok' })
    expect(checkProfile(dir, '1.0.0')).toEqual({ kind: 'ok' })
  })

  it('ouverture d’un profil plus récent : lecture seule, rien n’y est écrit (pas même la marque)', () => {
    const dir = temp()
    const mark = '{"formatVersion":9,"app":"3.0.0"}'
    writeFileSync(join(dir, PROFILE_FILE), mark)
    writeFileSync(join(dir, 'settings.json.tmp'), 'reste')
    const status = new ProfileStatusStore()
    openProfile(dir, '0.11.0', status)
    expect(status.status().readOnly).toBe(true)
    expect(readFileSync(join(dir, PROFILE_FILE), 'utf8')).toBe(mark)
    expect(existsSync(join(dir, 'settings.json.tmp'))).toBe(true)
    saveSettings(join(dir, 'settings.json'), { recentWorkspaces: ['/x'] })
    expect(existsSync(join(dir, 'settings.json'))).toBe(false)
  })
})

describe('champs inconnus gardés (fiche 196)', () => {
  it('réglages : aller-retour sans perte des champs d’une version plus récente', () => {
    const file = join(temp(), 'settings.json')
    const future = {
      recentWorkspaces: ['/p'],
      theme: 'dark',
      nouveauReglage: { a: [1, 2] },
      autre: 'texte'
    }
    writeFileSync(file, JSON.stringify(future))
    const { settings, damaged } = readSettings(file)
    expect(damaged).toBeUndefined()
    saveSettings(file, { ...settings, theme: 'light' })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ...future, theme: 'light' })
  })

  it('réglages du mauvais type ou illisibles : mis de côté et signalés', () => {
    for (const text of ['[1,2,3]', '{tronqu', '"texte"']) {
      const dir = temp()
      const file = join(dir, 'settings.json')
      writeFileSync(file, text)
      const { settings, damaged } = readSettings(file)
      expect(settings).toEqual({ recentWorkspaces: [] })
      expect(damaged).toMatch(/settings\.json\.corrupt-/)
      expect(readFileSync(damaged ?? '', 'utf8')).toBe(text)
    }
  })

  it('autorisations : champs inconnus gardés ; abîmées : mises de côté et signalées', () => {
    const dir = temp()
    const file = join(dir, 'approvals.json')
    writeFileSync(file, JSON.stringify({ sites: ['a.fr'], futur: { x: 1 } }))
    const store = new ApprovalStore(file)
    expect(store.damaged).toBeUndefined()
    store.sites.add('b.fr')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      sites: ['a.fr', 'b.fr'],
      futur: { x: 1 }
    })
    writeFileSync(file, '[1,2,3]')
    const damaged = new ApprovalStore(file)
    expect(damaged.damaged).toMatch(/approvals\.json\.corrupt-/)
    expect(damaged.view().sites).toEqual([])
  })
})

describe('avis du lancement (fiches 196, 197)', () => {
  it('chaque cas a sa gravité, sans chemin dans le texte ; fermés un par un', () => {
    const status = new ProfileStatusStore()
    reportDamage(status, {
      settings: '/d/settings.json.corrupt-x',
      approvals: '/d/approvals.json.corrupt-x',
      history: ['/d/conversations/index.json.corrupt-x'],
      recovered: { count: 3, rebuilt: true }
    })
    const { notices } = status.status()
    expect(notices.map((n) => [n.level, n.message.key, n.reveal ?? false])).toEqual([
      ['warning', 'profile.notice.settingsDamaged', true],
      ['warning', 'profile.notice.approvalsDamaged', true],
      ['warning', 'profile.notice.historyDamaged', true],
      ['info', 'profile.notice.indexRebuilt', false]
    ])
    expect(JSON.stringify(notices)).not.toContain('/d/')
    expect(status.pathOf(notices[0]?.id ?? '')).toBe('/d/settings.json.corrupt-x')
    // Laissé en place (lecture impossible, trop de copies) : un autre avis, qui ne dit pas « mis
    // de côté ».
    const kept = new ProfileStatusStore()
    reportDamage(kept, { settings: '/d/settings.json', history: [] })
    expect(kept.status().notices.map((n) => n.message.key)).toEqual(['profile.notice.unreadable'])
    status.dismiss(notices[0]?.id ?? '')
    expect(status.status().notices).toHaveLength(3)
  })

  it('messages non enregistrés au dernier arrêt : dits une fois au lancement suivant', () => {
    const dir = temp()
    noteUnsavedAtQuit(dir, ['Plan', 'Écran'], Object.assign(new Error('x'), { code: 'ENOSPC' }))
    const status = new ProfileStatusStore()
    openProfile(dir, '0.11.0', status)
    expect(status.status().notices).toEqual([
      expect.objectContaining({
        level: 'error',
        message: {
          key: 'profile.notice.unsavedAtQuit',
          params: {
            count: 2,
            names: { key: 'profile.names.two', params: { a: 'Plan', b: 'Écran' } },
            reason: { key: 'profile.error.diskFull' }
          }
        }
      })
    ])
    const again = new ProfileStatusStore()
    openProfile(dir, '0.11.0', again)
    expect(again.status().notices).toEqual([])
    expect(namesOf(['a', 'b', 'c', 'd'])).toEqual({
      key: 'profile.names.count',
      params: { count: 4 }
    })
    expect(plainError(Object.assign(new Error(), { code: 'EACCES' }))).toEqual({
      key: 'profile.error.noPermission'
    })
  })
})

describe('relecture du lot G (fiches 196, 197)', () => {
  it('lecture impossible (droits) : pas mis de côté, mais protégé ; JSON invalide : mis de côté', () => {
    const dir = temp()
    const file = join(dir, 'a.json')
    writeFileSync(file, '{"garde":1}')
    chmodSync(file, 0o000)
    expect(readJson(file)).toEqual({ ok: false, reason: 'corrupt' })
    chmodSync(file, 0o600)
    expect(readdirSync(dir)).toEqual(['a.json'])
    expect(() => writeFileAtomic(file, '{}')).toThrow(/gardé tel quel/)
  })

  it('mise de côté : jamais par-dessus une copie, rien supprimé ; au-delà de 10, protégé en place', () => {
    const dir = temp()
    const file = join(dir, 'b.json')
    const now = new Date('2026-11-07T01:00:00.000Z')
    for (let i = 0; i < MAX_CORRUPT_COPIES; i++) {
      writeFileSync(file, `{abîmé ${i}`)
      expect(readJson(file, now)).toMatchObject({ ok: false, movedTo: expect.any(String) })
    }
    const copies = () => readdirSync(dir).filter((n) => n.startsWith('b.json.corrupt-'))
    expect(copies()).toHaveLength(MAX_CORRUPT_COPIES)
    // La onzième : plus de copie, le fichier abîmé reste en place, protégé, et rien n'est effacé.
    writeFileSync(file, '{abîmé encore')
    expect(readJson(file, now)).toEqual({ ok: false, reason: 'corrupt' })
    expect(readFileSync(file, 'utf8')).toBe('{abîmé encore')
    expect(copies()).toHaveLength(MAX_CORRUPT_COPIES)
    expect(copies().map((n) => readFileSync(join(dir, n), 'utf8'))).toContain('{abîmé 0')
    expect(() => writeFileAtomic(file, '{}')).toThrow(/gardé tel quel/)
  })

  it('marque de version illisible : lecture seule, jamais réécrite', () => {
    for (const text of ['{tronq', '[]', '{"formatVersion":"2"}', '{"formatVersion":1.5}']) {
      const dir = temp()
      writeFileSync(join(dir, PROFILE_FILE), text)
      expect(checkProfile(dir, '0.11.0')).toEqual({ kind: 'unreadable' })
      const status = new ProfileStatusStore()
      openProfile(dir, '0.11.0', status)
      expect(status.status()).toMatchObject({ readOnly: true, readOnlyReason: 'unreadable' })
      expect(readFileSync(join(dir, PROFILE_FILE), 'utf8')).toBe(text)
      setReadOnlyProfile(undefined)
    }
  })

  it('note des conversations non enregistrées : écriture atomique', () => {
    const dir = temp()
    noteUnsavedAtQuit(dir, ['Plan'], new Error('x'))
    expect(readdirSync(dir)).toEqual(['non-enregistre-au-dernier-arret.json'])
  })
})
