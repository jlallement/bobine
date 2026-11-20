import { execFileSync } from 'node:child_process'
import {
  constants,
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_DIR_ENTRIES, MAX_TEXT_BYTES } from '@shared/files'
import { FIFOS, PRECOMPOSED_NAMES } from '../test-platform'
import { fileRoots, gitIgnored, listDirectory, readFileForView, resolveInRoot } from './file-tree'

/** Appels au disque comptés, et un crochet juste avant `open` (course contrôle / ouverture). */
const disk = vi.hoisted(() => ({
  lstat: 0,
  realpath: 0,
  /** Chemins passés à `stat`. */
  stats: [] as string[],
  beforeOpen: undefined as ((path: string) => void) | undefined
}))
vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...fs,
    lstat: ((...args: Parameters<typeof fs.lstat>) => {
      disk.lstat++
      return fs.lstat(...args)
    }) as typeof fs.lstat,
    realpath: ((...args: Parameters<typeof fs.realpath>) => {
      disk.realpath++
      return fs.realpath(...args)
    }) as typeof fs.realpath,
    stat: ((...args: Parameters<typeof fs.stat>) => {
      disk.stats.push(String(args[0]))
      return fs.stat(...args)
    }) as typeof fs.stat,
    open: (async (...args: Parameters<typeof fs.open>) => {
      disk.beforeOpen?.(String(args[0]))
      return fs.open(...args)
    }) as typeof fs.open
  }
})

let base: string
let root: string
let other: string

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'files-'))
  root = join(base, 'projet')
  other = join(base, 'ailleurs')
  mkdirSync(join(root, 'src', 'components'), { recursive: true })
  mkdirSync(join(root, 'build'), { recursive: true })
  mkdirSync(other)
  writeFileSync(join(root, 'src', 'app.ts'), 'const a = 1\n')
  writeFileSync(join(root, 'src', 'file10.ts'), '')
  writeFileSync(join(root, 'src', 'file2.ts'), '')
  writeFileSync(join(root, 'build', 'out.js'), 'x')
  writeFileSync(join(root, '.env'), 'TOKEN=factice-test\n')
  writeFileSync(join(root, 'README.md'), '# Titre\n')
  writeFileSync(join(root, '.gitignore'), 'build/\n')
  writeFileSync(join(other, 'secret.txt'), 'dehors')
})

afterEach(() => {
  disk.beforeOpen = undefined
  rmSync(base, { recursive: true, force: true })
})

/** Un FIFO dans la racine (B1), et de quoi débloquer un lecteur resté en attente. */
function makeFifo(name: string): { path: string; release: () => void } {
  const path = join(root, name)
  execFileSync('mkfifo', [path])
  return {
    path,
    release: () => {
      // Un écrivain non bloquant débloque un lecteur en attente ; sans lecteur : ENXIO, rien à faire.
      try {
        closeSync(openSync(path, constants.O_WRONLY | constants.O_NONBLOCK))
      } catch {
        // aucun lecteur
      }
    }
  }
}

/** Échoue au lieu d'attendre sans fin. */
function within<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('bloqué')), ms))
  ])
}

describe('fileRoots', () => {
  it('donne le dossier puis les autres dossiers, par rang', () => {
    expect(fileRoots('/p/app', ['/p/lib'])).toEqual([
      { index: 0, name: 'app', path: '/p/app' },
      { index: 1, name: 'lib', path: '/p/lib' }
    ])
  })
})

describe('resolveInRoot', () => {
  it('refuse `..`, un chemin absolu et un octet nul', async () => {
    await expect(resolveInRoot(root, '../ailleurs/secret.txt')).rejects.toThrow()
    await expect(resolveInRoot(root, join(other, 'secret.txt'))).rejects.toThrow()
    await expect(resolveInRoot(root, 'src/\0app.ts')).rejects.toThrow()
  })

  it('refuse un lien qui sort, accepte un lien vers une autre racine', async () => {
    symlinkSync(join(other, 'secret.txt'), join(root, 'lien.txt'))
    await expect(resolveInRoot(root, 'lien.txt')).rejects.toThrow()
    await expect(resolveInRoot(root, 'lien.txt', [root, other])).resolves.toContain('secret.txt')
  })
})

describe('listDirectory', () => {
  it('trie dossiers d’abord, noms à point en tête, ordre naturel', async () => {
    const top = await listDirectory({ root, dir: '', roots: [root] })
    expect(top.entries.map((e) => e.name)).toEqual([
      'build',
      'src',
      '.env',
      '.gitignore',
      'README.md'
    ])
    const src = await listDirectory({ root, dir: 'src', roots: [root] })
    expect(src.entries.map((e) => e.path)).toEqual([
      'src/components',
      'src/app.ts',
      'src/file2.ts',
      'src/file10.ts'
    ])
    expect(src.entries.find((e) => e.name === 'app.ts')?.size).toBe(12)
  })

  it('marque un fichier qui s’exécuterait si on l’ouvrait', async () => {
    writeFileSync(join(root, 'outil.command'), 'echo non\n')
    const top = await listDirectory({ root, dir: '', roots: [root] })
    expect(top.entries.find((e) => e.name === 'outil.command')?.executable).toBe(true)
    expect(top.entries.find((e) => e.name === 'README.md')?.executable).toBeUndefined()
    expect(await readFileForView(root, 'outil.command')).toMatchObject({ executable: true })
  })

  it('ne liste jamais .git ni .DS_Store', async () => {
    mkdirSync(join(root, '.git'))
    writeFileSync(join(root, '.DS_Store'), '')
    const top = await listDirectory({ root, dir: '', roots: [root] })
    expect(top.entries.map((e) => e.name)).not.toContain('.git')
    expect(top.entries.map((e) => e.name)).not.toContain('.DS_Store')
  })

  it('borne le nombre d’entrées et dit combien restent', async () => {
    const many = join(root, 'many')
    mkdirSync(many)
    for (let i = 0; i < MAX_DIR_ENTRIES + 5; i++) writeFileSync(join(many, `f${i}`), '')
    const listing = await listDirectory({ root, dir: 'many', roots: [root] })
    expect(listing.entries).toHaveLength(MAX_DIR_ENTRIES)
    expect(listing.more).toBe(5)
  })

  it('marque les ignorés par git, et tout un dossier ignoré', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root })
    const top = await listDirectory({ root, dir: '', roots: [root], ignored: gitIgnored })
    expect(top.entries.find((e) => e.name === 'build')?.ignored).toBe(true)
    expect(top.entries.find((e) => e.name === 'src')?.ignored).toBeUndefined()
    const build = await listDirectory({ root, dir: 'build', roots: [root], ignored: gitIgnored })
    expect(build.entries[0]?.ignored).toBe(true)
  })

  it('hors dépôt git : rien n’est marqué ignoré', async () => {
    const top = await listDirectory({ root, dir: '', roots: [root], ignored: gitIgnored })
    expect(top.entries.some((e) => e.ignored)).toBe(false)
  })

  it('marque les exclus pour l’agent', async () => {
    const top = await listDirectory({
      root,
      dir: '',
      roots: [root],
      isExcluded: async (path) => path.endsWith('.env')
    })
    expect(top.entries.find((e) => e.name === '.env')?.excluded).toBe(true)
    expect(top.entries.find((e) => e.name === 'src')?.excluded).toBeUndefined()
  })

  it('marque un lien qui sort, sans le suivre', async () => {
    symlinkSync(other, join(root, 'dehors'))
    const top = await listDirectory({ root, dir: '', roots: [root] })
    expect(top.entries.find((e) => e.name === 'dehors')).toMatchObject({
      kind: 'file',
      link: 'outside'
    })
    await expect(listDirectory({ root, dir: 'dehors', roots: [root] })).rejects.toThrow()
  })

  it('refuse un dossier hors de la racine', async () => {
    await expect(listDirectory({ root, dir: '..', roots: [root] })).rejects.toThrow()
  })

  it.skipIf(!FIFOS)('marque un FIFO comme spécial, sans l’ouvrir (B1)', async () => {
    const fifo = makeFifo('tuyau')
    try {
      const top = await within(listDirectory({ root, dir: '', roots: [root] }))
      expect(top.entries.find((e) => e.name === 'tuyau')).toMatchObject({
        kind: 'file',
        special: true
      })
      expect(top.entries.find((e) => e.name === 'tuyau')?.executable).toBeUndefined()
    } finally {
      fifo.release()
    }
  })

  it('borne avant d’interroger le disque : pas un `lstat` par entrée au-delà (C4)', async () => {
    const many = join(root, 'many')
    mkdirSync(many)
    for (let i = 0; i < MAX_DIR_ENTRIES + 500; i++) writeFileSync(join(many, `f${i}`), 'x')
    disk.lstat = 0
    const listing = await listDirectory({ root, dir: 'many', roots: [root] })
    expect(listing.more).toBe(500)
    expect(listing.entries[0]?.size).toBe(1)
    expect(disk.lstat).toBeLessThanOrEqual(MAX_DIR_ENTRIES)
  })

  it('un lien vers un dossier n’efface pas les marques « ignoré » (M4)', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root })
    symlinkSync(join(root, 'src'), join(root, 'raccourci'))
    const top = await listDirectory({ root, dir: '', roots: [root], ignored: gitIgnored })
    expect(top.entries.find((e) => e.name === 'build')?.ignored).toBe(true)
    expect(top.entries.find((e) => e.name === 'raccourci')).toMatchObject({ kind: 'dir' })
  })

  it.skipIf(!PRECOMPOSED_NAMES)(
    'un nom décomposé (NFD) est marqué comme git le dit (M4)',
    async () => {
      execFileSync('git', ['init', '-q'], { cwd: root })
      writeFileSync(join(root, '.gitignore'), 'build/\ncafé.log\n')
      writeFileSync(join(root, 'café.log'.normalize('NFD')), 'x')
      const top = await listDirectory({ root, dir: '', roots: [root], ignored: gitIgnored })
      const name = (n: string) => n.normalize('NFC') === 'café.log'
      expect(top.entries.find((e) => name(e.name))?.ignored).toBe(true)
    }
  )
})

describe('liens et dépôts (seconde revue)', () => {
  it('liens : résolus après la borne ; la cible d’un lien qui sort n’est jamais interrogée', async () => {
    const many = join(root, 'liens')
    mkdirSync(many)
    for (let i = 0; i < MAX_DIR_ENTRIES + 300; i++) {
      symlinkSync(join(root, 'README.md'), join(many, `l${String(i).padStart(4, '0')}`))
    }
    symlinkSync(join(other, 'secret.txt'), join(many, 'a-dehors'))
    disk.realpath = 0
    disk.stats = []
    const listing = await listDirectory({ root, dir: 'liens', roots: [root] })
    expect(listing.more).toBe(301)
    expect(disk.realpath).toBeLessThanOrEqual(MAX_DIR_ENTRIES + 20)
    expect(disk.stats.some((p) => p.endsWith('secret.txt'))).toBe(false)
    expect(listing.entries.find((e) => e.name === 'a-dehors')).toMatchObject({ link: 'outside' })
  })

  it('dossier atteint par un lien : git interrogé depuis le chemin réel, peu d’appels (C1)', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root })
    mkdirSync(join(root, 'vrai'))
    for (let i = 0; i < 60; i++) writeFileSync(join(root, 'vrai', `f${i}.log`), '')
    writeFileSync(join(root, 'vrai', 'garde.ts'), '')
    writeFileSync(join(root, '.gitignore'), 'build/\n*.log\n')
    symlinkSync(join(root, 'vrai'), join(root, 'raccourci'))
    let calls = 0
    const counted: typeof gitIgnored = (r, paths) => {
      calls++
      return gitIgnored(r, paths)
    }
    const listing = await listDirectory({ root, dir: 'raccourci', roots: [root], ignored: counted })
    expect(calls).toBe(1)
    expect(listing.entries.find((e) => e.name === 'f1.log')?.ignored).toBe(true)
    expect(listing.entries.find((e) => e.name === 'garde.ts')?.ignored).toBeUndefined()
  })

  it.skipIf(!PRECOMPOSED_NAMES)('nom décomposé (NFD) : chemin rendu en NFC (C8)', async () => {
    writeFileSync(join(root, 'Café.md'.normalize('NFD')), '# x\n')
    const top = await listDirectory({ root, dir: '', roots: [root] })
    const entry = top.entries.find((e) => e.name.normalize('NFC') === 'Café.md')
    expect(entry?.path).toBe('Café.md'.normalize('NFC'))
    expect(entry?.name).toBe('Café.md'.normalize('NFC'))
  })
})

describe('gitIgnored', () => {
  it('lot refusé : bissection bornée, jamais des centaines d’appels (C1)', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root })
    symlinkSync(join(root, 'src'), join(root, 'raccourci'))
    const paths = Array.from({ length: 200 }, (_, i) => `raccourci/f${i}`)
    const started = Date.now()
    const found = await gitIgnored(root, [...paths, 'build/'])
    expect(found && [...found]).not.toContain('raccourci/f1')
    expect(Date.now() - started).toBeLessThan(1500)
  })

  it('un chemin au-delà d’un lien n’efface pas les autres marques (M4)', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root })
    symlinkSync(join(root, 'src'), join(root, 'raccourci'))
    const found = await gitIgnored(root, ['raccourci/app.ts', 'build/', 'src/'])
    expect(found && [...found]).toEqual(['build'])
  })

  it('hors dépôt : `null`', async () => {
    expect(await gitIgnored(root, ['build/'])).toBeNull()
  })
})

describe('readFileForView', () => {
  it('lit un texte, un secret compris (Q8)', async () => {
    expect(await readFileForView(root, 'src/app.ts')).toMatchObject({
      kind: 'text',
      text: 'const a = 1\n',
      truncated: false,
      size: 12
    })
    expect(await readFileForView(root, '.env')).toMatchObject({
      kind: 'text',
      text: 'TOKEN=factice-test\n'
    })
  })

  it('coupe un gros texte et le dit', async () => {
    writeFileSync(join(root, 'gros.log'), 'a'.repeat(MAX_TEXT_BYTES + 10))
    const content = await readFileForView(root, 'gros.log')
    expect(content).toMatchObject({ kind: 'text', truncated: true, size: MAX_TEXT_BYTES + 10 })
    expect(content.kind === 'text' && content.text.length).toBe(MAX_TEXT_BYTES)
  })

  it('reconnaît un binaire, une image, un SVG', async () => {
    writeFileSync(join(root, 'bin.dat'), Buffer.from([1, 2, 0, 3]))
    writeFileSync(join(root, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]))
    writeFileSync(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    expect(await readFileForView(root, 'bin.dat')).toMatchObject({ kind: 'binary', size: 4 })
    const image = await readFileForView(root, 'img.png')
    expect(image.kind === 'image' && image.url.startsWith('data:image/png;base64,')).toBe(true)
    const svg = await readFileForView(root, 'icon.svg')
    expect(svg).toMatchObject({ kind: 'image', text: '<svg xmlns="http://www.w3.org/2000/svg"/>' })
  })

  it('reconnaît l’UTF-16 BE, l’UTF-16 sans BOM, et lit le Latin-1 (M5)', async () => {
    const be = Buffer.from('\ufeffbonjour', 'utf16le').swap16()
    writeFileSync(join(root, 'be.txt'), be)
    writeFileSync(join(root, 'le.txt'), Buffer.from('const é = 1\n', 'utf16le'))
    writeFileSync(join(root, 'nobom-be.txt'), Buffer.from('salut\n', 'utf16le').swap16())
    writeFileSync(join(root, 'latin.txt'), Buffer.from('café crème\n', 'latin1'))
    expect(await readFileForView(root, 'be.txt')).toMatchObject({ kind: 'text', text: 'bonjour' })
    expect(await readFileForView(root, 'le.txt')).toMatchObject({
      kind: 'text',
      text: 'const é = 1\n'
    })
    expect(await readFileForView(root, 'nobom-be.txt')).toMatchObject({
      kind: 'text',
      text: 'salut\n'
    })
    expect(await readFileForView(root, 'latin.txt')).toMatchObject({
      kind: 'text',
      text: 'café crème\n'
    })
  })

  it.skipIf(!FIFOS)('refuse un FIFO sans attendre un écrivain (B1)', async () => {
    const fifo = makeFifo('tuyau')
    try {
      await expect(within(readFileForView(root, 'tuyau'))).rejects.toThrow(/tuyau/)
    } finally {
      fifo.release()
    }
  })

  it('refuse un dossier intermédiaire remplacé par un lien entre contrôle et ouverture (M1)', async () => {
    writeFileSync(join(other, 'app.ts'), 'dehors\n')
    disk.beforeOpen = (path) => {
      if (!path.endsWith(join('src', 'app.ts'))) return
      disk.beforeOpen = undefined
      renameSync(join(root, 'src'), join(root, 'src-avant'))
      symlinkSync(other, join(root, 'src'))
    }
    await expect(readFileForView(root, 'src/app.ts')).rejects.toThrow(
      /Hors des dossiers de la conversation/
    )
  })

  it('lit l’UTF-16 et retire le BOM UTF-8', async () => {
    writeFileSync(join(root, 'u16.txt'), Buffer.from('﻿bonjour', 'utf16le'))
    writeFileSync(join(root, 'bom.txt'), '﻿salut')
    expect(await readFileForView(root, 'u16.txt')).toMatchObject({ kind: 'text', text: 'bonjour' })
    expect(await readFileForView(root, 'bom.txt')).toMatchObject({ kind: 'text', text: 'salut' })
  })

  it('refuse un dossier, un chemin qui sort', async () => {
    await expect(readFileForView(root, 'src')).rejects.toThrow()
    await expect(readFileForView(root, '../ailleurs/secret.txt')).rejects.toThrow()
  })

  it('refuse un lien vers un fichier hors des racines', async () => {
    symlinkSync(join(other, 'secret.txt'), join(root, 'lien.txt'))
    await expect(readFileForView(root, 'lien.txt')).rejects.toThrow()
  })
})
