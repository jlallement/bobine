import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { threadHandlers, type ThreadIpcDeps } from './thread-ipc'
import { cleanDraggedImages, writeDraggedImage } from './images/image-drag'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

let dir = ''
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function setup() {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-fil-')))
  writeFileSync(join(dir, 'a.ts'), 'x')
  const deps: ThreadIpcDeps = {
    editors: () => [
      { id: 'zed', name: 'Zed', style: 'path-line', launcher: { kind: 'command', command: 'zed' } }
    ],
    runEditor: vi.fn(async () => {}),
    dragImage: vi.fn(async () => {}),
    writeOutput: vi.fn(async () => '/app/tool-outputs/sortie-1.txt')
  }
  return { deps, handlers: threadHandlers(deps, () => dir) }
}

describe('threadHandlers (fiche 156)', () => {
  it('éditeurs : le nom et l’id seulement', async () => {
    const { handlers } = setup()
    expect(await handlers['editors:list']()).toEqual([{ id: 'zed', name: 'Zed' }])
  })

  it('ouvrir : l’éditeur doit être installé, la ligne un entier positif', async () => {
    const { deps, handlers } = setup()
    expect(await handlers['editors:open']('c1', 'vscode', 'a.ts')).toEqual({ kind: 'no-editor' })
    await handlers['editors:open']('c1', 'zed', 'a.ts', { line: -3 })
    await handlers['editors:open']('c1', 'zed', 'a.ts', { line: 9 })
    expect(deps.runEditor).toHaveBeenNthCalledWith(1, 'zed', [join(dir, 'a.ts')])
    expect(deps.runEditor).toHaveBeenNthCalledWith(2, 'zed', [`${join(dir, 'a.ts')}:9`])
  })

  it('sortie trop grosse (fiche 192) : écrite par l’app, ouverte dans l’éditeur installé', async () => {
    const { deps, handlers } = setup()
    expect(await handlers['editors:openText']('c1', 'vscode', 'x')).toEqual({ kind: 'no-editor' })
    await expect(
      handlers['editors:openText']('c1', 'zed', 42 as unknown as string)
    ).rejects.toThrow()
    expect(await handlers['editors:openText']('c1', 'zed', 'sortie')).toEqual({
      kind: 'opened',
      path: '/app/tool-outputs/sortie-1.txt'
    })
    expect(deps.writeOutput).toHaveBeenCalledTimes(1)
    expect(deps.runEditor).toHaveBeenCalledWith('zed', ['/app/tool-outputs/sortie-1.txt'])
  })

  it('sortie ouverte avec le dossier de la conversation comme projet, jamais celui de l’app', async () => {
    const { deps, handlers } = setup()
    deps.editors = () => [
      { id: 'code', name: 'VS Code', style: 'goto', launcher: { kind: 'command', command: 'code' } }
    ]
    await handlers['editors:openText']('c1', 'code', 'sortie')
    expect(deps.runEditor).toHaveBeenCalledWith('code', [
      dir,
      '--goto',
      '/app/tool-outputs/sortie-1.txt'
    ])
  })

  it('glisser : type d’image vérifié avant le main', async () => {
    const { deps, handlers } = setup()
    await expect(
      handlers['images:startDrag']({ mimeType: 'text/html', data: PNG })
    ).rejects.toThrow()
    await handlers['images:startDrag']({ mimeType: 'image/png', data: PNG, name: 'capture.png' })
    expect(deps.dragImage).toHaveBeenCalledWith({
      mimeType: 'image/png',
      data: PNG,
      name: 'capture.png'
    })
  })
})

describe('writeDraggedImage', () => {
  it('écrit l’image décodée, nommée d’après la pièce jointe ; même image, même fichier', async () => {
    dir = mkdtempSync(join(tmpdir(), 'bobine-images-'))
    const file = await writeDraggedImage(
      { mimeType: 'image/png', data: PNG, name: 'écran.png' },
      dir
    )
    expect(file.endsWith('/écran.png')).toBe(true)
    expect(readFileSync(file)).toEqual(Buffer.from(PNG, 'base64'))
    expect(
      await writeDraggedImage({ mimeType: 'image/png', data: PNG, name: 'écran.png' }, dir)
    ).toBe(file)
  })
})

describe('cleanDraggedImages', () => {
  it('retire les images glissées il y a plus d’un jour, garde les récentes', async () => {
    dir = mkdtempSync(join(tmpdir(), 'bobine-images-'))
    const old = join(dir, 'ancienne')
    mkdirSync(old)
    writeFileSync(join(old, 'a.png'), 'x')
    const day = 24 * 3600
    const twoDaysAgo = Date.now() / 1000 - 2 * day
    utimesSync(old, twoDaysAgo, twoDaysAgo)
    const recent = await writeDraggedImage({ mimeType: 'image/png', data: PNG }, dir)
    expect(await cleanDraggedImages(dir)).toBe(1)
    expect(existsSync(old)).toBe(false)
    expect(existsSync(recent)).toBe(true)
    expect(await cleanDraggedImages(join(dir, 'absent'))).toBe(0)
  })
})
