import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openFileLink, openWorkspaceFile, readMarkdown, type FileOpeners } from './file-links'

function setup() {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'liens-')))
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'dehors-')))
  mkdirSync(join(workspace, 'docs'))
  writeFileSync(join(workspace, 'plan.md'), '# Plan\n\n- [suite](docs/suite.md)\n')
  writeFileSync(join(workspace, 'docs', 'suite.md'), '# Suite\n')
  writeFileSync(join(workspace, 'app.ts'), 'export {}\n')
  writeFileSync(join(workspace, 'outil.command'), 'echo non\n')
  writeFileSync(join(workspace, 'script'), '#!/bin/sh\necho non\n')
  chmodSync(join(workspace, 'script'), 0o755)
  writeFileSync(join(outside, 'secret.txt'), 'dehors\n')
  symlinkSync(join(outside, 'secret.txt'), join(workspace, 'raccourci.txt'))
  const calls: string[] = []
  const openers: FileOpeners = {
    openPath: async (path) => {
      calls.push(`open ${path}`)
      return ''
    },
    reveal: (path) => calls.push(`reveal ${path}`)
  }
  const click = (href: string, options: { base?: string; reveal?: boolean } = {}) =>
    openFileLink(workspace, href, options, openers)
  return { workspace, outside, calls, click }
}

describe('openFileLink (fiche 052)', () => {
  it('.md du dossier : aperçu, avec son dossier comme base de ses liens', async () => {
    const { workspace, calls, click } = setup()
    const outcome = await click('plan.md')
    expect(outcome).toMatchObject({
      kind: 'preview',
      document: { relative: 'plan.md', dir: workspace, text: expect.stringContaining('# Plan') }
    })
    // Lien relatif au document affiché (docs/), et ligne citée ignorée pour l'aperçu.
    const nested = await click('suite.md:3', { base: join(workspace, 'docs') })
    expect(nested).toMatchObject({ kind: 'preview', document: { relative: 'docs/suite.md' } })
    expect(calls).toEqual([])
  })

  it('autre fichier du dossier : app par défaut ; dossier, ⌥-clic : Finder', async () => {
    const { workspace, calls, click } = setup()
    expect(await click('app.ts#L12')).toEqual({ kind: 'opened', path: join(workspace, 'app.ts') })
    expect(await click('docs')).toMatchObject({ kind: 'revealed', reason: 'folder' })
    expect(
      await click(`file://${encodeURI(join(workspace, 'plan.md'))}`, { reveal: true })
    ).toMatchObject({ kind: 'revealed', reason: 'requested' })
    expect(calls).toEqual([
      `open ${join(workspace, 'app.ts')}`,
      `reveal ${join(workspace, 'docs')}`,
      `reveal ${join(workspace, 'plan.md')}`
    ])
  })

  it('jamais rien d’exécuté : exécutable, hors du dossier, lien symbolique vers dehors → Finder', async () => {
    const { workspace, outside, calls, click } = setup()
    expect(await click('outil.command')).toMatchObject({ kind: 'revealed', reason: 'executable' })
    expect(await click('script')).toMatchObject({ kind: 'revealed', reason: 'executable' })
    expect(await click(join(outside, 'secret.txt'))).toMatchObject({
      kind: 'revealed',
      reason: 'outside'
    })
    expect(await click('../' + outside.split('/').at(-1) + '/secret.txt')).toMatchObject({
      reason: 'outside'
    })
    expect(await click('raccourci.txt')).toMatchObject({ kind: 'revealed', reason: 'outside' })
    expect(calls.every((c) => c.startsWith('reveal '))).toBe(true)
    // Base hors du dossier : ignorée, on repart du dossier de la conversation.
    expect(await click('plan.md', { base: outside })).toMatchObject({ kind: 'preview' })
    expect(await click('absent.md')).toEqual({
      kind: 'missing',
      path: join(workspace, 'absent.md')
    })
    await expect(click('https://example.com')).rejects.toThrow('invalide')
  })

  it('aperçu : seulement des .md du dossier, début seul s’il est très long', async () => {
    const { workspace, outside } = setup()
    writeFileSync(join(workspace, 'long.md'), 'x'.repeat(1_200_000))
    const long = await readMarkdown(workspace, 'long.md')
    expect(long.truncated).toBe(true)
    expect(long.text).toHaveLength(1_000_000)
    await expect(readMarkdown(workspace, 'app.ts')).rejects.toThrow('Markdown')
    writeFileSync(join(outside, 'note.md'), '# dehors')
    await expect(readMarkdown(workspace, join(outside, 'note.md'))).rejects.toThrow('Hors')
  })
})

describe('openFileLink — pages HTML (fiche 064)', () => {
  it('page HTML du dossier : aperçu servi depuis son dossier ; sans aperçu : app par défaut', async () => {
    const { workspace, calls } = setup()
    mkdirSync(join(workspace, 'site'))
    writeFileSync(join(workspace, 'site', 'index.html'), '<h1>Site</h1>')
    const served: string[] = []
    const openers: FileOpeners = {
      openPath: async (path) => {
        calls.push(`open ${path}`)
        return ''
      },
      reveal: (path) => calls.push(`reveal ${path}`),
      previewHtml: async (dir, file) => {
        served.push(`${dir} ${file}`)
        return 'http://127.0.0.1:1/jeton/1/index.html'
      }
    }
    expect(await openFileLink(workspace, 'site/index.html', {}, openers)).toEqual({
      kind: 'browser',
      path: join(workspace, 'site', 'index.html'),
      url: 'http://127.0.0.1:1/jeton/1/index.html'
    })
    expect(served).toEqual([`${join(workspace, 'site')} ${join(workspace, 'site', 'index.html')}`])
    expect(calls).toEqual([])
    // ⌥-clic : toujours le Finder.
    expect((await openFileLink(workspace, 'site/index.html', { reveal: true }, openers)).kind).toBe(
      'revealed'
    )
    const { previewHtml: _unused, ...plain } = openers
    expect((await openFileLink(workspace, 'site/index.html', {}, plain)).kind).toBe('opened')
  })
})

describe('openWorkspaceFile — « Ouvrir » de l’onglet Modifications (fiche 071)', () => {
  it('fichier ordinaire : app par défaut ; chemin absolu ou relatif', async () => {
    const { workspace, calls } = setup()
    const open = (path: string) => openWorkspaceFile(workspace, path, openersOf(calls))
    expect(await open('app.ts')).toEqual({ kind: 'opened', path: join(workspace, 'app.ts') })
    expect(await open(join(workspace, 'plan.md'))).toEqual({
      kind: 'opened',
      path: join(workspace, 'plan.md')
    })
    expect(calls).toEqual([
      `open ${join(workspace, 'app.ts')}`,
      `open ${join(workspace, 'plan.md')}`
    ])
  })

  it('jamais rien d’exécuté : .command, .terminal sans bit x, script exécutable → Finder', async () => {
    const { workspace, calls } = setup()
    writeFileSync(join(workspace, 'reglages.terminal'), '<plist/>')
    const open = (path: string) => openWorkspaceFile(workspace, path, openersOf(calls))
    for (const file of ['outil.command', 'reglages.terminal', 'script']) {
      expect(await open(file)).toEqual({
        kind: 'revealed',
        path: join(workspace, file),
        reason: 'executable'
      })
    }
    expect(calls.every((c) => c.startsWith('reveal '))).toBe(true)
  })

  it('lien symbolique vers dehors → Finder ; chemin qui sort du dossier → refusé ; absent', async () => {
    const { workspace, calls } = setup()
    const open = (path: string) => openWorkspaceFile(workspace, path, openersOf(calls))
    expect(await open('raccourci.txt')).toMatchObject({ kind: 'revealed', reason: 'outside' })
    expect(await open('docs')).toMatchObject({ kind: 'revealed', reason: 'folder' })
    await expect(open('../../etc/passwd')).rejects.toThrow('hors du dossier')
    await expect(open('/etc/hosts')).rejects.toThrow('hors du dossier')
    expect(await open('absent.txt')).toEqual({
      kind: 'missing',
      path: join(workspace, 'absent.txt')
    })
    expect(calls.some((c) => c.startsWith('open '))).toBe(false)
  })
})

function openersOf(calls: string[]): FileOpeners {
  return {
    openPath: async (path) => {
      calls.push(`open ${path}`)
      return ''
    },
    reveal: (path) => calls.push(`reveal ${path}`)
  }
}
