import * as Tooltip from '@radix-ui/react-tooltip'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitChanges, GitFileDiff } from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
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
    // Démonter avant de rendre `window.api` d'origine : un rendu tardif relancerait sinon les
    // effets contre une API sans `changes` (le `cleanup` global passe après ce hook).
    cleanup()
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
    // Démonter avant de rendre `window.api` d'origine : un rendu tardif relancerait sinon les
    // effets contre une API sans `changes` (le `cleanup` global passe après ce hook).
    cleanup()
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

  it('un seul abonnement à « dépôt changé » : un nouveau rendu ne le défait ni ne le refait', async () => {
    // Relecture du 2026-11-19 : `cycle.refresh` changeait à chaque rendu, et l'abonnement IPC
    // était défait et refait à chaque rendu de l'onglet.
    const subscribed = vi.fn()
    const unsubscribed = vi.fn()
    window.api = {
      ...api,
      changes: {
        git: vi.fn(async () => REPO),
        gitFile: vi.fn(async () => ({ oldText: 'avant\n', newText: 'après\n' })),
        onGitChanged: () => {
          subscribed()
          return unsubscribed
        }
      },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
    const tab = (items: Parameters<typeof ChangesTab>[0]['items']) => (
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c"
          workspace="/depot"
          items={items}
          initialView="git"
          initialViewSeq={1}
        />
      </Tooltip.Provider>
    )
    const { rerender, unmount } = render(tab([]))
    await waitFor(() => expect(screen.getByTitle('gros.txt')).toBeTruthy())
    rerender(tab([]))
    // Un rendu de l'onglet né d'un changement d'état (diff déplié) : même abonnement.
    fireEvent.click(screen.getByTitle('gros.txt'))
    await waitFor(() => expect(screen.getByTestId('changes-diff').textContent).toContain('après'))
    rerender(tab([]))
    expect(subscribed).toHaveBeenCalledTimes(1)
    expect(unsubscribed).not.toHaveBeenCalled()
    unmount()
    expect(unsubscribed).toHaveBeenCalledTimes(1)
  })
})

describe('remarques du Code reviewer (fiche 265)', () => {
  const api = window.api
  const gitFile = vi.fn(async () => ({ oldText: 'a\n', newText: 'b\n' }))
  beforeEach(() => {
    localStorage.clear()
    window.api = {
      ...api,
      changes: { git: async () => REPO, gitFile },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
  })
  afterEach(() => {
    cleanup()
    window.api = api
    gitFile.mockClear()
  })

  const reviewOf = (authorId: string | undefined, reviewId: string): TranscriptItem =>
    ({
      kind: 'review',
      id: 1,
      reviewId,
      ...(authorId ? { authorId } : {}),
      title: 'Relecture',
      profileLabel: 'Factice',
      scope: 'uncommitted',
      files: 1,
      status: 'reported',
      findings: [
        {
          id: `${reviewId}:1`,
          file: 'gros.txt',
          line: 2,
          severity: 'high',
          category: 'correctness',
          title: `Remarque de ${reviewId}`,
          why: 'Parce que.',
          code: 'b'
        }
      ],
      at: 1
    }) as TranscriptItem

  it('un clic sur `fichier:ligne` ouvre ce fichier, une fois par demande (pas à chaque remontage)', async () => {
    const tab = () => (
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c-fichier"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
          initialFile={{ path: 'gros.txt' }}
        />
      </Tooltip.Provider>
    )
    const { unmount } = render(tab())
    await waitFor(() => expect(gitFile).toHaveBeenCalledWith('c-fichier', 'gros.txt', undefined))
    unmount()
    gitFile.mockClear()
    // Remonté (autre conversation, puis retour) avec la même demande : rien de rouvert.
    render(tab())
    await waitFor(() => expect(screen.getByTitle('gros.txt')).toBeTruthy())
    expect(gitFile).not.toHaveBeenCalled()
  })

  it('sa ligne, si le diff la contient : amenée à l’écran et mise en avant ; sinon le fichier ouvert', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const shown = (line: number) =>
      render(
        <Tooltip.Provider>
          <ChangesTab
            conversationId={`c-ligne-${line}`}
            workspace="/depot"
            items={[]}
            initialView="git"
            initialViewSeq={1}
            initialFile={{ path: 'gros.txt', line, endLine: line + 1 }}
          />
        </Tooltip.Provider>
      )
    const { unmount } = shown(1)
    const focused = await waitFor(() => {
      const row = document.querySelector('tr.diff-focus')
      if (!row) throw new Error('pas encore')
      return row
    })
    expect(focused.getAttribute('data-line')).toBe('1')
    expect(focused.getAttribute('data-side')).toBe('new')
    expect(scroll).toHaveBeenCalledWith({ block: 'center' })
    unmount()
    scroll.mockClear()
    // Ligne hors du diff : le fichier ouvert, rien de mis en avant.
    shown(40)
    await waitFor(() => expect(screen.getByTestId('changes-diff').textContent).toContain('b'))
    expect(document.querySelector('tr.diff-focus')).toBeNull()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('remarque d’une branche ou d’un commit relus : le diff depuis ce point, la ligne mise en avant', async () => {
    const since = vi.fn(async () => ({ oldText: 'a\n', newText: 'a\nb\nc\n' }))
    window.api = {
      ...window.api,
      changes: { git: async () => REPO, gitFile: since }
    } as unknown as Window['api']
    Element.prototype.scrollIntoView = vi.fn()
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c-branche"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
          initialFile={{ path: 'src/ordre.js', line: 2, endLine: 3, since: 'a3f2c1e0' }}
        />
      </Tooltip.Provider>
    )
    const block = await waitFor(() => screen.getByTestId('review-file-diff'))
    expect(since).toHaveBeenCalledWith('c-branche', 'src/ordre.js', undefined, 'a3f2c1e0')
    expect(block.textContent).toContain('src/ordre.js depuis a3f2c1e')
    await waitFor(() => expect(block.querySelectorAll('tr.diff-focus')).toHaveLength(2))
    expect(
      [...block.querySelectorAll('tr.diff-focus')].map((r) => r.getAttribute('data-line'))
    ).toEqual(['2', '3'])
  })

  it('remarques de diff : celles qui relisent cette conversation, pas un travail relu dans son fil', async () => {
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="mere"
          workspace="/depot"
          items={[reviewOf('b', 'r1'), reviewOf('mere', 'r2'), reviewOf(undefined, 'r3')]}
          initialView="git"
          initialViewSeq={1}
          onSendNotes={vi.fn()}
        />
      </Tooltip.Provider>
    )
    const notes = await waitFor(() => screen.getAllByTestId('review-note'))
    expect(notes.map((n) => n.dataset['id'])).toEqual(['r2:1', 'r3:1'])
  })
})
