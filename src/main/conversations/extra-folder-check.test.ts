import { chmodSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, posix, win32 } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MAX_FOLDER_INPUT } from '@shared/extra-folders'
import {
  checkExtraFolder,
  folderKey,
  isUnder,
  NATIVE_FOLDER_SYSTEM,
  parseFolderInput,
  plainKey,
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
 * Disque simulé : des dossiers, des fichiers, des liens (chemin → cible), des dossiers fermés ou
 * protégés par macOS, des chemins interdits (`EACCES`), un partage figé (ne répond jamais).
 */
function fakeSystem(disk: {
  dirs: string[]
  files?: string[]
  links?: Record<string, string>
  closed?: string[]
  privacy?: string[]
  denied?: string[]
  frozen?: string
}): FolderSystem {
  const error = (code: string) => Object.assign(new Error(code), { code })
  return {
    ...unix,
    timeoutMs: 50,
    realpath: async (path) => {
      if (disk.frozen && path.startsWith(disk.frozen)) return new Promise<string>(() => {})
      if (disk.denied?.includes(path)) throw error('EACCES')
      const target = disk.links?.[path] ?? path
      if (disk.dirs.includes(target) || disk.files?.includes(target)) return target
      throw error('ENOENT')
    },
    isDirectory: async (path) => disk.dirs.includes(path),
    access: async (path) =>
      disk.privacy?.includes(path) ? 'privacy' : disk.closed?.includes(path) ? 'denied' : 'ok'
  }
}

describe('vérification d’un chemin sur le disque (fiche 290)', () => {
  const sys = fakeSystem({
    dirs: [
      '/',
      '/Users/moi',
      '/Users/moi/Dev',
      '/Users/moi/Dev/lib',
      '/Volumes/data/lib',
      '/Users/moi/Dev/fermee',
      '/Users/moi/Documents/x'
    ],
    files: ['/Users/moi/Dev/notes.txt'],
    links: {
      '/Users/moi/Dev/raccourci': '/Volumes/data/lib',
      '/Users/moi/Dev/casse': '/nulle/part',
      '/Users/moi/tout': '/',
      '/maison': '/Users/moi'
    },
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

  it('trop large : racine, dossier personnel (aussi par un lien) ; un parent du projet passe', async () => {
    for (const text of ['/', '~', '~/', '/Users/moi/tout', '/maison'])
      expect(await checkExtraFolder(text, sys)).toMatchObject({ ok: false, reason: 'tooBroad' })
    expect(await checkExtraFolder('~/Dev', sys)).toEqual({ ok: true, folder: '/Users/moi/Dev' })
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

  it('partage figé : refus `timeout` dans le délai, rien de bloqué', async () => {
    const started = Date.now()
    expect(await checkExtraFolder('/Volumes/nfs/projet', sys)).toEqual({
      ok: false,
      reason: 'timeout',
      folder: '/Volumes/nfs/projet'
    })
    expect(Date.now() - started).toBeLessThan(1000)
    // Clé d'un dossier figé déjà enregistré : son chemin normalisé, dans le délai.
    expect(await folderKey('/Volumes/nfs/projet/', sys)).toBe('/Volumes/nfs/projet')
  })

  it('un refus de lecture du texte passe avant le disque', async () => {
    expect(await checkExtraFolder('Dev/lib', sys)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('clés : lien suivi, chemin normalisé ; Windows sans casse ; « sous » strict', async () => {
    expect(await folderKey('/Users/moi/Dev/raccourci', sys)).toBe('/Volumes/data/lib')
    expect(await folderKey('/Users/moi/Dev/x/../parti/', sys)).toBe('/Users/moi/Dev/parti')
    expect(plainKey('C:/Users/MOI/Dev/', windows)).toBe('c:\\users\\moi\\dev')
    expect(isUnder('/a/b/c', '/a/b', posix)).toBe(true)
    expect(isUnder('/a/b', '/a/b', posix)).toBe(false)
    expect(isUnder('/a/bc', '/a/b', posix)).toBe(false)
    expect(isUnder('/a', '/a/b', posix)).toBe(false)
    expect(isUnder('c:\\projet\\src', 'c:\\projet', win32)).toBe(true)
  })

  it('Windows : racine d’un lecteur ou d’un partage, dossier personnel : trop large', async () => {
    const win: FolderSystem = {
      ...windows,
      timeoutMs: 50,
      realpath: async (p) => p,
      isDirectory: async () => true,
      access: async () => 'ok'
    }
    for (const text of ['C:\\', 'D:/', '\\\\serveur\\partage', '\\\\serveur\\partage\\', '~'])
      expect(await checkExtraFolder(text, win)).toMatchObject({ ok: false, reason: 'tooBroad' })
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

  it('dossier, lien, absent, lien cassé, fichier, racine, dossier personnel', async () => {
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
    expect(await folderKey(join(root, 'lien'))).toBe(plainKey(lib))
  })

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
