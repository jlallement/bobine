import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommitFile, MergeOutcome, WorktreeCycleView } from '@shared/worktree-cycle'
import { FolderCommitBar } from './FolderCommitBar'
import { WorktreeBar } from './WorktreeBar'

const text = (id: string) => screen.getByTestId(id).textContent

describe('« Committer » hors worktree (fiche 123)', () => {
  const setup = (selected: CommitFile[] = [{ path: 'README.md', status: 'modified' }]) => {
    const commit = vi.fn(async () => ({ hash: 'a1b2c3d4e5', short: 'a1b2c3d' }))
    const undo = vi.fn(async () => undefined)
    const onChanged = vi.fn()
    render(
      <FolderCommitBar
        title="Modifs du README"
        selected={selected}
        commit={commit}
        undo={undo}
        onChanged={onChanged}
      />
    )
    return { commit, undo, onChanged }
  }

  it('fichiers cochés, message proposé modifiable, commit, puis « Défaire »', async () => {
    const { commit, undo, onChanged } = setup([
      { path: 'README.md', status: 'modified' },
      { path: 'src/app.js', status: 'untracked' }
    ])
    expect(text('changes-commit')).toBe('Committer (2)')
    expect(screen.queryByTestId('worktree-pr')).toBeNull()
    expect(screen.queryByTestId('worktree-merge')).toBeNull()
    fireEvent.click(screen.getByTestId('changes-commit'))
    const message = screen.getByTestId('changes-commit-message') as HTMLTextAreaElement
    expect(message.value).toBe('feat: modifs du README\n\n- README.md\n- src/app.js (new)')
    fireEvent.change(message, { target: { value: 'docs: README' } })
    fireEvent.click(screen.getByTestId('changes-commit-confirm'))
    await waitFor(() => screen.getByTestId('changes-commit-note'))
    expect(commit).toHaveBeenCalledWith('docs: README', ['README.md', 'src/app.js'])
    expect(text('changes-commit-note')).toBe('Commit a1b2c3d fait.Défaire')
    expect(onChanged).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('changes-commit-undo'))
    await waitFor(() => expect(undo).toHaveBeenCalledWith('a1b2c3d4e5'))
    await waitFor(() =>
      expect(text('changes-commit-note')).toBe(
        'Commit défait\u00a0: ses modifications sont de nouveau à committer.'
      )
    )
  })

  it('rien de coché, rien de fait : pas de barre', () => {
    setup([])
    expect(screen.queryByTestId('changes-commit-bar')).toBeNull()
  })
})

describe('Barre du worktree : fusion refusée, dossier principal sale (fiche 123)', () => {
  const info: WorktreeCycleView = {
    title: 'Import CSV',
    branch: 'bobine/x',
    path: '/repo/.worktrees/x',
    root: '/repo',
    base: 'abc1234',
    baseShort: 'abc1234',
    baseBranch: 'main',
    dirty: 0,
    ahead: 1,
    behind: 0,
    commits: ['feat: x'],
    merged: false,
    pr: { ok: false, reason: 'no-gh' }
  }

  it('« Fusionner » refusé : encadré, puis « Mettre de côté » fusionne et le dit', async () => {
    const outcomes: MergeOutcome[] = [
      {
        status: 'main-dirty',
        root: '/repo',
        base: 'main',
        title: 'Mère',
        files: [{ path: 'public/index.html', status: 'modified' }]
      },
      {
        status: 'merged',
        kind: 'fast-forward',
        base: 'main',
        stash: { restored: true, count: 1 }
      }
    ]
    const merge = vi.fn(async () => outcomes.shift() as MergeOutcome)
    const commitMain = vi.fn(async () => ({ hash: 'f00', short: 'f00' }))
    window.api.worktree = { ...window.api.worktree, merge, commitMain }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('main-dirty'))
    expect(text('main-dirty-title')).toBe(
      'Fusion refusée\u00a0: le dossier principal a une modification non commitée.'
    )
    expect(merge).toHaveBeenCalledWith('c1')
    fireEvent.click(screen.getByTestId('main-dirty-stash'))
    await waitFor(() => screen.getByTestId('worktree-note'))
    expect(merge).toHaveBeenLastCalledWith('c1', { stash: true })
    expect(text('worktree-note')).toBe(
      'Fusionné dans main (fast-forward). Votre modification mise de côté est revenue.'
    )
    expect(screen.queryByTestId('main-dirty')).toBeNull()
  })

  it('« Mettre de côté » retenu pour la reprise après un conflit', async () => {
    const outcomes: MergeOutcome[] = [
      {
        status: 'main-dirty',
        root: '/repo',
        base: 'main',
        files: [{ path: 'a', status: 'modified' }]
      },
      { status: 'conflicts', files: ['README.md'], stash: { restored: true, count: 1 } }
    ]
    const merge = vi.fn(async () => outcomes.shift() as MergeOutcome)
    const mergeContinue = vi.fn(
      async () => ({ status: 'merged', kind: 'merge', base: 'main' }) as MergeOutcome
    )
    window.api.worktree = { ...window.api.worktree, merge, mergeContinue }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-stash'))
    await waitFor(() => screen.getByTestId('worktree-conflicts'))
    fireEvent.click(screen.getByTestId('worktree-merge-retry'))
    await waitFor(() => expect(mergeContinue).toHaveBeenCalledWith('c1', { stash: true }))
  })

  it('« Committer d’abord » : commit dans le dossier principal, puis fusion', async () => {
    const outcomes: MergeOutcome[] = [
      {
        status: 'main-dirty',
        root: '/repo',
        base: 'main',
        files: [{ path: 'notes.md', status: 'modified' }]
      },
      { status: 'merged', kind: 'merge', base: 'main' }
    ]
    const merge = vi.fn(async () => outcomes.shift() as MergeOutcome)
    const commitMain = vi.fn(async () => ({ hash: 'f00', short: 'f00' }))
    window.api.worktree = { ...window.api.worktree, merge, commitMain }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-commit'))
    expect((screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement).value).toBe(
      'docs: update notes.md\n\n- notes.md'
    )
    fireEvent.click(screen.getByTestId('main-dirty-commit-confirm'))
    await waitFor(() => screen.getByTestId('worktree-note'))
    expect(commitMain).toHaveBeenCalledWith('c1', {
      message: 'docs: update notes.md\n\n- notes.md',
      files: ['notes.md']
    })
    expect(merge).toHaveBeenLastCalledWith('c1')
  })

  it('erreur de git sur plusieurs lignes : montrée en entier', async () => {
    const merge = vi.fn(async () => {
      throw new Error(
        'La branche de base n’a pas pu avancer dans le dépôt principal : error: Your local changes to the following files would be overwritten by merge:\n  README.md\nPlease commit your changes or stash them before you merge.'
      )
    })
    window.api.worktree = { ...window.api.worktree, merge }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('worktree-error'))
    expect(text('worktree-error')).toContain('README.md\nPlease commit your changes')
    expect(screen.getByTestId('worktree-error').classList.contains('git-error')).toBe(true)
  })
})

describe('message de commit qui suit les cases cochées (0.11, D4)', () => {
  const Bar = ({ selected }: { selected: CommitFile[] }) => (
    <FolderCommitBar
      title="Un titre de conversation beaucoup trop long pour servir de sujet de commit"
      selected={selected}
      commit={async () => ({ hash: 'a1', short: 'a1' })}
      undo={async () => undefined}
      onChanged={() => {}}
    />
  )
  const both: CommitFile[] = [
    { path: 'README.md', status: 'modified' },
    { path: 'src/app.js', status: 'untracked' }
  ]
  const message = () => screen.getByTestId('changes-commit-message') as HTMLTextAreaElement

  it('décocher met le message à jour ; curseur à la fin', () => {
    const { rerender } = render(<Bar selected={both} />)
    fireEvent.click(screen.getByTestId('changes-commit'))
    expect(message().value).toBe(
      'feat: update README.md and app.js\n\n- README.md\n- src/app.js (new)'
    )
    expect(message().selectionStart).toBe(message().value.length)
    rerender(<Bar selected={[both[1] as CommitFile]} />)
    expect(message().value).toBe('feat: add app.js\n\n- src/app.js (new)')
    expect(message().value).not.toContain('README')
  })

  it('retouché à la main : le texte de l’utilisateur reste quand on coche ou décoche', () => {
    const { rerender } = render(<Bar selected={both} />)
    fireEvent.click(screen.getByTestId('changes-commit'))
    fireEvent.change(message(), { target: { value: 'docs: mon message' } })
    rerender(<Bar selected={[both[1] as CommitFile]} />)
    expect(message().value).toBe('docs: mon message')
  })
})
