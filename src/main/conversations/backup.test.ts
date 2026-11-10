import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  BACKUP_MANIFEST,
  backupFolderName,
  backupProfile,
  checkBackup,
  settingsWithoutSecrets
} from './backup'
import { applyPendingRestore, RESTORE_JOB, requestRestore } from './restore'

/** Un petit profil : des conversations, une à la corbeille, réglages, autorisations, tâches. */
function profile(conversations: string[] = ['a', 'b']): string {
  const data = mkdtempSync(join(tmpdir(), 'bob-data-'))
  const dir = join(data, 'conversations')
  mkdirSync(join(dir, '.trash'), { recursive: true })
  writeFileSync(join(dir, 'index.json'), JSON.stringify(conversations.map((id) => ({ id }))))
  for (const id of conversations) writeFileSync(join(dir, `${id}.json`), `{"items":[],"nextId":1}`)
  writeFileSync(join(dir, 'a.json.1-2.tmp'), 'en cours')
  writeFileSync(join(dir, '.trash', 'z.json'), '{"items":[],"nextId":1}')
  writeFileSync(join(data, 'settings.json'), '{"recentWorkspaces":[],"theme":"dark"}')
  writeFileSync(join(data, 'approvals.json'), '{"sites":["exemple.fr"]}')
  writeFileSync(join(data, 'scheduled-tasks.json'), '{"version":1,"tasks":[]}')
  writeFileSync(join(data, 'api-keys.json'), '{"version":1,"keys":{"secret":"x"}}')
  mkdirSync(join(data, 'memory', 'projets'), { recursive: true })
  writeFileSync(join(data, 'memory', 'projets', 'souvenir.md'), 'Un souvenir')
  writeFileSync(join(data, 'memory.approved.json'), '{"souvenir.md":"hmac:x"}')
  writeFileSync(join(data, 'memory.key'), 'clé chiffrée par le trousseau')
  const db = new DatabaseSync(join(data, 'usage.sqlite'))
  db.exec('CREATE TABLE t (n INTEGER); INSERT INTO t VALUES (42)')
  db.close()
  return data
}
const target = () => mkdtempSync(join(tmpdir(), 'bob-backup-'))

describe('sauvegarde du profil (fiches 043, 197)', () => {
  it('copie datée de tout le profil, sans clés d’API ni fichier temporaire, avec sa description', async () => {
    const data = profile()
    const out = target()
    const now = new Date(2026, 9, 13, 9, 5)
    const folder = await backupProfile(data, out, '0.11.0', now)
    expect(folder).toBe(join(out, 'bobine-sauvegarde-2026-10-13-0905'))
    const conv = join(folder, 'conversations')
    expect(readFileSync(join(conv, 'a.json'), 'utf8')).toContain('nextId')
    expect(existsSync(join(conv, 'a.json.1-2.tmp'))).toBe(false)
    expect(existsSync(join(conv, '.trash', 'z.json'))).toBe(true)
    for (const name of ['approvals.json', 'scheduled-tasks.json']) {
      expect(readFileSync(join(folder, name), 'utf8')).toBe(readFileSync(join(data, name), 'utf8'))
    }
    expect(JSON.parse(readFileSync(join(folder, 'settings.json'), 'utf8'))).toEqual({
      recentWorkspaces: [],
      theme: 'dark'
    })
    expect(existsSync(join(folder, 'api-keys.json'))).toBe(false)
    // Mémoire (fiche 182) : souvenirs et empreintes, jamais la clé chiffrée par ce Mac.
    expect(readFileSync(join(folder, 'memory', 'projets', 'souvenir.md'), 'utf8')).toBe(
      'Un souvenir'
    )
    expect(existsSync(join(folder, 'memory.approved.json'))).toBe(true)
    expect(existsSync(join(folder, 'memory.key'))).toBe(false)
    const copy = new DatabaseSync(join(folder, 'usage.sqlite'), { readOnly: true })
    expect(copy.prepare('SELECT n FROM t').get()).toEqual({ n: 42 })
    copy.close()
    const manifest = JSON.parse(readFileSync(join(folder, BACKUP_MANIFEST), 'utf8')) as unknown
    expect(manifest).toMatchObject({ formatVersion: 1, app: '0.11.0', conversations: 2 })
    expect(readdirSync(out)).toEqual(['bobine-sauvegarde-2026-10-13-0905'])
    // Deux sauvegardes dans la même minute : la seconde ne remplace pas la première.
    expect(await backupProfile(data, out, '0.11.0', now)).toBe(`${folder}-2`)
  })

  it('sans secrets : variables d’environnement des agents déclarés, identifiants du proxy', () => {
    const text = JSON.stringify({
      customAgents: [{ id: 'x', label: 'X', command: 'x', env: { API_KEY: 'sk-secret' } }],
      network: { proxy: 'http://moi:motdepasse@proxy.local:3128', noProxy: 'localhost' }
    })
    const clean = settingsWithoutSecrets(text)
    expect(clean).not.toContain('sk-secret')
    expect(clean).not.toContain('motdepasse')
    expect(JSON.parse(clean)).toEqual({
      customAgents: [{ id: 'x', label: 'X', command: 'x' }],
      network: { proxy: 'http://proxy.local:3128/', noProxy: 'localhost' }
    })
  })

  it('disque plein en route : échec dit, rien de laissé à moitié', async () => {
    const data = profile()
    const out = target()
    const full = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
    await expect(
      backupProfile(data, out, '0.11.0', new Date(), async () => Promise.reject(full))
    ).rejects.toBe(full)
    expect(readdirSync(out)).toEqual([])
  })

  it('jamais dans le dossier de données lui-même, même par un lien', async () => {
    const data = profile()
    await expect(backupProfile(data, join(data, 'conversations'), '0.11.0')).rejects.toThrow()
    await expect(backupProfile(data, data, '0.11.0')).rejects.toThrow()
    const link = join(mkdtempSync(join(tmpdir(), 'lien-')), 'vers-donnees')
    symlinkSync(data, link)
    await expect(backupProfile(data, link, '0.11.0')).rejects.toThrow()
    await expect(backupProfile(data, join(link, 'conversations'), '0.11.0')).rejects.toThrow()
  })

  it('une sauvegarde laissée en route (« .partiel ») n’est jamais restaurable', async () => {
    const data = profile()
    const out = target()
    const crash = Object.assign(new Error('arrêt'), { code: 'EIO' })
    // Arrêt juste après la marque et l'historique : ce qui reste ressemble à une ancienne sauvegarde.
    let copies = 0
    const failing = async (from: string, to: string) => {
      if (++copies > 1) throw crash
      writeFileSync(to, readFileSync(from))
    }
    await expect(backupProfile(data, out, '0.11.0', new Date(), failing)).rejects.toBe(crash)
    // Le ménage a eu lieu ; on refait la copie à la main, telle qu'un arrêt brutal la laisserait.
    const partial = join(out, 'bobine-sauvegarde-2026-11-07-0130.partiel')
    mkdirSync(join(partial, 'conversations'), { recursive: true })
    writeFileSync(join(partial, 'conversations', 'index.json'), '[]')
    expect(checkBackup(partial, data)).toEqual({ ok: false, reason: 'notBackup' })
    // La marque copiée en premier suffit aussi à la refuser, même renommée.
    const renamed = join(out, 'coupee')
    mkdirSync(join(renamed, 'conversations'), { recursive: true })
    writeFileSync(join(renamed, 'conversations', 'index.json'), '[]')
    writeFileSync(join(renamed, 'profile.json'), '{"formatVersion":1}')
    expect(checkBackup(renamed, data)).toEqual({ ok: false, reason: 'notBackup' })
    expect(copies).toBe(2)
  })

  it('reconnaît une sauvegarde, une ancienne (sans description), refuse le reste', async () => {
    const data = profile()
    const folder = await backupProfile(profile(['x']), target(), '0.11.0')
    expect(checkBackup(folder, data)).toMatchObject({
      ok: true,
      conversations: 1,
      currentConversations: 2
    })
    // Sauvegarde d'avant la 0.11 : `conversations/index.json` et `settings.json` seulement.
    const old = target()
    mkdirSync(join(old, 'conversations'))
    writeFileSync(join(old, 'conversations', 'index.json'), '[{"id":"o"}]')
    expect(checkBackup(old, data)).toMatchObject({ ok: true, conversations: 1 })
    expect(checkBackup(target(), data)).toEqual({ ok: false, reason: 'notBackup' })
    // Un profil de la 0.11 sans description (sauvegarde coupée, ou dossier de données) : refusé.
    writeFileSync(join(old, 'profile.json'), '{"formatVersion":1}')
    expect(checkBackup(old, data)).toEqual({ ok: false, reason: 'notBackup' })
    writeFileSync(join(old, BACKUP_MANIFEST), '{"formatVersion":2}')
    expect(checkBackup(old, data)).toEqual({ ok: false, reason: 'newer' })
    writeFileSync(join(old, BACKUP_MANIFEST), '{"formatVersion":"1"}')
    expect(checkBackup(old, data)).toEqual({ ok: false, reason: 'notBackup' })
  })

  it('sauvegarde piégée par un lien symbolique : refusée (entrée, sous-arbre, dossier)', async () => {
    const data = profile()
    const outside = mkdtempSync(join(tmpdir(), 'ailleurs-'))
    const base = async () => backupProfile(profile(['x']), target(), '0.11.0')
    // `conversations` est un lien vers ailleurs.
    const a = await base()
    const real = join(a, 'conversations-vraies')
    cpDir(join(a, 'conversations'), real)
    rmDir(join(a, 'conversations'))
    symlinkSync(real, join(a, 'conversations'))
    expect(checkBackup(a, data)).toEqual({ ok: false, reason: 'notBackup' })
    // Un lien au fond de `conversations/`.
    const b = await base()
    symlinkSync(outside, join(b, 'conversations', '.trash', 'lien'))
    expect(checkBackup(b, data)).toEqual({ ok: false, reason: 'notBackup' })
    // `settings.json` est un lien ; `usage.sqlite` est un dossier.
    const c = await base()
    rmDir(join(c, 'settings.json'))
    symlinkSync('/etc/hosts', join(c, 'settings.json'))
    expect(checkBackup(c, data)).toEqual({ ok: false, reason: 'notBackup' })
    const d = await base()
    rmDir(join(d, 'usage.sqlite'))
    mkdirSync(join(d, 'usage.sqlite'))
    expect(checkBackup(d, data)).toEqual({ ok: false, reason: 'notBackup' })
    // Le dossier choisi est lui-même un lien.
    const e = await base()
    const link = join(outside, 'lien-vers-sauvegarde')
    symlinkSync(e, link)
    expect(checkBackup(link, data)).toEqual({ ok: false, reason: 'notBackup' })
    expect(checkBackup(e, data).ok).toBe(true)
  })
})

function cpDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from, { withFileTypes: true })) {
    if (name.isDirectory()) cpDir(join(from, name.name), join(to, name.name))
    else writeFileSync(join(to, name.name), readFileSync(join(from, name.name)))
  }
}

function rmDir(path: string): void {
  rmSync(path, { recursive: true, force: true })
}

describe('restauration (fiche 197)', () => {
  it('rien de demandé : rien ne bouge, les copies d’une restauration ancienne sont balayées', () => {
    const data = profile()
    mkdirSync(join(data, '.restauration-20261107-0130'))
    expect(applyPendingRestore(data, '0.11.0')).toEqual({ kind: 'none' })
    expect(existsSync(join(data, '.restauration-20261107-0130'))).toBe(false)
  })

  it('remplace le profil, garde l’état d’avant, qui se restaure à son tour (réversible)', async () => {
    const data = profile(['a', 'b'])
    const backup = await backupProfile(profile(['x']), target(), '0.11.0', new Date(2026, 9, 1, 8))
    requestRestore(data, backup)
    const done = applyPendingRestore(data, '0.11.0', new Date(2026, 10, 7, 1, 30))
    expect(done).toMatchObject({ kind: 'restored' })
    expect(existsSync(join(data, RESTORE_JOB))).toBe(false)
    expect(JSON.parse(readFileSync(join(data, 'conversations', 'index.json'), 'utf8'))).toEqual([
      { id: 'x' }
    ])
    // Les clés d'API ne sont pas dans une sauvegarde : celles du profil restent.
    expect(existsSync(join(data, 'api-keys.json'))).toBe(true)
    expect(readFileSync(join(data, 'memory.key'), 'utf8')).toBe('clé chiffrée par le trousseau')
    expect(existsSync(join(data, 'memory', 'projets', 'souvenir.md'))).toBe(true)
    const kept = done.kind === 'restored' ? done.keptIn : ''
    expect(readdirSync(join(kept, 'conversations')).sort()).toContain('b.json')
    expect(checkBackup(kept, data)).toMatchObject({ ok: true, conversations: 2 })
    requestRestore(data, kept)
    expect(applyPendingRestore(data, '0.11.0', new Date(2026, 10, 7, 1, 30)).kind).toBe('restored')
    expect(readdirSync(join(data, 'conversations')).sort()).toEqual(
      expect.arrayContaining(['a.json', 'b.json', 'index.json'])
    )
    expect(readFileSync(join(data, 'settings.json'), 'utf8')).toContain('dark')
  })

  it.each(['staging', 'moving', 'placing'] as const)(
    'arrêt brutal à l’étape « %s » : au lancement suivant, tout est remis comme avant, et dit',
    async (phase) => {
      const data = profile(['a', 'b'])
      rmDir(join(data, 'approvals.json'))
      const backup = await backupProfile(profile(['x']), target(), '0.11.0')
      requestRestore(data, backup)
      const crash = (reached: string) => {
        if (reached === phase) throw Object.assign(new Error('arrêt'), { simulatedCrash: true })
      }
      expect(() => applyPendingRestore(data, '0.11.0', new Date(), crash)).toThrow('arrêt')
      expect(applyPendingRestore(data, '0.11.0')).toEqual({ kind: 'interrupted' })
      expect(readdirSync(join(data, 'conversations')).sort()).toEqual(
        expect.arrayContaining(['a.json', 'b.json', 'index.json'])
      )
      expect(readFileSync(join(data, 'settings.json'), 'utf8')).toContain('dark')
      // Ce qui n'existait pas avant (venu de la sauvegarde) n'est pas resté.
      expect(existsSync(join(data, 'approvals.json'))).toBe(false)
      expect(existsSync(join(data, RESTORE_JOB))).toBe(false)
      expect(readdirSync(data).some((n) => n.startsWith('.restauration-'))).toBe(false)
      expect(applyPendingRestore(data, '0.11.0')).toEqual({ kind: 'none' })
    }
  )

  it.each(['moving:conversations', 'placing:conversations'])(
    'arrêt brutal au milieu (« %s ») : état d’avant remis, dossier d’avant vidé retiré',
    async (point) => {
      const data = profile(['a', 'b'])
      const backup = await backupProfile(profile(['x']), target(), '0.11.0')
      requestRestore(data, backup)
      const crash = (reached: string) => {
        if (reached === point) throw Object.assign(new Error('arrêt'), { simulatedCrash: true })
      }
      expect(() => applyPendingRestore(data, '0.11.0', new Date(), crash)).toThrow('arrêt')
      expect(applyPendingRestore(data, '0.11.0')).toEqual({ kind: 'interrupted' })
      expect(readdirSync(join(data, 'conversations')).sort()).toEqual(
        expect.arrayContaining(['a.json', 'b.json', 'index.json'])
      )
      expect(readdirSync(join(data, 'conversations'))).not.toContain('x.json')
      expect(readFileSync(join(data, 'settings.json'), 'utf8')).toContain('dark')
      const kept = existsSync(join(data, 'restaurations'))
        ? readdirSync(join(data, 'restaurations'))
        : []
      expect(kept).toEqual([])
      expect(readdirSync(data).some((n) => n.startsWith('.restauration-'))).toBe(false)
    }
  )

  it('arrêt brutal une fois tout en place : la restauration est faite au lancement suivant', async () => {
    const data = profile(['a'])
    const backup = await backupProfile(profile(['x']), target(), '0.11.0')
    requestRestore(data, backup)
    const crash = (reached: string) => {
      if (reached === 'done') throw Object.assign(new Error('arrêt'), { simulatedCrash: true })
    }
    expect(() => applyPendingRestore(data, '0.11.0', new Date(), crash)).toThrow('arrêt')
    expect(applyPendingRestore(data, '0.11.0').kind).toBe('restored')
    expect(readdirSync(join(data, 'conversations'))).toContain('x.json')
  })

  it('copie impossible (fichier illisible dans la sauvegarde) : rien n’a bougé', async () => {
    const data = profile(['a'])
    const backup = await backupProfile(profile(['x']), target(), '0.11.0')
    chmodSync(join(backup, 'settings.json'), 0o000)
    requestRestore(data, backup)
    const done = applyPendingRestore(data, '0.11.0')
    chmodSync(join(backup, 'settings.json'), 0o644)
    expect(done.kind).toBe('failed')
    expect(readFileSync(join(data, 'settings.json'), 'utf8')).toContain('dark')
    expect(readdirSync(join(data, 'conversations'))).toContain('a.json')
    expect(readdirSync(data).some((n) => n.startsWith('.restauration-'))).toBe(false)
  })

  it('sauvegarde disparue entre-temps : échec dit, profil intact, demande oubliée', () => {
    const data = profile()
    requestRestore(data, join(tmpdir(), 'nexiste-pas-bobine'))
    expect(applyPendingRestore(data, '0.11.0').kind).toBe('failed')
    expect(existsSync(join(data, RESTORE_JOB))).toBe(false)
    expect(readdirSync(join(data, 'conversations'))).toContain('a.json')
    expect(applyPendingRestore(data, '0.11.0')).toEqual({ kind: 'none' })
    expect(backupFolderName(new Date(2026, 0, 2, 3, 4))).toBe('bobine-sauvegarde-2026-01-02-0304')
  })
})
