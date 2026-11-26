import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join, posix, win32 } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MAX_FOLDER_INPUT } from '@shared/extra-folders'
import {
  checkExtraFolder,
  examineFolder,
  folderKeys,
  NATIVE_FOLDER_SYSTEM,
  parseFolderInput,
  pathKey,
  type FolderSystem
} from './extra-folder-check'
import { ON_WINDOWS, POSIX_MODES, tempDir } from '../test-platform'

const unix = { path: posix, home: '/Users/moi' }
const windows = { path: win32, home: 'C:\\Users\\moi' }

describe('lecture d’un chemin saisi (fiche 290)', () => {
  it('absolu : normalisé (`.`, `..`, séparateurs doublés ou finaux)', () => {
    expect(parseFolderInput('/Users/moi/Dev/lib', unix)).toEqual({
      ok: true,
      folder: '/Users/moi/Dev/lib'
    })
    expect(parseFolderInput('/Users/moi/Dev/./app/../lib//', unix)).toEqual({
      ok: true,
      folder: '/Users/moi/Dev/lib'
    })
  })

  it('espaces, retour à la ligne final et une paire de guillemets autour retirés', () => {
    for (const text of ['  /a/b  ', '/a/b\n', '"/a/b"', "'/a/b'", ' " /a/b " '])
      expect(parseFolderInput(text, unix)).toEqual({ ok: true, folder: '/a/b' })
    expect(parseFolderInput('"/a/mon dossier"', unix)).toEqual({
      ok: true,
      folder: '/a/mon dossier'
    })
    // Accepté : un espace en fin de nom est perdu.
    expect(parseFolderInput('/a/nom ', unix)).toEqual({ ok: true, folder: '/a/nom' })
  })

  it('vide, guillemets seuls, démesuré, caractère de contrôle : refusés', () => {
    for (const text of ['', '   ', '\n', '""', "''"])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'empty' })
    expect(parseFolderInput(`/${'a'.repeat(MAX_FOLDER_INPUT)}`, unix)).toEqual({
      ok: false,
      reason: 'tooLong'
    })
    expect(parseFolderInput(`/${'a'.repeat(MAX_FOLDER_INPUT - 1)}`, unix).ok).toBe(true)
    for (const text of ['/a/b\n/c/d', '/a/\u0000b', '/a/\tb', '/a/\u007fb'])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('`~` et `~/…` : le dossier personnel ; `~autre` et sans dossier personnel : refusés', () => {
    expect(parseFolderInput('~', unix)).toEqual({ ok: true, folder: '/Users/moi' })
    expect(parseFolderInput('~/Dev/lib', unix)).toEqual({ ok: true, folder: '/Users/moi/Dev/lib' })
    expect(parseFolderInput('~autre/Dev', unix)).toEqual({ ok: false, reason: 'notAbsolute' })
    expect(parseFolderInput('~/Dev', { ...unix, home: '' })).toEqual({
      ok: false,
      reason: 'notAbsolute'
    })
    expect(parseFolderInput('~\\Dev', unix)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('relatif : refusé, jamais résolu', () => {
    for (const text of ['lib', './lib', '../lib', 'Dev/lib'])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('`file://` : converti puis mêmes règles ; autre schéma ou autre ordinateur : refusés', () => {
    expect(parseFolderInput('file:///Users/moi/Mon%20projet/', unix)).toEqual({
      ok: true,
      folder: '/Users/moi/Mon projet'
    })
    expect(parseFolderInput('file://localhost/a/b', unix)).toEqual({ ok: true, folder: '/a/b' })
    expect(parseFolderInput('FILE:///a/b', unix)).toEqual({ ok: true, folder: '/a/b' })
    expect(parseFolderInput('file://serveur/a/b', unix)).toEqual({ ok: false, reason: 'notLocal' })
    expect(parseFolderInput('file:///a/%0Ab', unix)).toEqual({ ok: false, reason: 'invalid' })
    for (const text of ['http://exemple.test/a', 'https://x/y', 'smb://serveur/partage'])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'notLocal' })
  })

  it('macOS et Linux : un chemin Windows n’est pas absolu, `\\` est un caractère du nom', () => {
    expect(parseFolderInput('C:\\Users\\moi', unix)).toEqual({ ok: false, reason: 'notAbsolute' })
    expect(parseFolderInput('/a/b\\c', unix)).toEqual({ ok: true, folder: '/a/b\\c' })
  })

  it('Windows : lecteur complet, UNC, `~\\`, `file:///C:/` ; séparateurs en `\\`', () => {
    const ok = (text: string, folder: string) =>
      expect(parseFolderInput(text, windows)).toEqual({ ok: true, folder })
    ok('C:\\Users\\moi\\Dev', 'C:\\Users\\moi\\Dev')
    ok('C:/Users/moi/Dev/', 'C:\\Users\\moi\\Dev')
    ok('"D:\\Program Files\\outil"', 'D:\\Program Files\\outil')
    ok('\\\\serveur\\partage\\projet', '\\\\serveur\\partage\\projet')
    ok('~\\Dev', 'C:\\Users\\moi\\Dev')
    ok('~/Dev', 'C:\\Users\\moi\\Dev')
    ok('file:///C:/Users/moi/Mon%20projet', 'C:\\Users\\moi\\Mon projet')
    ok('file://serveur/partage/projet', '\\\\serveur\\partage\\projet')
    // `C://` est un lecteur, pas un schéma.
    ok('C://Users/moi', 'C:\\Users\\moi')
  })

  it('Windows : relatif au lecteur, racine du lecteur courant, Git Bash, UNC incomplet : refusés', () => {
    for (const text of ['C:dossier', '\\dossier', '/dossier', '/c/Users/moi', '\\\\serveur', 'lib'])
      expect(parseFolderInput(text, windows)).toEqual({ ok: false, reason: 'notAbsolute' })
  })
})

/**
 * Disque simulé : des dossiers (identité = leur rang ; `dev` 1, ou 2 pour ceux de `volume`), des
 * fichiers, des liens (chemin → cible), des alias qui ne sont pas des liens (firmlinks : même
 * identité, autre chemin, `realpath` ne les réécrit pas), des dossiers fermés ou protégés par
 * macOS, des chemins interdits (`EACCES`), un partage figé (ne répond jamais).
 */
function fakeSystem(disk: {
  dirs: string[]
  files?: string[]
  links?: Record<string, string>
  aliases?: Record<string, string>
  volume?: string[]
  closed?: string[]
  privacy?: string[]
  denied?: string[]
  frozen?: string
  calls?: string[]
}): FolderSystem {
  const error = (code: string) => Object.assign(new Error(code), { code })
  const exists = (p: string) => disk.dirs.includes(p) || !!disk.files?.includes(p)
  const original = (p: string) => disk.aliases?.[p] ?? p
  const frozen = (p: string) => !!disk.frozen && p.startsWith(disk.frozen)
  return {
    ...unix,
    timeoutMs: 50,
    realpath: async (path) => {
      disk.calls?.push(path)
      if (frozen(path)) return new Promise<string>(() => {})
      if (disk.denied?.includes(path)) throw error('EACCES')
      const target = disk.links?.[path] ?? path
      if (exists(target) || exists(original(target))) return target
      throw error('ENOENT')
    },
    stat: async (path) => {
      if (frozen(path)) return new Promise(() => {})
      const real = original(path)
      if (!exists(real)) throw error('ENOENT')
      return {
        dir: disk.dirs.includes(real),
        dev: disk.volume?.includes(real) ? '2' : '1',
        ino: String(1 + [...disk.dirs, ...(disk.files ?? [])].indexOf(real))
      }
    },
    access: async (path) =>
      disk.privacy?.includes(path) ? 'privacy' : disk.closed?.includes(path) ? 'denied' : 'ok'
  }
}

const DIRS = [
  '/',
  '/Users',
  '/Users/moi',
  '/Users/moi/Dev',
  '/Users/moi/Dev/lib',
  '/Volumes',
  '/Volumes/data',
  '/Volumes/data/lib',
  '/Users/moi/Dev/fermee',
  '/Users/moi/Documents',
  '/Users/moi/Documents/x',
  '/System',
  '/System/Volumes',
  '/System/Volumes/Data'
]

describe('vérification d’un chemin sur le disque (fiche 290)', () => {
  const sys = fakeSystem({
    dirs: DIRS,
    files: ['/Users/moi/Dev/notes.txt'],
    links: {
      '/Users/moi/Dev/raccourci': '/Volumes/data/lib',
      '/Users/moi/Dev/casse': '/nulle/part',
      '/Users/moi/tout': '/',
      '/maison': '/Users/moi'
    },
    // Firmlinks de macOS : même dossier, autre chemin, que `realpath` laisse tel quel.
    aliases: {
      '/System/Volumes/Data/Users': '/Users',
      '/System/Volumes/Data/Users/moi': '/Users/moi',
      '/System/Volumes/Data/Users/moi/Dev': '/Users/moi/Dev'
    },
    volume: ['/Volumes/data', '/Volumes/data/lib', '/System/Volumes/Data'],
    closed: ['/Users/moi/Dev/fermee'],
    privacy: ['/Users/moi/Documents/x'],
    denied: ['/Users/moi/Prive/x'],
    frozen: '/Volumes/nfs'
  })

  it('un dossier lisible : retenu ; un lien : le dossier réel', async () => {
    expect(await checkExtraFolder('~/Dev/lib', sys)).toEqual({
      ok: true,
      folder: '/Users/moi/Dev/lib'
    })
    expect(await checkExtraFolder('/Users/moi/Dev/raccourci', sys)).toEqual({
      ok: true,
      folder: '/Volumes/data/lib'
    })
  })

  it('trop large : ce qui contient le dossier personnel, par chemin, lien ou firmlink (D1, D2)', async () => {
    for (const text of [
      '/',
      '~',
      '~/',
      '~/..',
      '/Users',
      '/Users/moi/tout',
      '/maison',
      '/System/Volumes/Data/Users/moi',
      '/System/Volumes/Data/Users'
    ])
      expect(await checkExtraFolder(text, sys), text).toMatchObject({
        ok: false,
        reason: 'tooBroad'
      })
  })

  it('trop large : une racine de volume (D2) ; un parent du projet sans le dossier personnel passe', async () => {
    for (const text of ['/Volumes/data', '/System/Volumes/Data'])
      expect(await checkExtraFolder(text, sys), text).toMatchObject({ reason: 'tooBroad' })
    expect(await checkExtraFolder('~/Dev', sys)).toEqual({ ok: true, folder: '/Users/moi/Dev' })
    // Par le firmlink, un dossier qui ne contient pas le dossier personnel passe aussi.
    expect(await checkExtraFolder('/System/Volumes/Data/Users/moi/Dev', sys)).toMatchObject({
      ok: true
    })
  })

  it('identité : le même dossier par un firmlink a les mêmes clés', async () => {
    const direct = await examineFolder('/Users/moi/Dev', sys)
    const firm = await examineFolder('/System/Volumes/Data/Users/moi/Dev', sys)
    if (!direct.ok || !firm.ok) throw new Error('attendu : accepté')
    expect(firm.keys.filter((k) => k.startsWith('id:'))).toEqual(
      direct.keys.filter((k) => k.startsWith('id:'))
    )
  })

  it('absent, lien cassé, fichier, fermé, chemin interdit, protection de macOS', async () => {
    expect(await checkExtraFolder('~/Dev/absent', sys)).toEqual({
      ok: false,
      reason: 'notFound',
      folder: '/Users/moi/Dev/absent'
    })
    expect(await checkExtraFolder('/Users/moi/Dev/casse', sys)).toMatchObject({
      reason: 'notFound'
    })
    expect(await checkExtraFolder('/Users/moi/Dev/notes.txt', sys)).toEqual({
      ok: false,
      reason: 'notDirectory',
      folder: '/Users/moi/Dev/notes.txt'
    })
    expect(await checkExtraFolder('/Users/moi/Dev/fermee', sys)).toMatchObject({
      reason: 'unreadable'
    })
    expect(await checkExtraFolder('/Users/moi/Prive/x', sys)).toMatchObject({
      reason: 'unreadable'
    })
    expect(await checkExtraFolder('~/Documents/x', sys)).toEqual({
      ok: false,
      reason: 'privacy',
      folder: '/Users/moi/Documents/x'
    })
  })

  it('partage figé : `timeout` dans le délai ; tant qu’il n’a pas répondu, pas de nouvel appel (R1)', async () => {
    const calls: string[] = []
    const watched = fakeSystem({ dirs: DIRS, frozen: '/Volumes/nfs', calls })
    const started = Date.now()
    expect(await checkExtraFolder('/Volumes/nfs/projet', watched)).toEqual({
      ok: false,
      reason: 'timeout',
      folder: '/Volumes/nfs/projet'
    })
    expect(Date.now() - started).toBeLessThan(1000)
    const before = calls.length
    expect(await checkExtraFolder('/Volumes/nfs/projet/', watched)).toMatchObject({
      reason: 'timeout'
    })
    // Refusé tout de suite, sans relancer d'appel au disque sur ce chemin.
    expect(calls.length).toBe(before)
    // Clé d'un dossier figé déjà enregistré : son chemin normalisé, dans le délai.
    expect(await folderKeys('/Volumes/nfs/autre/', watched)).toEqual(['path:/Volumes/nfs/autre'])
  })

  it('un refus de lecture du texte passe avant le disque', async () => {
    expect(await checkExtraFolder('Dev/lib', sys)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('clés : identité et chemin réel ; Windows sans casse', async () => {
    expect(await folderKeys('/Users/moi/Dev/raccourci', sys)).toEqual(
      expect.arrayContaining(['path:/Volumes/data/lib', 'path:/Users/moi/Dev/raccourci'])
    )
    expect(await folderKeys('/Users/moi/Dev/x/../parti/', sys)).toEqual([
      'path:/Users/moi/Dev/parti'
    ])
    expect(pathKey('C:/Users/MOI/Dev/', windows)).toBe('path:c:\\users\\moi\\dev')
  })

  it('Windows : racine d’un lecteur ou d’un partage, dossier personnel : trop large', async () => {
    const win: FolderSystem = {
      ...windows,
      timeoutMs: 50,
      realpath: async (p) => p,
      stat: async () => ({ dir: true, dev: '1', ino: '0' }),
      access: async () => 'ok'
    }
    for (const text of ['C:\\', 'D:/', '\\\\serveur\\partage', '\\\\serveur\\partage\\', '~'])
      expect(await checkExtraFolder(text, win), text).toMatchObject({
        ok: false,
        reason: 'tooBroad'
      })
    expect(await checkExtraFolder('\\\\serveur\\partage\\projet', win)).toMatchObject({ ok: true })
  })
})

describe('sur le vrai disque (fiche 290)', () => {
  let root = ''
  beforeAll(() => {
    root = tempDir('bob-extra-folder-')
    mkdirSync(join(root, 'lib'))
    writeFileSync(join(root, 'notes.txt'), 'x')
    // `junction` : un lien de dossier que Windows crée sans droits d'administrateur ; ignoré ailleurs.
    symlinkSync(join(root, 'lib'), join(root, 'lien'), 'junction')
    symlinkSync(join(root, 'absent'), join(root, 'casse'), 'junction')
  })
  afterAll(() => {
    if (POSIX_MODES && existsSync(join(root, 'ferme'))) chmodSync(join(root, 'ferme'), 0o700)
    rmSync(root, { recursive: true, force: true })
  })
  const real = (p: string) => NATIVE_FOLDER_SYSTEM.realpath(p)

  it('dossier, lien, absent, lien cassé, fichier, racine, dossier personnel et son parent', async () => {
    const lib = await real(join(root, 'lib'))
    expect(await checkExtraFolder(join(root, 'lib'))).toEqual({ ok: true, folder: lib })
    expect(await checkExtraFolder(join(root, 'lien'))).toEqual({ ok: true, folder: lib })
    expect(await checkExtraFolder(join(root, 'absent'))).toMatchObject({ reason: 'notFound' })
    expect(await checkExtraFolder(join(root, 'casse'))).toMatchObject({ reason: 'notFound' })
    expect(await checkExtraFolder(join(root, 'notes.txt'))).toMatchObject({
      reason: 'notDirectory'
    })
    expect(await checkExtraFolder(ON_WINDOWS ? 'C:\\' : '/')).toMatchObject({ reason: 'tooBroad' })
    expect(await checkExtraFolder('~')).toMatchObject({ reason: 'tooBroad' })
    expect(await checkExtraFolder('~/..')).toMatchObject({ reason: 'tooBroad' })
    const [libId] = (await folderKeys(lib)).filter((k) => k.startsWith('id:'))
    expect(await folderKeys(join(root, 'lien'))).toContain(libId)
  })

  // Relevé du testeur (D1) : firmlinks du volume de données de macOS.
  it.skipIf(process.platform !== 'darwin')(
    'macOS : le dossier personnel et le volume de données par /System/Volumes/Data (D1)',
    async () => {
      const home = homedir()
      expect(await checkExtraFolder(`/System/Volumes/Data${home}`)).toMatchObject({
        reason: 'tooBroad'
      })
      expect(await checkExtraFolder('/System/Volumes/Data')).toMatchObject({ reason: 'tooBroad' })
      expect(await checkExtraFolder('/System/Volumes/Data/Users')).toMatchObject({
        reason: 'tooBroad'
      })
      symlinkSync(`/System/Volumes/Data${home}`, join(root, 'lien-maison'))
      expect(await checkExtraFolder(join(root, 'lien-maison'))).toMatchObject({
        reason: 'tooBroad'
      })
    }
  )

  it.skipIf(process.platform !== 'darwin')(
    'macOS : chaque volume monté dans /Volumes est une racine de volume (D2)',
    async () => {
      for (const name of readdirSync('/Volumes')) {
        const mount = join('/Volumes', name)
        if (statSync(mount).dev === statSync('/Volumes').dev) continue // lien vers le disque
        expect(await checkExtraFolder(mount), mount).toMatchObject({ reason: 'tooBroad' })
      }
    }
  )

  it('casse différente d’un dossier existant (disque insensible à la casse) : la casse réelle', async () => {
    const upper = join(root, 'LIB')
    if (!existsSync(upper)) return // disque sensible à la casse (Linux) : deux noms, deux dossiers
    expect(await checkExtraFolder(upper)).toEqual({
      ok: true,
      folder: await real(join(root, 'lib'))
    })
  })

  it.skipIf(!POSIX_MODES || process.getuid?.() === 0)(
    'dossier sans droit de lecture : illisible (droits Unix ; root lit tout)',
    async () => {
      const closed = join(root, 'ferme')
      mkdirSync(closed)
      chmodSync(closed, 0o000)
      expect(await checkExtraFolder(closed)).toMatchObject({ reason: 'unreadable' })
      expect(await checkExtraFolder(join(closed, 'dedans'))).toMatchObject({
        reason: 'unreadable'
      })
      chmodSync(closed, 0o700)
    }
  )

  it('relatif : refusé même si ce chemin existe depuis le dossier courant', async () => {
    expect(await checkExtraFolder('.')).toEqual({ ok: false, reason: 'notAbsolute' })
  })
})
