import { existsSync, mkdirSync, chmodSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, posix, win32 } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MAX_FOLDER_INPUT } from '@shared/extra-folders'
import {
  checkExtraFolder,
  NATIVE_FOLDER_SYSTEM,
  parseFolderInput,
  sameFolder,
  type FolderSystem
} from './extra-folder-check'
import { POSIX_MODES, tempDir } from '../test-platform'

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
    // Un espace dans le nom reste.
    expect(parseFolderInput('"/a/mon dossier"', unix)).toEqual({
      ok: true,
      folder: '/a/mon dossier'
    })
  })

  it('vide, guillemets seuls, démesuré, caractère de contrôle : refusés', () => {
    for (const text of ['', '   ', '\n', '""', "''"])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'empty' })
    expect(parseFolderInput(`/${'a'.repeat(MAX_FOLDER_INPUT)}`, unix)).toEqual({
      ok: false,
      reason: 'tooLong'
    })
    // Juste à la limite : accepté (la longueur se juge avant de retirer quoi que ce soit).
    expect(parseFolderInput(`/${'a'.repeat(MAX_FOLDER_INPUT - 1)}`, unix).ok).toBe(true)
    for (const text of ['/a/b\n/c/d', '/a/\u0000b', '/a/\tb', '/a/\u007fb'])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('`~` et `~/…` : le dossier personnel ; `~autre` et sans dossier personnel : refusés', () => {
    expect(parseFolderInput('~', unix)).toEqual({ ok: true, folder: '/Users/moi' })
    expect(parseFolderInput('~/', unix)).toEqual({ ok: true, folder: '/Users/moi' })
    expect(parseFolderInput('~/Dev/lib', unix)).toEqual({ ok: true, folder: '/Users/moi/Dev/lib' })
    expect(parseFolderInput('~autre/Dev', unix)).toEqual({ ok: false, reason: 'notAbsolute' })
    expect(parseFolderInput('~/Dev', { ...unix, home: '' })).toEqual({
      ok: false,
      reason: 'notAbsolute'
    })
    // Sous macOS et Linux, `~\` n'est pas le dossier personnel.
    expect(parseFolderInput('~\\Dev', unix)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('relatif : refusé, jamais résolu', () => {
    for (const text of ['lib', './lib', '../lib', 'Dev/lib'])
      expect(parseFolderInput(text, unix)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('macOS et Linux : un chemin Windows n’est pas absolu, `\\` est un caractère du nom', () => {
    expect(parseFolderInput('C:\\Users\\moi', unix)).toEqual({ ok: false, reason: 'notAbsolute' })
    expect(parseFolderInput('/a/b\\c', unix)).toEqual({ ok: true, folder: '/a/b\\c' })
  })

  it('Windows : lecteur complet (`\\` ou `/`) et UNC ; séparateurs rendus en `\\`', () => {
    expect(parseFolderInput('C:\\Users\\moi\\Dev', windows)).toEqual({
      ok: true,
      folder: 'C:\\Users\\moi\\Dev'
    })
    expect(parseFolderInput('C:/Users/moi/Dev/', windows)).toEqual({
      ok: true,
      folder: 'C:\\Users\\moi\\Dev'
    })
    // « Copier en tant que chemin d'accès » de l'Explorateur : entre guillemets.
    expect(parseFolderInput('"D:\\Program Files\\outil"', windows)).toEqual({
      ok: true,
      folder: 'D:\\Program Files\\outil'
    })
    expect(parseFolderInput('\\\\serveur\\partage\\projet', windows)).toEqual({
      ok: true,
      folder: '\\\\serveur\\partage\\projet'
    })
    expect(parseFolderInput('~\\Dev', windows)).toEqual({ ok: true, folder: 'C:\\Users\\moi\\Dev' })
    expect(parseFolderInput('~/Dev', windows)).toEqual({ ok: true, folder: 'C:\\Users\\moi\\Dev' })
  })

  it('Windows : relatif au lecteur, racine du lecteur courant, style Git Bash, UNC incomplet : refusés', () => {
    for (const text of ['C:dossier', '\\dossier', '/dossier', '/c/Users/moi', '\\\\serveur', 'lib'])
      expect(parseFolderInput(text, windows)).toEqual({ ok: false, reason: 'notAbsolute' })
  })
})

/** Disque simulé : des dossiers, des fichiers, des liens (chemin → cible), des dossiers fermés. */
function fakeSystem(disk: {
  dirs?: string[]
  files?: string[]
  links?: Record<string, string>
  closed?: string[]
  denied?: string[]
}): FolderSystem {
  const error = (code: string) => Object.assign(new Error(code), { code })
  return {
    ...unix,
    realpath: (path) => {
      if (disk.denied?.includes(path)) throw error('EACCES')
      const target = disk.links?.[path] ?? path
      if (disk.dirs?.includes(target) || disk.files?.includes(target)) return target
      throw error('ENOENT')
    },
    isDirectory: (path) => !!disk.dirs?.includes(path),
    readable: (path) => !disk.closed?.includes(path)
  }
}

describe('vérification d’un chemin sur le disque (fiche 290)', () => {
  const sys = fakeSystem({
    dirs: ['/Users/moi/Dev/lib', '/Volumes/data/lib', '/Users/moi/Dev/ferme'],
    files: ['/Users/moi/Dev/notes.txt'],
    links: {
      '/Users/moi/Dev/raccourci': '/Volumes/data/lib',
      '/Users/moi/Dev/casse': '/nulle/part'
    },
    closed: ['/Users/moi/Dev/ferme'],
    denied: ['/Users/moi/Prive/x']
  })

  it('un dossier lisible : retenu', () => {
    expect(checkExtraFolder('~/Dev/lib', sys)).toEqual({ ok: true, folder: '/Users/moi/Dev/lib' })
  })

  it('un lien vers un dossier : le dossier réel est retenu', () => {
    expect(checkExtraFolder('/Users/moi/Dev/raccourci', sys)).toEqual({
      ok: true,
      folder: '/Volumes/data/lib'
    })
  })

  it('absent, lien cassé, fichier, fermé, chemin interdit : la raison et le chemin compris', () => {
    expect(checkExtraFolder('~/Dev/absent', sys)).toEqual({
      ok: false,
      reason: 'notFound',
      folder: '/Users/moi/Dev/absent'
    })
    expect(checkExtraFolder('/Users/moi/Dev/casse', sys)).toMatchObject({ reason: 'notFound' })
    expect(checkExtraFolder('/Users/moi/Dev/notes.txt', sys)).toEqual({
      ok: false,
      reason: 'notDirectory',
      folder: '/Users/moi/Dev/notes.txt'
    })
    expect(checkExtraFolder('/Users/moi/Dev/ferme', sys)).toMatchObject({ reason: 'unreadable' })
    expect(checkExtraFolder('/Users/moi/Prive/x', sys)).toMatchObject({ reason: 'unreadable' })
  })

  it('un refus de lecture du texte passe avant le disque', () => {
    expect(checkExtraFolder('Dev/lib', sys)).toEqual({ ok: false, reason: 'notAbsolute' })
  })

  it('même dossier : par lien, par chemin non normalisé ; sans casse sous Windows', () => {
    expect(sameFolder('/Volumes/data/lib', '/Users/moi/Dev/raccourci', sys)).toBe(true)
    expect(sameFolder('/Users/moi/Dev/lib', '/Users/moi/Dev/x/../lib/', sys)).toBe(true)
    expect(sameFolder('/Users/moi/Dev/lib', '/Volumes/data/lib', sys)).toBe(false)
    // Dossier enregistré disparu depuis : comparé par son chemin normalisé.
    expect(sameFolder('/Users/moi/Dev/lib', '/Users/moi/Dev/parti', sys)).toBe(false)
    const gone = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }
    const win: FolderSystem = { ...sys, ...windows, realpath: gone }
    expect(sameFolder('C:\\Users\\moi\\Dev', 'c:/users/MOI/dev/', win)).toBe(true)
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

  it('dossier, lien, absent, lien cassé, fichier', () => {
    const lib = real(join(root, 'lib'))
    expect(checkExtraFolder(join(root, 'lib'))).toEqual({ ok: true, folder: lib })
    expect(checkExtraFolder(join(root, 'lien'))).toEqual({ ok: true, folder: lib })
    expect(checkExtraFolder(join(root, 'absent'))).toMatchObject({ ok: false, reason: 'notFound' })
    expect(checkExtraFolder(join(root, 'casse'))).toMatchObject({ ok: false, reason: 'notFound' })
    expect(checkExtraFolder(join(root, 'notes.txt'))).toMatchObject({
      ok: false,
      reason: 'notDirectory'
    })
    expect(sameFolder(lib, join(root, 'lien'))).toBe(true)
  })

  it('casse différente d’un dossier existant (disque insensible à la casse) : la casse réelle', () => {
    const upper = join(root, 'LIB')
    if (!existsSync(upper)) return // disque sensible à la casse (Linux) : deux noms, deux dossiers
    expect(checkExtraFolder(upper)).toEqual({ ok: true, folder: real(join(root, 'lib')) })
  })

  it.skipIf(!POSIX_MODES || process.getuid?.() === 0)(
    'dossier sans droit de lecture : illisible (droits Unix ; root lit tout)',
    () => {
      const closed = join(root, 'ferme')
      mkdirSync(closed)
      chmodSync(closed, 0o000)
      expect(checkExtraFolder(closed)).toMatchObject({ ok: false, reason: 'unreadable' })
      // Sous un dossier sans droit de traversée : on ne peut même pas savoir s'il existe.
      expect(checkExtraFolder(join(closed, 'dedans'))).toMatchObject({
        ok: false,
        reason: 'unreadable'
      })
      chmodSync(closed, 0o700)
    }
  )

  it('relatif : refusé même si ce chemin existe depuis le dossier courant', () => {
    expect(checkExtraFolder('.')).toEqual({ ok: false, reason: 'notAbsolute' })
    expect(checkExtraFolder('lib')).toEqual({ ok: false, reason: 'notAbsolute' })
  })
})
