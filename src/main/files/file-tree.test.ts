import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_DIR_ENTRIES, MAX_TEXT_BYTES } from '@shared/files'
import {
  fileRoots,
  gitIgnored,
  listDirectory,
  readFileForView,
  relativeInRoot,
  resolveInRoot
} from './file-tree'

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

afterEach(() => rmSync(base, { recursive: true, force: true }))

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

describe('relativeInRoot', () => {
  it('rend le chemin relatif, ou rien s’il sort', async () => {
    expect(await relativeInRoot(root, join(root, 'src', 'app.ts'))).toBe('src/app.ts')
    expect(await relativeInRoot(root, join(other, 'secret.txt'))).toBeUndefined()
  })
})
