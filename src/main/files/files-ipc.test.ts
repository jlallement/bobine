import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

const handlers = () =>
  filesHandlers(
    {
      workspaceOf: () => main,
      view: () => ({ summary: { additionalDirectories: [extra] } }) as never,
      profileOf: () => undefined
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
    expect(await h['files:search']('c1', 0, 'a.ts')).toEqual(['src/a.ts'])
  })

  it('refuse une racine inconnue et un chemin qui sort', async () => {
    const h = handlers()
    await expect(h['files:list']('c1', 7, '')).rejects.toThrow('root')
    await expect(h['files:read']('c1', 0, '../lib/b.ts')).rejects.toThrow()
    await expect(h['files:reveal']('c1', 0, '../../')).rejects.toThrow()
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
})
