import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { IpcHandlers } from '@shared/ipc'
import { runCommand } from '../simulator/run'
import { GitChangedNotifier, REPO_CHANGING_CHANNELS, withGitChanged } from './git-changed'

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-changed-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  return dir
}

describe('GitChangedNotifier (fiche 246, D4)', () => {
  it('toutes les conversations du même dépôt : dossier, sous-dossier, worktree ; pas les autres', async () => {
    const main = repo()
    const other = repo()
    mkdirSync(join(main, 'web'))
    const send = vi.fn()
    const notifier = new GitChangedNotifier(
      () => [
        { id: 'mere', workspace: main },
        { id: 'sous-dossier', workspace: join(main, 'web') },
        { id: 'fille', workspace: join(main, '.worktrees', 'f1'), root: main },
        { id: 'ailleurs', workspace: other }
      ],
      runCommand,
      send
    )
    await notifier.notify('mere')
    expect(send).toHaveBeenCalledWith('changes:gitChanged', {
      conversationIds: ['mere', 'sous-dossier', 'fille']
    })
    send.mockClear()
    // Depuis la fille (worktree) : le dépôt principal, donc la mère aussi.
    await notifier.notify('fille')
    expect(send.mock.calls[0]?.[1]).toEqual({
      conversationIds: ['fille', 'mere', 'sous-dossier']
    })
    send.mockClear()
    await notifier.notify('ailleurs')
    expect(send.mock.calls[0]?.[1]).toEqual({ conversationIds: ['ailleurs'] })
  })
})

describe('withGitChanged', () => {
  it('après un commit ou une fusion de Bobine, réussis ou non, la conversation est signalée', async () => {
    const notify = vi.fn()
    const handlers = {
      'children:merge': vi.fn(async () => ({ runId: 'r' })),
      'worktree:merge': vi.fn(async () => {
        throw new Error('conflit')
      }),
      'changes:git': vi.fn(async () => null)
    } as unknown as IpcHandlers
    const wrapped = withGitChanged(handlers, notify)
    await wrapped['children:merge']('mere', ['f1'], {
      cleanup: false,
      commit: { message: 'm', files: ['a'] }
    })
    expect(notify).toHaveBeenLastCalledWith('mere')
    await expect(wrapped['worktree:merge']('fille')).rejects.toThrow('conflit')
    expect(notify).toHaveBeenLastCalledWith('fille')
    // Une lecture ne change rien : pas d'évènement.
    notify.mockClear()
    await wrapped['changes:git']('mere')
    expect(notify).not.toHaveBeenCalled()
  })

  it('couvre les commits, fusions, « Défaire », nettoyage et « Rétablir »', () => {
    expect(REPO_CHANGING_CHANNELS).toEqual(
      expect.arrayContaining([
        'changes:commit',
        'worktree:commit',
        'children:merge',
        'conversation:commitForChildren',
        'worktree:merge',
        'worktree:undoCommit',
        'worktree:cleanup',
        'changes:revert'
      ])
    )
  })
})
