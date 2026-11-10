import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitCommand } from '../git/git-queue'
import { GitChangesReader, insideWorkspace, parseNumstat, parseStatus } from './git'

describe('analyse des sorties de git', () => {
  it('status : modifié, nouveau, renommé, supprimé', () => {
    expect(parseStatus(' M a.txt\0?? src/b.ts\0R  new.md\0old.md\0 D gone.txt\0')).toEqual([
      { x: ' ', y: 'M', path: 'a.txt' },
      { x: '?', y: '?', path: 'src/b.ts' },
      { x: 'R', y: ' ', path: 'new.md', from: 'old.md' },
      { x: ' ', y: 'D', path: 'gone.txt' }
    ])
  })

  it('numstat : lignes, binaire, renommage', () => {
    const stats = parseNumstat('3\t1\ta.txt\0-\t-\timg.png\0' + '2\t0\t\0old.md\0new.md\0')
    expect(stats.get('a.txt')).toEqual({ added: 3, removed: 1 })
    expect(stats.get('img.png')).toEqual({ added: null, removed: null })
    expect(stats.get('new.md')).toEqual({ added: 2, removed: 0 })
  })

  it('refuse les chemins hors du dossier', () => {
    expect(insideWorkspace('/p', 'src/a.ts')).toBe('/p/src/a.ts')
    expect(insideWorkspace('/p', '/p/a.ts')).toBe('/p/a.ts')
    expect(() => insideWorkspace('/p', '../etc/passwd')).toThrow('hors du dossier')
    expect(() => insideWorkspace('/p', '/etc/passwd')).toThrow('hors du dossier')
    expect(() => insideWorkspace('/p', '/p')).toThrow('hors du dossier')
    expect(() => insideWorkspace('/p', '/pp/a')).toThrow('hors du dossier')
  })
})

describe('GitChangesReader (vrai dépôt)', () => {
  let dir = ''
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: dir
    })

  it('dossier hors dépôt : null', async () => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'bob-git-')))
    expect(await new GitChangesReader(gitCommand).changes(dir)).toBeNull()
  })

  it('modifications par rapport au dernier commit, dans un sous-dossier du dépôt', async () => {
    // Chemin non résolu (/var → /private/var sur macOS), comme celui que l'app reçoit.
    dir = mkdtempSync(join(tmpdir(), 'bob-git-'))
    mkdirSync(join(dir, 'app'))
    writeFileSync(join(dir, 'app', 'README.md'), 'un\ndeux\ntrois\n')
    writeFileSync(join(dir, 'app', 'old.txt'), 'à supprimer\n')
    writeFileSync(join(dir, 'ailleurs.txt'), 'hors du dossier\n')
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    writeFileSync(join(dir, 'app', 'README.md'), 'un\n2\ntrois\nquatre\n')
    rmSync(join(dir, 'app', 'old.txt'))
    writeFileSync(join(dir, 'app', 'nouveau.ts'), 'export const a = 1\n')
    writeFileSync(join(dir, 'app', 'image.bin'), Buffer.from([0, 1, 2]))
    writeFileSync(join(dir, 'ailleurs.txt'), 'modifié\n')

    const reader = new GitChangesReader(gitCommand)
    const workspace = join(dir, 'app')
    const changes = await reader.changes(workspace)
    expect(changes?.root).toBe(realpathSync(dir))
    expect(changes?.branch).toBe('main')
    const files = Object.fromEntries((changes?.files ?? []).map((f) => [f.path, f]))
    expect(Object.keys(files).sort()).toEqual(['README.md', 'image.bin', 'nouveau.ts', 'old.txt'])
    expect(files['README.md']).toMatchObject({ status: 'modified', added: 2, removed: 1 })
    expect(files['old.txt']).toMatchObject({ status: 'deleted', added: 0, removed: 1 })
    expect(files['nouveau.ts']).toMatchObject({ status: 'untracked', added: 1, removed: 0 })
    expect(files['image.bin']).toMatchObject({ added: null, removed: null })

    expect(await reader.fileDiff(workspace, 'README.md')).toEqual({
      oldText: 'un\ndeux\ntrois\n',
      newText: 'un\n2\ntrois\nquatre\n'
    })
    expect(await reader.fileDiff(workspace, 'nouveau.ts')).toEqual({
      oldText: null,
      newText: 'export const a = 1\n'
    })
    expect(await reader.fileDiff(workspace, 'old.txt')).toEqual({
      oldText: 'à supprimer\n',
      newText: null
    })
    expect(await reader.fileDiff(workspace, 'image.bin')).toMatchObject({ binary: true })
    await expect(reader.fileDiff(workspace, '../ailleurs.txt')).rejects.toThrow('hors du dossier')
  })
})
