import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectEditors, editorLaunch, openInEditor, type InstalledEditor } from './editors'

const probe = (paths: string[], commands: Record<string, string> = {}) => ({
  home: '/Users/moi',
  exists: (path: string) => paths.includes(path),
  onPath: (command: string) => commands[command]
})

describe('detectEditors : éditeurs installés (fiche 156)', () => {
  it('rien d’installé : aucun éditeur', () => {
    expect(detectEditors(probe([]))).toEqual([])
  })

  it('VS Code par sa commande fournie dans l’app, avant celle du PATH', () => {
    const app = '/Applications/Visual Studio Code.app'
    const cli = `${app}/Contents/Resources/app/bin/code`
    expect(detectEditors(probe([app, cli], { code: '/usr/local/bin/code' }))).toEqual([
      { id: 'vscode', name: 'VS Code', style: 'goto', launcher: { kind: 'command', command: cli } }
    ])
  })

  it('commande dans le PATH sans app (Zed), app JetBrains de ~/Applications sans lanceur', () => {
    const idea = '/Users/moi/Applications/IntelliJ IDEA CE.app'
    const found = detectEditors(probe([idea], { zed: '/opt/homebrew/bin/zed' }))
    expect(found.map((e) => [e.id, e.launcher])).toEqual([
      ['zed', { kind: 'command', command: '/opt/homebrew/bin/zed' }],
      ['idea', { kind: 'app', app: idea }]
    ])
  })

  it('une app sans commande qui n’est pas de JetBrains n’est pas proposée', () => {
    expect(detectEditors(probe(['/Applications/Cursor.app']))).toEqual([])
  })

  it('le lanceur JetBrains du PATH l’emporte sur l’app', () => {
    const found = detectEditors(
      probe(['/Applications/WebStorm.app'], { webstorm: '/usr/local/bin/webstorm' })
    )
    expect(found[0]?.launcher).toEqual({ kind: 'command', command: '/usr/local/bin/webstorm' })
  })
})

describe('editorLaunch : commande sans shell', () => {
  const command = (style: InstalledEditor['style']) =>
    ({ style, launcher: { kind: 'command', command: '/bin/ed' } }) as const
  it('VS Code et Cursor : dossier, puis --goto fichier:ligne', () => {
    expect(editorLaunch(command('goto'), '/p/a.ts', 12, '/p')).toEqual({
      command: '/bin/ed',
      args: ['/p', '--goto', '/p/a.ts:12']
    })
    expect(editorLaunch(command('goto'), '/p/a.ts', undefined, '/p').args).toEqual([
      '/p',
      '--goto',
      '/p/a.ts'
    ])
  })
  it('Zed : fichier:ligne', () => {
    expect(editorLaunch(command('path-line'), '/p/a.ts', 3, '/p').args).toEqual(['/p/a.ts:3'])
  })
  it('JetBrains : --line N fichier, ou open -na App --args', () => {
    expect(editorLaunch(command('jetbrains'), '/p/a.ts', 7, '/p').args).toEqual([
      '--line',
      '7',
      '/p/a.ts'
    ])
    expect(
      editorLaunch(
        { style: 'jetbrains', launcher: { kind: 'app', app: '/Applications/IntelliJ IDEA.app' } },
        '/p/a.ts',
        7,
        '/p'
      )
    ).toEqual({
      command: '/usr/bin/open',
      args: ['-na', '/Applications/IntelliJ IDEA.app', '--args', '--line', '7', '/p/a.ts']
    })
  })
})

describe('openInEditor : chemin vérifié dans le dossier de la conversation', () => {
  let dir = ''
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  const setup = () => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-editeur-')))
    const workspace = join(dir, 'projet')
    mkdirSync(join(workspace, 'src'), { recursive: true })
    writeFileSync(join(workspace, 'src', 'app.ts'), 'x')
    writeFileSync(join(dir, 'secret.txt'), 'x')
    symlinkSync(join(dir, 'secret.txt'), join(workspace, 'lien.txt'))
    return workspace
  }
  const editor: InstalledEditor = {
    id: 'vscode',
    name: 'VS Code',
    style: 'goto',
    launcher: { kind: 'command', command: '/bin/code' }
  }

  it('fichier du dossier : lancé à la ligne', async () => {
    const workspace = setup()
    const run = vi.fn(async () => {})
    const outcome = await openInEditor({ workspace, path: 'src/app.ts', line: 4 }, editor, run)
    expect(outcome).toEqual({ kind: 'opened', path: join(workspace, 'src', 'app.ts') })
    expect(run).toHaveBeenCalledWith('/bin/code', [
      workspace,
      '--goto',
      `${join(workspace, 'src', 'app.ts')}:4`
    ])
  })

  it('relatif au document en aperçu (base), absolu dans le dossier', async () => {
    const workspace = setup()
    const run = vi.fn(async () => {})
    await openInEditor({ workspace, path: 'app.ts', base: join(workspace, 'src') }, editor, run)
    await openInEditor({ workspace, path: join(workspace, 'src', 'app.ts') }, editor, run)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('hors du dossier, par « .. » ou par un lien symbolique : refusé, rien de lancé', async () => {
    const workspace = setup()
    const run = vi.fn(async () => {})
    expect((await openInEditor({ workspace, path: '../secret.txt' }, editor, run)).kind).toBe(
      'outside'
    )
    expect((await openInEditor({ workspace, path: 'lien.txt' }, editor, run)).kind).toBe('outside')
    expect(run).not.toHaveBeenCalled()
  })

  it('hors du dossier : refusé sans dire si le fichier existe', async () => {
    const workspace = setup()
    const run = vi.fn(async () => {})
    expect((await openInEditor({ workspace, path: '../absent.txt' }, editor, run)).kind).toBe(
      'outside'
    )
    expect((await openInEditor({ workspace, path: '/nulle/part.ts' }, editor, run)).kind).toBe(
      'outside'
    )
  })

  it('dossier nommé par un lien symbolique (/var → /private/var) : ses chemins sont acceptés', async () => {
    const workspace = setup()
    const alias = join(dir, 'alias')
    symlinkSync(workspace, alias)
    const run = vi.fn(async () => {})
    const outcome = await openInEditor(
      { workspace: alias, path: join(alias, 'src', 'app.ts') },
      editor,
      run
    )
    expect(outcome).toEqual({ kind: 'opened', path: join(workspace, 'src', 'app.ts') })
  })

  it('le dossier lui-même (`.`, worktree d’une fille, fiche 161) : sa fenêtre de projet', async () => {
    const workspace = setup()
    const run = vi.fn(async () => {})
    expect(await openInEditor({ workspace, path: '.' }, editor, run)).toEqual({
      kind: 'opened',
      path: workspace
    })
    expect(run).toHaveBeenCalledWith('/bin/code', [workspace])
    const idea: InstalledEditor = {
      ...editor,
      id: 'idea',
      style: 'jetbrains',
      launcher: { kind: 'app', app: '/Applications/IntelliJ IDEA.app' }
    }
    await openInEditor({ workspace, path: '.' }, idea, run)
    expect(run).toHaveBeenLastCalledWith('/usr/bin/open', [
      '-na',
      '/Applications/IntelliJ IDEA.app',
      '--args',
      workspace
    ])
  })

  it('fichier absent, dossier, ou aucun éditeur', async () => {
    const workspace = setup()
    const run = vi.fn(async () => {})
    expect((await openInEditor({ workspace, path: 'nope.ts' }, editor, run)).kind).toBe('missing')
    expect((await openInEditor({ workspace, path: 'src' }, editor, run)).kind).toBe('missing')
    expect(await openInEditor({ workspace, path: 'src/app.ts' }, undefined, run)).toEqual({
      kind: 'no-editor'
    })
    expect(run).not.toHaveBeenCalled()
  })
})
