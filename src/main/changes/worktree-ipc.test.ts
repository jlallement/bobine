import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { ChildrenMerge } from '@shared/children-merge'
import { emptyTranscript, reduceTranscript, type TranscriptState } from '@shared/transcript'
import { hasWorkflows, worktreeHandlers, type WorktreeCycleDeps } from './worktree-ipc'

function setup(
  options: {
    others?: { id: string; title: string; workspace: string; status: string }[]
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
    mainDirty: vi.fn(async () => ({
      root: '/repo',
      base: 'main',
      files: [{ path: 'a', status: 'modified' as const }]
    })),
    baseElsewhere: vi.fn(async (): Promise<string | undefined> => undefined),
    branchState: vi.fn(async () => ({
      base: 'main',
      dirty: 0,
      ahead: options.merged ? 0 : 1,
      sinceBase: 1,
      files: ['a.txt', 'b.txt'],
      added: 5,
      removed: 1
    })),
    shortHead: vi.fn(async () => 'f00ba12'),
    commitIn: vi.fn(async () => ({ hash: 'beef456', short: 'beef456' })),
    undoCommitIn: vi.fn(async () => {}),
    merge: vi.fn(async () => ({ status: 'nothing' as const, base: 'main' })),
    mergeContinue: vi.fn(async () => ({
      status: 'merged' as const,
      kind: 'merge' as const,
      base: 'main'
    })),
    concludeMerge: vi.fn(
      async (): Promise<
        | { status: 'resolved' }
        | { status: 'conflicts'; files: string[] }
        | { status: 'not-merging' }
      > => ({ status: 'resolved' })
    ),
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
  /** Autres conversations (la mère dans le dossier principal, fiche 287). */
  const extra = [...(options.others ?? [])]
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
        {
          id: 'c1',
          title: 'Essai',
          workspace: '/autre',
          branch: 'bobine/x',
          status: 'ready',
          startedFrom: { id: 'm', title: 'Mère' }
        },
        { id: 'c2', title: 'Autre', workspace: '/autre', status: 'ready' },
        ...extra
      ]
    })),
    view: vi.fn(() => ({ transcript: mother })),
    post: vi.fn((id: string, event: AgentEvent) => {
      if (id !== 'm') return false
      mother = reduceTranscript(mother, event)
      if (event.type === 'children-merge') posted.push(event.merge)
      return true
    }),
    workspaceOf: vi.fn((id: string) => (id === 'c2' ? '/autre/app' : target.workspace))
  }
  const worktrees = { remove: vi.fn(async () => {}) }
  /** Fil de la mère « m » de c1 : les fusions faites depuis l'onglet Git y sont dites (fiche 287). */
  let mother: TranscriptState = emptyTranscript
  const posted: ChildrenMerge[] = []
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
  return {
    handlers: worktreeHandlers(deps),
    cycle,
    conversations,
    worktrees,
    target,
    prs,
    posted,
    extra
  }
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

  it('laisser l’agent résoudre : consigne envoyée, tour attendu, résolution commitée dans la branche ; rien dans la base sans clic (fiche 289)', async () => {
    const { handlers, cycle, conversations, posted } = setup({ merging: ['README.md', 'src/a.ts'] })
    const order: string[] = []
    conversations.prompt.mockImplementation(async () => {
      order.push('prompt')
    })
    cycle.concludeMerge.mockImplementation(async () => {
      order.push('conclude')
      return { status: 'resolved' as const }
    })
    expect(await handlers['worktree:resolveWithAgent']('c1')).toEqual({
      status: 'resolved',
      files: ['README.md', 'src/a.ts'],
      base: 'main'
    })
    expect(order).toEqual(['prompt', 'conclude'])
    expect(cycle.mergeContinue).not.toHaveBeenCalled()
    expect(cycle.merge).not.toHaveBeenCalled()
    const text = String((conversations.prompt.mock.calls as unknown[][])[0]?.[1])
    expect(text).toContain('`main` into `bobine/x`')
    expect(text).toContain('- README.md\n- src/a.ts')
    // Dit chez la mère : la carte et Modifications › Travaux montrent « à relire » (survit au
    // redémarrage), et la vue Git le relit.
    expect(posted.at(-1)).toMatchObject({
      status: 'review',
      base: 'main',
      rows: [{ childId: 'c1', state: 'resolved', files: ['README.md', 'src/a.ts'] }]
    })
    // La vue Git relue après le commit de la résolution : plus de fusion en cours.
    const { merging: _merging, ...settled } = await cycle.info()
    cycle.info.mockResolvedValueOnce(settled)
    expect(await handlers['worktree:info']('c1')).toMatchObject({
      review: { files: ['README.md', 'src/a.ts'] }
    })
    // Sans conflit en cours (résolu à la main) : rien n'est envoyé, la fusion reprend sur ce clic.
    const quiet = setup()
    await quiet.handlers['worktree:resolveWithAgent']('c1')
    expect(quiet.conversations.prompt).not.toHaveBeenCalled()
    expect(quiet.cycle.concludeMerge).not.toHaveBeenCalled()
    expect(quiet.cycle.mergeContinue).toHaveBeenCalled()
  })

  it('laisser l’agent résoudre : marqueurs restants ou fusion abandonnée, dits ; rien dans la base (fiche 289)', async () => {
    const left = setup({ merging: ['README.md'] })
    left.cycle.concludeMerge.mockImplementation(async () => ({
      status: 'conflicts' as const,
      files: ['README.md']
    }))
    expect(await left.handlers['worktree:resolveWithAgent']('c1')).toEqual({
      status: 'conflicts',
      files: ['README.md']
    })
    const aborted = setup({ merging: ['README.md'] })
    aborted.cycle.concludeMerge.mockImplementation(async () => ({ status: 'not-merging' as const }))
    await expect(aborted.handlers['worktree:resolveWithAgent']('c1')).rejects.toThrow(
      t('childrenMerge.error.notResolved', { title: 'Essai', base: 'main' })
    )
    for (const env of [left, aborted]) {
      expect(env.cycle.mergeContinue).not.toHaveBeenCalled()
      expect(env.posted).toEqual([])
    }
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
    // Revérifiés au moment de supprimer : les worktrees tenus sont passés au cycle, qui refuse.
    expect(cycle.removeOrphan).toHaveBeenCalledWith(
      { root: '/repo', path: '/repo/.worktrees/o', branch: 'b' },
      new Set(['/repo/.worktrees/x'])
    )
    await expect(
      handlers['worktree:removeOrphan']({ root: '', path: 'p', branch: '' })
    ).rejects.toThrow('root')
  })

  it('orphelins : les worktrees de la corbeille sont tenus, relus à chaque appel (fiche 228)', async () => {
    const { cycle, conversations, worktrees } = setup()
    let trashed = [{ root: '/corbeille', path: '/corbeille/.worktrees/t', branch: 't', base: 'a' }]
    const handlers = worktreeHandlers({
      cycle,
      conversations,
      worktrees,
      recentWorkspaces: () => [],
      trashed: () => trashed
    } as unknown as WorktreeCycleDeps)
    expect(await handlers['worktree:orphans']()).toEqual([
      { root: '/repo', path: '/repo/.worktrees/o', branch: 'b', dirty: 0, ahead: 0 },
      { root: '/corbeille', path: '/corbeille/.worktrees/o', branch: 'b', dirty: 0, ahead: 0 },
      { root: '/autre', path: '/autre/.worktrees/o', branch: 'b', dirty: 0, ahead: 0 }
    ])
    const held = new Set(['/repo/.worktrees/x', '/corbeille/.worktrees/t'])
    expect(cycle.orphans).toHaveBeenCalledWith(['/repo', '/corbeille', '/autre'], held)
    const orphan = { root: '/corbeille', path: '/corbeille/.worktrees/t', branch: 't' }
    await handlers['worktree:removeOrphan'](orphan)
    expect(cycle.removeOrphan).toHaveBeenLastCalledWith(orphan, held)
    trashed = []
    await handlers['worktree:removeOrphan'](orphan)
    expect(cycle.removeOrphan).toHaveBeenLastCalledWith(orphan, new Set(['/repo/.worktrees/x']))
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
    await handlers['worktree:resolveWithAgent']('c1', { stash: true })
    expect(cycle.mergeContinue).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }), {
      stash: true
    })
    // « Committer puis fusionner » (fiche 287) : un seul appel, commit vérifié.
    expect(() =>
      handlers['worktree:merge']('c1', { commit: { message: 'm', files: [''] } })
    ).toThrow('files')
    await handlers['worktree:merge']('c1', { stash: true, commit: { message: 'm', files: ['a'] } })
    expect(cycle.commitMain).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }), {
      message: 'm',
      files: ['a']
    })
    expect(cycle.merge).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }), {
      stash: true
    })
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

describe('« Committer puis fusionner » depuis l’onglet Git (fiche 287)', () => {
  it('un tour dans le dossier principal : refusé avant le commit, la raison dite', () => {
    const { handlers, cycle } = setup({
      others: [{ id: 'm', title: 'Mère', workspace: '/repo', status: 'busy' }]
    })
    expect(() =>
      handlers['worktree:merge']('c1', { commit: { message: 'm', files: ['a'] } })
    ).toThrow(t('worktreeCycle.error.turnRunning', { title: 'Mère' }))
    expect(cycle.commitMain).not.toHaveBeenCalled()
  })

  it('la fille elle-même répond encore : refusé de même', () => {
    const env = setup()
    const own = env.conversations.state().conversations[0] as { status: string }
    env.conversations.state.mockReturnValueOnce({
      activeId: 'c1',
      conversations: [{ ...own, status: 'busy' } as never]
    })
    expect(() =>
      env.handlers['worktree:merge']('c1', { commit: { message: 'm', files: ['a'] } })
    ).toThrow(t('worktreeCycle.error.turnRunning', { title: 'Essai' }))
    expect(env.cycle.commitMain).not.toHaveBeenCalled()
  })

  it('une conversation dans un autre dossier ou dans un worktree ne bloque pas', async () => {
    const { handlers, cycle } = setup({
      others: [{ id: 'x', title: 'Ailleurs', workspace: '/ailleurs', status: 'busy' }]
    })
    await handlers['worktree:merge']('c1', { commit: { message: 'm', files: ['a'] } })
    expect(cycle.commitMain).toHaveBeenCalledTimes(1)
  })

  it('base extraite ailleurs : refusé avant le commit', async () => {
    const { handlers, cycle } = setup()
    cycle.baseElsewhere.mockImplementationOnce(async () => '/repo/autre')
    await expect(
      handlers['worktree:merge']('c1', { commit: { message: 'm', files: ['a'] } })
    ).rejects.toThrow('/repo/autre')
    expect(cycle.commitMain).not.toHaveBeenCalled()
  })
})

describe('fusion et nettoyage depuis l’onglet Git, dits chez la mère (fiche 287)', () => {
  it('fusionnée : une ligne « fusionné » chez la mère ; nettoyée : la même ligne, nettoyée', async () => {
    const env = setup()
    env.cycle.merge.mockImplementationOnce(
      async () => ({ status: 'merged', kind: 'fast-forward', base: 'main' }) as never
    )
    await env.handlers['worktree:merge']('c1')
    expect(env.posted).toHaveLength(1)
    const merged = env.posted[0] as ChildrenMerge
    expect(merged).toMatchObject({ base: 'main', status: 'done', cleanup: false })
    expect(merged.rows).toEqual([
      {
        childId: 'c1',
        title: 'Essai',
        branch: 'bobine/x',
        state: 'merged',
        commit: 'f00ba12',
        fileCount: 2,
        added: 5,
        removed: 1
      }
    ])
    await env.handlers['worktree:cleanup']('c1')
    expect(env.posted).toHaveLength(2)
    const cleaned = env.posted[1] as ChildrenMerge
    expect(cleaned.runId).toBe(merged.runId)
    expect(cleaned.rows[0]).toMatchObject({ state: 'merged', cleaned: true })
  })

  it('rien à fusionner, conflit : rien n’est dit chez la mère', async () => {
    const env = setup()
    await env.handlers['worktree:merge']('c1')
    env.cycle.merge.mockImplementationOnce(
      async () => ({ status: 'conflicts', files: ['a'] }) as never
    )
    await env.handlers['worktree:merge']('c1')
    expect(env.posted).toHaveLength(0)
  })

  it('nettoyée sans fusion dite (faite hors de Bobine, ou PR fusionnée) : fusionnée et nettoyée', async () => {
    const inBase = setup({ merged: true, prs: false })
    await inBase.handlers['worktree:cleanup']('c1')
    expect(inBase.posted).toHaveLength(1)
    expect(inBase.posted[0]?.rows[0]).toMatchObject({
      childId: 'c1',
      state: 'merged',
      cleaned: true,
      commit: 'f00ba12'
    })
    const pr = setup({ merged: true })
    pr.cycle.branchState.mockImplementationOnce(async () => ({
      base: 'main',
      dirty: 0,
      ahead: 1,
      sinceBase: 1,
      files: [],
      added: 0,
      removed: 0
    }))
    await pr.handlers['worktree:cleanup']('c1')
    expect(pr.posted[0]?.rows[0]).toMatchObject({ state: 'merged', cleaned: true })
  })

  it('nettoyée sans être fusionnée : rien n’est inventé', async () => {
    const env = setup()
    await env.handlers['worktree:cleanup']('c1')
    expect(env.posted).toHaveLength(0)
  })
})
