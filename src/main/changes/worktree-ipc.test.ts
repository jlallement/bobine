import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { hasWorkflows, worktreeHandlers, type WorktreeCycleDeps } from './worktree-ipc'

function setup(
  options: {
    merging?: string[]
    inWorktree?: boolean
    prs?: boolean
    merged?: boolean
    remoteError?: string
    remoteMoved?: boolean
  } = {}
) {
  const target = {
    id: 'c1',
    title: 'Essai',
    workspace: '/repo/.worktrees/x',
    worktree: { root: '/repo', path: '/repo/.worktrees/x', branch: 'bobine/x', base: 'abc' }
  }
  const cycle = {
    info: vi.fn(async () => ({
      title: 'Essai',
      branch: 'bobine/x',
      path: target.worktree.path,
      root: '/repo',
      base: 'abc',
      baseShort: 'abc',
      baseBranch: 'main',
      dirty: 0,
      ahead: 1,
      behind: 0,
      commits: ['feat: x'],
      merged: false,
      ...(options.merging ? { merging: { files: options.merging } } : {}),
      pr: { ok: false as const, reason: 'no-gh' as const }
    })),
    commit: vi.fn(async () => ({ hash: 'deadbeef', short: 'deadbee' })),
    undoCommit: vi.fn(async () => {}),
    commitMain: vi.fn(async () => ({ hash: 'cafe123', short: 'cafe123' })),
    commitIn: vi.fn(async () => ({ hash: 'beef456', short: 'beef456' })),
    undoCommitIn: vi.fn(async () => {}),
    merge: vi.fn(async () => ({ status: 'nothing' as const, base: 'main' })),
    mergeContinue: vi.fn(async () => ({
      status: 'merged' as const,
      kind: 'merge' as const,
      base: 'main'
    })),
    mergeAbort: vi.fn(async () => {}),
    pullRequest: vi.fn(async () => ({ url: 'https://x/pull/1', existed: false })),
    orphans: vi.fn(async (roots: readonly string[], known: ReadonlySet<string>) =>
      [...roots]
        .map((root) => ({ root, path: `${root}/.worktrees/o`, branch: 'b', dirty: 0, ahead: 0 }))
        .filter((o) => !known.has(o.path))
    ),
    removeOrphan: vi.fn(async () => {}),
    forgetGh: vi.fn(),
    deleteRemoteBranch: vi.fn(async (): Promise<'deleted' | 'gone' | 'moved'> => {
      if (options.remoteError) throw new Error(options.remoteError)
      return options.remoteMoved ? 'moved' : 'deleted'
    })
  }
  const conversations = {
    worktreeOf: vi.fn((id: string) =>
      options.inWorktree === false || id !== 'c1' ? null : target
    ),
    worktreePaths: vi.fn(() => [{ ...target.worktree }, { ...target.worktree }]),
    leaveWorktree: vi.fn(() => target.worktree),
    prompt: vi.fn(async () => {}),
    state: vi.fn(() => ({
      activeId: 'c1',
      conversations: [
        { id: 'c1', workspace: '/autre', startedFrom: { id: 'm', title: 'Mère' } },
        { id: 'c2', workspace: '/autre' }
      ]
    })),
    workspaceOf: vi.fn((id: string) => (id === 'c2' ? '/autre/app' : target.workspace))
  }
  const worktrees = { remove: vi.fn(async () => {}) }
  const track = { status: 'none' as const, checkedAt: 0 }
  const prs = {
    status: vi.fn(async () => track),
    refresh: vi.fn(async () => track),
    refreshNow: vi.fn(async () => track),
    pushed: vi.fn(async () => track),
    setOptions: vi.fn(async () => track),
    fixChecks: vi.fn(async () => track),
    mergeNow: vi.fn(async () => track),
    mergedHead: vi.fn(() => (options.merged ? 'h9' : undefined)),
    forget: vi.fn()
  }
  const deps = {
    cycle,
    ...(options.prs === false ? {} : { prs }),
    conversations,
    worktrees,
    recentWorkspaces: () => ['/repo', '/recent']
  } as unknown as WorktreeCycleDeps
  return { handlers: worktreeHandlers(deps), cycle, conversations, worktrees, target, prs }
}

describe('canaux IPC du cycle des worktrees (fiche 110)', () => {
  it('info : null hors worktree ; cible vérifiée ; arguments vérifiés', async () => {
    const { handlers, cycle } = setup()
    expect(await handlers['worktree:info']('c2')).toBeNull()
    expect(await handlers['worktree:info']('c1')).toMatchObject({ branch: 'bobine/x' })
    expect(() => handlers['worktree:merge']('c2')).toThrow(t('worktreeCycle.error.noWorktree'))
    expect(() => handlers['worktree:info']('')).toThrow('id')
    expect(() => handlers['worktree:commit']('c1', { message: 'm', files: [''] })).toThrow('files')
    expect(() =>
      handlers['worktree:commit']('c1', { message: 1, files: [] } as unknown as {
        message: string
        files: string[]
      })
    ).toThrow('message')
    expect(await handlers['worktree:commit']('c1', { message: 'm', files: ['a'] })).toEqual({
      hash: 'deadbeef',
      short: 'deadbee'
    })
    expect(cycle.commit).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), {
      message: 'm',
      files: ['a']
    })
    expect(() =>
      handlers['worktree:pullRequest']('c1', { title: 'x' } as { title: string; body: string })
    ).toThrow('body')
    expect(await handlers['worktree:pullRequest']('c1', { title: 'x', body: '' })).toEqual({
      url: 'https://x/pull/1',
      existed: false
    })
    expect(await handlers['worktree:undoCommit']('c1', 'deadbeef')).toBeUndefined()
    expect(await handlers['worktree:mergeAbort']('c1')).toBeUndefined()
  })

  it('laisser l’agent résoudre : consigne envoyée, tour attendu, fusion reprise', async () => {
    const { handlers, cycle, conversations } = setup({ merging: ['README.md', 'src/a.ts'] })
    const order: string[] = []
    conversations.prompt.mockImplementation(async () => {
      order.push('prompt')
    })
    cycle.mergeContinue.mockImplementation(async () => {
      order.push('continue')
      return { status: 'merged' as const, kind: 'merge' as const, base: 'main' }
    })
    expect(await handlers['worktree:resolveWithAgent']('c1')).toEqual({
      status: 'merged',
      kind: 'merge',
      base: 'main'
    })
    expect(order).toEqual(['prompt', 'continue'])
    const text = String((conversations.prompt.mock.calls as unknown[][])[0]?.[1])
    expect(text).toContain('`main` into `bobine/x`')
    expect(text).toContain('- README.md\n- src/a.ts')
    // Sans conflit en cours : rien n'est envoyé, la fusion reprend seulement.
    const quiet = setup()
    await quiet.handlers['worktree:resolveWithAgent']('c1')
    expect(quiet.conversations.prompt).not.toHaveBeenCalled()
    expect(quiet.cycle.mergeContinue).toHaveBeenCalled()
  })

  it('nettoyage : la conversation quitte le worktree, puis il est supprimé avec sa branche', async () => {
    const { handlers, conversations, worktrees, target, cycle } = setup()
    const done = await handlers['worktree:cleanup']('c1')
    expect(done.state).toMatchObject({ activeId: 'c1' })
    expect(done.remote).toBeUndefined()
    expect(conversations.leaveWorktree).toHaveBeenCalledWith('c1')
    expect(worktrees.remove).toHaveBeenCalledWith(target.worktree, { force: true })
    // PR pas fusionnée : la branche distante reste.
    expect(cycle.deleteRemoteBranch).not.toHaveBeenCalled()
  })

  it('nettoyage après une PR fusionnée : la branche distante part aussi (0.9.1, D19)', async () => {
    const merged = setup({ merged: true })
    const done = await merged.handlers['worktree:cleanup']('c1')
    expect(merged.cycle.deleteRemoteBranch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1' }),
      'h9'
    )
    expect(done.remote).toEqual({ deleted: true })
    // Des commits arrivés après la fusion : la branche distante est gardée, et c'est dit.
    const moved = setup({ merged: true, remoteMoved: true })
    expect((await moved.handlers['worktree:cleanup']('c1')).remote).toEqual({ kept: 'moved' })
    expect(moved.worktrees.remove).toHaveBeenCalled()
    expect(merged.worktrees.remove).toHaveBeenCalled()
    // Suppression distante refusée : dite, et le nettoyage local est fait quand même.
    const refused = setup({ merged: true, remoteError: 'remote: Permission denied' })
    const after = await refused.handlers['worktree:cleanup']('c1')
    expect(after.remote).toEqual({ error: 'remote: Permission denied' })
    expect(refused.conversations.leaveWorktree).toHaveBeenCalledWith('c1')
    expect(refused.worktrees.remove).toHaveBeenCalled()
  })

  it('orphelins : dépôts des worktrees tenus, dossiers récents et dossiers des conversations', async () => {
    const { handlers, cycle } = setup()
    const found = await handlers['worktree:orphans']()
    expect(cycle.orphans).toHaveBeenCalledWith(
      ['/repo', '/recent', '/autre'],
      new Set(['/repo/.worktrees/x'])
    )
    expect(found).toHaveLength(3)
    expect(
      await handlers['worktree:removeOrphan']({
        root: '/repo',
        path: '/repo/.worktrees/o',
        branch: 'b'
      })
    ).toHaveLength(3)
    expect(cycle.removeOrphan).toHaveBeenCalledWith({
      root: '/repo',
      path: '/repo/.worktrees/o',
      branch: 'b'
    })
    await expect(
      handlers['worktree:removeOrphan']({ root: '', path: 'p', branch: '' })
    ).rejects.toThrow('root')
  })

  it('fusion : « Mettre de côté » transmis ; refus d’avance avec le titre de la mère (fiche 123)', async () => {
    const { handlers, cycle } = setup()
    await handlers['worktree:merge']('c1', { stash: true })
    expect(cycle.merge).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }), {
      stash: true
    })
    await handlers['worktree:merge']('c1')
    expect(cycle.merge).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }), {
      stash: false
    })
    cycle.merge.mockImplementationOnce(
      async () =>
        ({
          status: 'main-dirty',
          root: '/repo',
          base: 'main',
          files: [{ path: 'a', status: 'modified' }]
        }) as never
    )
    expect(await handlers['worktree:merge']('c1')).toMatchObject({
      status: 'main-dirty',
      title: 'Mère'
    })
    expect(await handlers['worktree:commitMain']('c1', { message: 'm', files: ['a'] })).toEqual({
      hash: 'cafe123',
      short: 'cafe123'
    })
    await handlers['worktree:resolveWithAgent']('c1', { stash: true })
    expect(cycle.mergeContinue).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }), {
      stash: true
    })
    expect(() => handlers['worktree:commitMain']('c2', { message: 'm', files: ['a'] })).toThrow(
      t('worktreeCycle.error.noWorktree')
    )
  })

  it('« Committer » hors worktree : dans le dossier de la conversation (fiche 123)', async () => {
    const { handlers, cycle } = setup()
    expect(await handlers['changes:commit']('c2', { message: 'm', files: ['a'] })).toEqual({
      hash: 'beef456',
      short: 'beef456'
    })
    expect(cycle.commitIn).toHaveBeenCalledWith(
      { id: 'c2', workspace: '/autre/app', cwd: '/autre/app' },
      { message: 'm', files: ['a'] }
    )
    expect(await handlers['changes:undoCommit']('c2', 'beef456')).toBeUndefined()
    expect(cycle.undoCommitIn).toHaveBeenCalledWith(
      { id: 'c2', workspace: '/autre/app', cwd: '/autre/app' },
      'beef456'
    )
    expect(() =>
      handlers['changes:commit']('c2', { message: 'm', files: [] as never })
    ).not.toThrow()
    await expect(handlers['changes:undoCommit']('c2', '')).rejects.toThrow('hash')
  })

  it('suivi de la PR (fiche 176) : canaux, options vérifiées, suivi après « Ouvrir une PR »', async () => {
    const { handlers, prs } = setup()
    await handlers['pr:status']('c1')
    expect(prs.status).toHaveBeenCalledWith('c1')
    await handlers['pr:fixChecks']('c1')
    expect(prs.fixChecks).toHaveBeenCalledWith('c1')
    await handlers['pr:options']('c1', {
      autoMerge: true,
      autoFix: 'oui',
      other: 1
    } as unknown as { autoMerge: boolean })
    expect(prs.setOptions).toHaveBeenCalledWith('c1', { autoMerge: true })
    expect(() => handlers['pr:options']('c1', null as unknown as object)).toThrow()
    expect(() => handlers['pr:status']('')).toThrow()
    await handlers['worktree:pullRequest']('c1', { title: 'x', body: '' })
    // Branche poussée : relève rapprochée (0.9.1, D16).
    expect(prs.pushed).toHaveBeenCalledWith('c1')
    await handlers['pr:mergeNow']('c1')
    expect(prs.mergeNow).toHaveBeenCalledWith('c1')
    await handlers['worktree:cleanup']('c1')
    expect(prs.forget).toHaveBeenCalledWith('c1')
    const without = setup({ prs: false })
    expect(() => without.handlers['pr:status']('c1')).toThrow(t('ipc.unavailable.worktree'))
  })

  it('« Actualiser » relit l’état de gh (0.9.1, D7)', async () => {
    const { handlers, cycle, prs } = setup()
    await handlers['worktree:info']('c1')
    expect(cycle.forgetGh).not.toHaveBeenCalled()
    await handlers['worktree:info']('c1', { fresh: true })
    expect(cycle.forgetGh).toHaveBeenCalledTimes(1)
    await handlers['pr:refresh']('c1')
    expect(cycle.forgetGh).toHaveBeenCalledTimes(2)
    // « Actualiser » de la carte relit aussi des règles de la base illisibles (remarque 2).
    expect(prs.refreshNow).toHaveBeenCalledWith('c1')
  })

  it('CI de la branche : un workflow GitHub dans .github/workflows (0.9.1, D20)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-ci-'))
    try {
      expect(await hasWorkflows(dir)).toBe(false)
      mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
      writeFileSync(join(dir, '.github', 'workflows', 'README.md'), '')
      expect(await hasWorkflows(dir)).toBe(false)
      writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'on: pull_request\n')
      expect(await hasWorkflows(dir)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('indisponible : chaque canal le dit', () => {
    expect(() => worktreeHandlers(undefined)['worktree:info']('c1')).toThrow(
      t('ipc.unavailable.worktree')
    )
  })
})
