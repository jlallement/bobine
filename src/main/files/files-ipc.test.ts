import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIFOS } from '../test-platform'
import { filesHandlers } from './files-ipc'
import { openFileLink } from './file-links'

let base: string
let main: string
let extra: string
const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  base = realpathSync(mkdtempSync(join(tmpdir(), 'files-ipc-')))
  main = join(base, 'app')
  extra = join(base, 'lib')
  mkdirSync(join(main, 'src'), { recursive: true })
  mkdirSync(extra)
  writeFileSync(join(main, 'src', 'a.ts'), 'export {}\n')
  writeFileSync(join(main, 'outil.command'), 'echo non\n')
  writeFileSync(join(extra, 'b.ts'), 'export const b = 1\n')
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

const handlers = (exclusions?: { files: string[]; always?: string[] }) =>
  filesHandlers(
    {
      workspaceOf: () => main,
      view: () => ({ summary: { additionalDirectories: [extra] } }) as never,
      profileOf: () =>
        (exclusions
          ? {
              exclusions: { summary: () => '', files: exclusions.files, always: exclusions.always }
            }
          : undefined) as never
    },
    {
      openPath: async (path) => {
        calls.push(`open ${path}`)
        return ''
      },
      reveal: (path) => calls.push(`reveal ${path}`)
    }
  )

describe('canaux de la vue des fichiers (fiche 271)', () => {
  it('racines : le dossier puis les autres dossiers', async () => {
    const roots = await handlers()['files:roots']('c1')
    expect(roots.map((r) => r.name)).toEqual(['app', 'lib'])
  })

  it('liste, lit et cherche dans une racine', async () => {
    const h = handlers()
    expect((await h['files:list']('c1', 0, 'src')).entries.map((e) => e.path)).toEqual(['src/a.ts'])
    expect(await h['files:read']('c1', 1, 'b.ts')).toMatchObject({
      kind: 'text',
      text: 'export const b = 1\n'
    })
    expect(await h['files:search']('c1', 0, 'a.ts')).toEqual([{ path: 'src/a.ts' }])
  })

  it('refuse une racine inconnue et un chemin qui sort', async () => {
    const h = handlers()
    await expect(h['files:list']('c1', 7, '')).rejects.toThrow('root')
    await expect(h['files:read']('c1', 0, '../lib/b.ts')).rejects.toThrow()
    await expect(h['files:reveal']('c1', 0, '../../')).rejects.toThrow()
  })

  it('relecture : rien n’est relu si le fichier n’a pas changé (C4)', async () => {
    const h = handlers()
    const first = await h['files:read']('c1', 0, 'src/a.ts')
    if (first.kind !== 'text') throw new Error('texte attendu')
    const known = { modified: first.modified, size: first.size }
    expect(await h['files:read']('c1', 0, 'src/a.ts', known)).toEqual({
      kind: 'unchanged',
      ...known
    })
    writeFileSync(join(main, 'src', 'a.ts'), 'export const changed = 1\n')
    expect(await h['files:read']('c1', 0, 'src/a.ts', known)).toMatchObject({ kind: 'text' })
    await expect(h['files:read']('c1', 0, 'src/a.ts', { modified: 'x' } as never)).rejects.toThrow()
  })

  it('filtre : les fichiers exclus pour l’agent sont marqués, comme dans l’arbre (M6)', async () => {
    writeFileSync(join(main, 'src', 'secret.key'), 'factice')
    const h = handlers({ files: [], always: ['*.key'] })
    expect(await h['files:search']('c1', 0, 'src')).toEqual(
      expect.arrayContaining([{ path: 'src/a.ts' }, { path: 'src/secret.key', excluded: true }])
    )
  })

  it.skipIf(!FIFOS)('app par défaut : jamais un FIFO (B1)', async () => {
    execFileSync('mkfifo', [join(main, 'tuyau')])
    await expect(handlers()['files:open']('c1', 0, 'tuyau')).rejects.toThrow()
    expect(calls).toEqual([])
  })

  it('Finder et app par défaut : jamais un exécutable', async () => {
    const h = handlers()
    await h['files:reveal']('c1', 0, 'src/a.ts')
    expect(await h['files:open']('c1', 0, 'outil.command')).toMatchObject({
      kind: 'revealed',
      reason: 'executable'
    })
    expect(calls).toEqual([
      `reveal ${join(main, 'src', 'a.ts')}`,
      `reveal ${join(main, 'outil.command')}`
    ])
  })
})

describe('lien de fichier du fil vers l’onglet Fichiers (Q11)', () => {
  const openers = {
    openPath: async () => '',
    reveal: () => undefined,
    showFile: true
  }
  it('texte et script : dans l’onglet, à la ligne ; PDF : app par défaut', async () => {
    expect(await openFileLink(main, 'src/a.ts:3', {}, openers)).toMatchObject({
      kind: 'file',
      relative: 'src/a.ts',
      line: 3
    })
    expect(await openFileLink(main, 'outil.command', {}, openers)).toMatchObject({
      kind: 'file',
      relative: 'outil.command'
    })
    writeFileSync(join(main, 'doc.pdf'), '%PDF')
    expect(await openFileLink(main, 'doc.pdf', {}, openers)).toMatchObject({ kind: 'opened' })
  })

  it('un fichier d’un autre dossier de la conversation : dans l’onglet, sa racine (M10)', async () => {
    expect(
      await openFileLink(main, join(extra, 'b.ts:2'), { roots: [extra] }, openers)
    ).toMatchObject({ kind: 'file', root: 1, relative: 'b.ts', line: 2 })
    expect(await openFileLink(main, 'src/a.ts', { roots: [extra] }, openers)).toMatchObject({
      kind: 'file',
      root: 0,
      relative: 'src/a.ts'
    })
  })

  it('lien d’un Markdown d’une autre racine : résolu dans sa racine (C6)', async () => {
    expect(
      await openFileLink(main, 'b.ts', { base: extra, roots: [extra] }, openers)
    ).toMatchObject({ kind: 'file', root: 1, relative: 'b.ts' })
    // Une base hors de toutes les racines ne compte pas : le dossier de la conversation.
    expect(
      await openFileLink(main, 'src/a.ts', { base: base, roots: [extra] }, openers)
    ).toMatchObject({ kind: 'file', root: 0, relative: 'src/a.ts' })
  })

  it('lien par un dossier intermédiaire qui est un lien symbolique (M11)', async () => {
    const dehors = join(base, 'dehors')
    mkdirSync(dehors)
    writeFileSync(join(dehors, 'cle.txt'), 'factice')
    symlinkSync(dehors, join(main, 'vers-dehors'))
    symlinkSync(extra, join(main, 'vers-lib'))
    expect(
      await openFileLink(main, 'vers-dehors/cle.txt', { roots: [extra] }, openers)
    ).toMatchObject({ kind: 'revealed', reason: 'outside' })
    expect(await openFileLink(main, 'vers-lib/b.ts', { roots: [extra] }, openers)).toMatchObject({
      kind: 'file',
      root: 1,
      relative: 'b.ts'
    })
  })
})
