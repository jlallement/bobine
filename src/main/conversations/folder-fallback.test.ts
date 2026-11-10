import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { folderGoneMessage, usableFolder, worktreeOrigin } from './folder-fallback'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const folder = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'bob-fallback-')))
  dirs.push(dir)
  return dir
}

describe('dossier d’une nouvelle conversation disparu (0.9.1, D21)', () => {
  it('origine d’un dossier de worktree : le dépôt, et le même sous-dossier d’abord', () => {
    expect(worktreeOrigin('/r/.worktrees/20261106-1849-4f2f')).toEqual(['/r'])
    expect(worktreeOrigin('/r/.worktrees/20261106-1849-4f2f/app/web')).toEqual(['/r/app/web', '/r'])
    expect(worktreeOrigin('/r/app')).toEqual([])
    // Worktree pris dans un autre : son propre dépôt, pas celui du dessus.
    expect(worktreeOrigin('/r/.worktrees/a/.worktrees/b')).toEqual(['/r/.worktrees/a'])
  })

  it('jamais un dossier pris dans un worktree comme repli (remarque 3)', () => {
    const repo = folder()
    const other = join(repo, '.worktrees', 'autre')
    mkdirSync(other, { recursive: true })
    const gone = join(repo, '.worktrees', 'parti')
    // L'origine (le dépôt) d'abord ; un worktree d'une autre conversation, jamais.
    expect(usableFolder(gone, [other])).toEqual({ workspace: repo, gone })
    const lost = join(folder(), 'perdu')
    expect(usableFolder(lost, [other])).toEqual({ workspace: '', gone: lost })
  })

  it('le dossier s’il existe ; sinon l’origine du worktree, puis les autres, sinon aucun', () => {
    const repo = folder()
    const other = folder()
    expect(usableFolder(repo, [])).toEqual({ workspace: repo })
    expect(usableFolder('', [repo])).toEqual({ workspace: '' })
    const gone = join(repo, '.worktrees', 'x')
    expect(usableFolder(gone, [other])).toEqual({ workspace: repo, gone })
    mkdirSync(join(repo, 'app'))
    expect(usableFolder(join(gone, 'app'), [other])).toEqual({
      workspace: join(repo, 'app'),
      gone: join(gone, 'app')
    })
    const lost = join(other, 'perdu')
    expect(usableFolder(lost, [undefined, '', join(other, 'absent'), other])).toEqual({
      workspace: other,
      gone: lost
    })
    expect(usableFolder(lost, [lost])).toEqual({ workspace: '', gone: lost })
  })

  it('ce que la conversation en dit', () => {
    expect(folderGoneMessage('/a', '/b')).toEqual({
      key: 'conversations.notice.folderFallback',
      params: { folder: '/a', fallback: '/b' }
    })
    expect(folderGoneMessage('/a', '')).toEqual({
      key: 'conversations.notice.folderGone',
      params: { folder: '/a' }
    })
  })
})
