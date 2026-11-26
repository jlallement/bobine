import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommitFile, MergeOutcome, WorktreeCycleView } from '@shared/worktree-cycle'
import { FolderCommitBar } from './FolderCommitBar'
import { WorktreeBar } from './WorktreeBar'

const text = (id: string) => screen.getByTestId(id).textContent
/** Fiche 246 : la proposition arrive du main (ici le repli, réglage coupé) ; le champ s'ouvre. */
const settled = (testid: string) =>
  waitFor(() =>
    expect((screen.getByTestId(`${testid}-message`) as HTMLTextAreaElement).disabled).toBe(false)
  )
const uncheck = (prefix: string, path: string) =>
  fireEvent.click(
    screen
      .getAllByTestId(`${prefix}-file`)
      .find((li) => li.dataset.path === path)
      ?.querySelector('input') as HTMLInputElement
  )

describe('« Committer » hors worktree (fiche 123)', () => {
  const setup = (selected: CommitFile[] = [{ path: 'README.md', status: 'modified' }]) => {
    const commit = vi.fn(async () => ({ hash: 'a1b2c3d4e5', short: 'a1b2c3d' }))
    const undo = vi.fn(async () => undefined)
    const onChanged = vi.fn()
    render(
      <FolderCommitBar
        conversationId="c1"
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
    await settled('changes-commit')
    const message = screen.getByTestId('changes-commit-message') as HTMLTextAreaElement
    expect(message.value).toBe(
      'chore: update README.md and app.js\n\n- README.md\n- src/app.js (new)'
    )
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
    window.api.worktree = { ...window.api.worktree, merge }
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
    window.api.worktree = { ...window.api.worktree, merge }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-commit'))
    await settled('main-dirty-commit')
    expect((screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement).value).toBe(
      'docs: update notes.md\n\n- notes.md'
    )
    fireEvent.click(screen.getByTestId('main-dirty-commit-confirm'))
    await waitFor(() => screen.getByTestId('worktree-note'))
    // Fiche 287 : un seul appel, le commit avec la fusion (le main committe après ses refus).
    expect(merge).toHaveBeenLastCalledWith('c1', {
      commit: { message: 'docs: update notes.md\n\n- notes.md', files: ['notes.md'] }
    })
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

  it('fiche 244 : liste complète à cocher ; le .env décoché ne part pas, il est mis de côté', async () => {
    const files = [
      { path: 'notes.md', status: 'modified' as const },
      { path: '.env', status: 'untracked' as const },
      { path: 'src/app.js', status: 'untracked' as const }
    ]
    const outcomes: MergeOutcome[] = [
      { status: 'main-dirty', root: '/repo', base: 'main', files },
      { status: 'merged', kind: 'merge', base: 'main', stash: { restored: true, count: 1 } }
    ]
    const merge = vi.fn(async () => outcomes.shift() as MergeOutcome)
    window.api.worktree = { ...window.api.worktree, merge }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-commit'))
    expect(screen.getAllByTestId('main-dirty-commit-file').map((li) => li.dataset.path)).toEqual(
      files.map((f) => f.path)
    )
    await settled('main-dirty-commit')
    uncheck('main-dirty-commit', '.env')
    const message = (screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement).value
    expect(message).not.toContain('.env')
    expect(text('main-dirty-commit-left')).toBe(
      '1 fichier décoché reste non commité\u00a0: mis de côté le temps de la fusion, puis remis.'
    )
    fireEvent.click(screen.getByTestId('main-dirty-commit-confirm'))
    await waitFor(() => screen.getByTestId('worktree-note'))
    expect(merge).toHaveBeenLastCalledWith('c1', {
      stash: true,
      commit: { message, files: ['notes.md', 'src/app.js'] }
    })
    expect(text('worktree-note')).toBe(
      'Fusionné dans main (commit de fusion). Votre modification mise de côté est revenue.'
    )
  })

  it('fiche 244 : remise du .env en conflit, il reste dans git stash, et c’est dit', async () => {
    const files = [
      { path: 'notes.md', status: 'modified' as const },
      { path: '.env', status: 'untracked' as const }
    ]
    const outcomes: MergeOutcome[] = [
      { status: 'main-dirty', root: '/repo', base: 'main', files },
      {
        status: 'merged',
        kind: 'merge',
        base: 'main',
        stash: { restored: false, count: 1, ref: 'abc1234', conflicts: ['.env'] }
      }
    ]
    const merge = vi.fn(async () => outcomes.shift() as MergeOutcome)
    window.api.worktree = { ...window.api.worktree, merge }
    render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-commit'))
    await settled('main-dirty-commit')
    uncheck('main-dirty-commit', '.env')
    fireEvent.click(screen.getByTestId('main-dirty-commit-confirm'))
    await waitFor(() => screen.getByTestId('worktree-note'))
    expect(merge).toHaveBeenLastCalledWith('c1', expect.objectContaining({ stash: true }))
    expect(text('worktree-note')).toBe(
      'Fusionné dans main (commit de fusion). Vos modifications mises de côté n’ont pas pu revenir sans conflit (.env)\u00a0: elles restent dans git stash (abc1234).'
    )
  })
})

describe('message de commit qui suit les cases cochées (0.11, D4)', () => {
  const Bar = ({ selected }: { selected: CommitFile[] }) => (
    <FolderCommitBar
      conversationId="c1"
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

  it('décocher met le message à jour ; curseur à la fin', async () => {
    const { rerender } = render(<Bar selected={both} />)
    fireEvent.click(screen.getByTestId('changes-commit'))
    await settled('changes-commit')
    expect(message().value).toBe(
      'chore: update README.md and app.js\n\n- README.md\n- src/app.js (new)'
    )
    expect(message().selectionStart).toBe(message().value.length)
    rerender(<Bar selected={[both[1] as CommitFile]} />)
    expect(message().value).toBe('chore: add app.js\n\n- src/app.js (new)')
    expect(message().value).not.toContain('README')
  })

  it('retouché à la main : le texte de l’utilisateur reste quand on coche ou décoche', async () => {
    const { rerender } = render(<Bar selected={both} />)
    fireEvent.click(screen.getByTestId('changes-commit'))
    await settled('changes-commit')
    fireEvent.change(message(), { target: { value: 'docs: mon message' } })
    rerender(<Bar selected={[both[1] as CommitFile]} />)
    expect(message().value).toBe('docs: mon message')
  })
})
