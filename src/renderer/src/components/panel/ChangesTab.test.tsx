import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitChanges, GitFileDiff } from '@shared/changes'
import { ChangesTab } from './ChangesTab'

/** Réponse de `gitFile` tenue en main : le diff arrive quand le test le décide. */
function deferred() {
  let resolve: (diff: GitFileDiff) => void = () => {}
  const promise = new Promise<GitFileDiff>((r) => (resolve = r))
  return { promise, resolve }
}

const REPO: GitChanges = {
  root: '/depot',
  branch: 'main',
  files: [{ path: 'gros.txt', status: 'modified', added: 20000, removed: 20000 }]
}

describe('vue Git de l’onglet Modifications : diff déplié et dépôt relu (0.11, M2)', () => {
  const api = window.api
  let answers: ReturnType<typeof deferred>[]
  const gitFile = vi.fn(() => {
    const answer = deferred()
    answers.push(answer)
    return answer.promise
  })
  beforeEach(() => {
    answers = []
    window.api = {
      ...api,
      changes: { git: async () => REPO, gitFile },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
  })
  afterEach(() => {
    window.api = api
    gitFile.mockClear()
  })

  it('relu pendant le chargement : le diff est relu et affiché, la réponse d’avant jetée', async () => {
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
        />
      </Tooltip.Provider>
    )
    const toggle = await waitFor(() => screen.getByTitle('gros.txt'))
    fireEvent.click(toggle)
    await waitFor(() => expect(gitFile).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('changes-diff').textContent).toContain('Chargement…')

    // L'agent écrit un autre fichier : le dépôt est relu pendant que le gros diff se charge.
    fireEvent.click(screen.getByLabelText('Actualiser'))
    // Le fichier toujours déplié : son diff est redemandé pour le nouvel état du dépôt.
    await waitFor(() => expect(gitFile).toHaveBeenCalledTimes(2))
    // La réponse d'avant arrive après la relecture : jetée (elle peut être périmée).
    await act(async () => answers[0]?.resolve({ oldText: 'avant\n', newText: 'périmé\n' }))
    expect(screen.getByTestId('changes-diff').textContent).toContain('Chargement…')
    await act(async () => answers[1]?.resolve({ oldText: 'avant\n', newText: 'à jour\n' }))
    await waitFor(() => expect(screen.getByTestId('changes-diff').textContent).toContain('à jour'))
    expect(screen.getByTestId('changes-diff').textContent).not.toContain('périmé')

    // Relu une fois le diff affiché : relu de nouveau, sans rester sur « Chargement… ».
    fireEvent.click(screen.getByLabelText('Actualiser'))
    await waitFor(() => expect(gitFile).toHaveBeenCalledTimes(3))
    await act(async () => answers[2]?.resolve({ oldText: 'avant\n', newText: 'encore\n' }))
    await waitFor(() => expect(screen.getByTestId('changes-diff').textContent).toContain('encore'))
  })
})

describe('vue Git relue après un commit fait hors du panneau (fiche 246, D4)', () => {
  const api = window.api
  afterEach(() => {
    window.api = api
  })

  it('« Committer puis fusionner » depuis la carte du fil : la vue se relit, sans « Actualiser »', async () => {
    let repo: GitChanges = {
      root: '/depot',
      branch: 'main',
      files: [
        { path: 'a.txt', status: 'modified', added: 1, removed: 0 },
        { path: 'b.txt', status: 'untracked', added: 1, removed: 0 }
      ]
    }
    const git = vi.fn(async () => repo)
    let changed: ((change: { conversationIds: string[] }) => void) | undefined
    window.api = {
      ...api,
      changes: {
        git,
        gitFile: vi.fn(),
        onGitChanged: (listener: typeof changed) => {
          changed = listener
          return () => (changed = undefined)
        }
      },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
        />
      </Tooltip.Provider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('changes-commit').textContent).toBe('Committer (2)')
    )
    // Le commit et la fusion se font ailleurs (carte « Sous-tâches ») : le dépôt est propre.
    repo = { ...repo, files: [] }
    // Une autre conversation, d'un autre dépôt : rien n'est relu.
    act(() => changed?.({ conversationIds: ['autre'] }))
    expect(git).toHaveBeenCalledTimes(1)
    act(() => changed?.({ conversationIds: ['autre', 'c'] }))
    await waitFor(() => expect(screen.queryByTestId('changes-commit')).toBeNull())
    expect(git).toHaveBeenCalledTimes(2)
  })
})
