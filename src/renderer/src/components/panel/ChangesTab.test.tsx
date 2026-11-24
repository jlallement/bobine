import * as Tooltip from '@radix-ui/react-tooltip'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { t } from 'i18next'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { GitChanges, GitFileDiff } from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import { resetDiffNotesCache, saveDiffNotes } from '../../diff-notes-store'
import { fileNoteKey } from '../../file-notes'
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
    // jsdom n'a pas `scrollIntoView` : remplacé le temps du test, rendu tel quel ensuite.
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    onTestFinished(() => {
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original)
      else delete (Element.prototype as Partial<Element>).scrollIntoView
    })
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
    // La classe est posée au rendu, l'appel vient de l'effet passif qui suit (`DiffView`) :
    // sous charge, React peut le jouer dans une tâche plus tard. On attend l'appel lui-même.
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'center' }))
    expect(scroll.mock.contexts[0]).toBe(focused)
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
    expect(since).toHaveBeenCalledWith(
      'c-branche',
      'src/ordre.js',
      undefined,
      'a3f2c1e0',
      undefined
    )
    expect(block.textContent).toContain('src/ordre.js depuis a3f2c1e')
    await waitFor(() => expect(block.querySelectorAll('tr.diff-focus')).toHaveLength(2))
    expect(
      [...block.querySelectorAll('tr.diff-focus')].map((r) => r.getAttribute('data-line'))
    ).toEqual(['2', '3'])
  })

  it('fiche 267 (N2) : portée commitée, le diff relu même corrigé depuis, et la vue le dit', async () => {
    const gitFile = vi.fn(async () => ({
      oldText: 'a\n',
      newText: 'a\nb\n',
      changedSince: true as const
    }))
    window.api = {
      ...window.api,
      changes: { git: async () => REPO, gitFile }
    } as unknown as Window['api']
    Element.prototype.scrollIntoView = vi.fn()
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c-relu"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
          initialFile={{
            path: 'src/storage.ts',
            line: 2,
            since: 'ffa5062000',
            until: 'db4a5e1000'
          }}
        />
      </Tooltip.Provider>
    )
    const block = await waitFor(() => screen.getByTestId('review-file-diff'))
    expect(gitFile).toHaveBeenCalledWith(
      'c-relu',
      'src/storage.ts',
      undefined,
      'ffa5062000',
      'db4a5e1000'
    )
    expect(block.textContent).toContain('src/storage.ts · version relue (ffa5062..db4a5e1)')
    await waitFor(() => screen.getByTestId('review-file-changed'))
    expect(block.querySelectorAll('tr.diff-focus')).toHaveLength(1)
    // « Voir la version actuelle » (revue UX) : le diff jusqu'au disque, puis retour.
    fireEvent.click(screen.getByTestId('review-file-toggle'))
    await waitFor(() =>
      expect(gitFile).toHaveBeenLastCalledWith(
        'c-relu',
        'src/storage.ts',
        undefined,
        'ffa5062000',
        undefined
      )
    )
    expect(screen.getByTestId('review-file-toggle').textContent).toBe('Revoir la version relue')
  })

  it('fiche 267, revue QA : plage relue introuvable, le fichier contre HEAD, et dit', async () => {
    window.api = {
      ...window.api,
      changes: {
        git: async () => ({ ...REPO, files: [] }),
        gitFile: vi.fn(async () => ({
          oldText: 'a\n',
          newText: 'b\n',
          rangeMissing: true as const
        }))
      }
    } as unknown as Window['api']
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c-perdu"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
          initialFile={{ path: 'a.ts', line: 1, since: 'ffa5062000', until: 'db4a5e1000' }}
        />
      </Tooltip.Provider>
    )
    await waitFor(() => screen.getByTestId('review-file-missing'))
    expect(screen.getByTestId('review-file-diff').textContent).toContain('a.ts depuis HEAD')
    expect(screen.queryByTestId('review-file-changed')).toBeNull()
    // La liste Git vide tient en une ligne sous le diff relu (revue UX).
    await waitFor(() => expect(screen.getByTestId('changes-empty').tagName).toBe('P'))
  })

  it('fiche 267 (N2) : avec du non commité relu, le diff est relu quand le dépôt change ; inchangé : dit', async () => {
    let content = 'a\n'
    const gitFile = vi.fn(async () => ({ oldText: 'a\n', newText: content }))
    let changed: ((change: { conversationIds: string[] }) => void) | undefined
    window.api = {
      ...window.api,
      changes: {
        git: async () => ({ ...REPO }),
        gitFile,
        onGitChanged: (listener: typeof changed) => {
          changed = listener
          return () => (changed = undefined)
        }
      }
    } as unknown as Window['api']
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c-sale"
          workspace="/depot"
          items={[]}
          initialView="git"
          initialViewSeq={1}
          initialFile={{ path: 'src/storage.ts', line: 1, since: 'ffa5062000' }}
        />
      </Tooltip.Provider>
    )
    // Rien de changé dans la portée : dit, avec les lignes citées mises en avant (revue UX).
    await waitFor(() => screen.getByTestId('review-file-unchanged'))
    expect(
      [...document.querySelectorAll('[data-testid=review-cited] tr.diff-focus')].map((r) =>
        r.getAttribute('data-line')
      )
    ).toEqual(['1'])
    expect(screen.getByTestId('review-cited').textContent).not.toMatch(/[+−]/)
    // Le correctif arrive (recette : +22 −8) : le dépôt est relu, le diff aussi.
    content = 'a\ncorrigé\n'
    act(() => changed?.({ conversationIds: ['c-sale'] }))
    await waitFor(() =>
      expect(screen.getByTestId('review-file-diff').textContent).toContain('corrigé')
    )
    expect(screen.queryByTestId('review-file-unchanged')).toBeNull()
  })

  it('« Demander de corriger » du panneau : le relecteur visé part avec, la carte le saura', async () => {
    const onSendNotes = vi.fn()
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c-envoi"
          workspace="/depot"
          items={[reviewOf('c-envoi', 'r9')]}
          initialView="git"
          initialViewSeq={1}
          onSendNotes={onSendNotes}
        />
      </Tooltip.Provider>
    )
    const send = await waitFor(() => screen.getByTestId('diff-notes-send'))
    expect(send.textContent).toBe('Demander de corriger')
    fireEvent.click(send)
    expect(onSendNotes).toHaveBeenCalledWith(expect.stringContaining('gros.txt'), 'r9')
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

describe('remarques sur des fichiers dans Modifications (3e revue, 4)', () => {
  const api = window.api
  beforeEach(() => {
    localStorage.clear()
    resetDiffNotesCache()
    saveDiffNotes('c', [
      {
        id: 'n1',
        view: 'file',
        file: fileNoteKey('/depot', 'src/a.ts'),
        path: 'src/a.ts',
        side: 'new',
        from: 7,
        to: 7,
        code: 'x',
        comment: 'Pourquoi ce nom ?'
      }
    ])
    window.api = {
      ...api,
      changes: { git: async () => REPO, gitFile: vi.fn() },
      fileTree: { roots: async () => [{ index: 0, name: 'depot', path: '/depot' }] },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
  })
  afterEach(() => {
    cleanup()
    window.api = api
    resetDiffNotesCache()
  })

  it('comptées et montrées : un clic ouvre le fichier à la ligne, la corbeille la retire', async () => {
    const onOpenFile = vi.fn()
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="c"
          workspace="/depot"
          items={[]}
          onSendNotes={() => {}}
          onOpenFile={onOpenFile}
        />
      </Tooltip.Provider>
    )
    const row = await waitFor(() => screen.getByTestId('files-note-elsewhere'))
    expect(row.textContent).toContain('Pourquoi ce nom ?')
    // Le fichier et sa ligne (une plage : `:9-12`).
    expect(row.querySelector('.files-note-orphan-path')?.textContent).toBe('src/a.ts:7')
    fireEvent.click(screen.getByTestId('files-note-elsewhere-open'))
    expect(onOpenFile).toHaveBeenCalledWith({ root: 0, path: 'src/a.ts', line: 7 })
    fireEvent.click(screen.getByTestId('files-note-elsewhere-delete'))
    await waitFor(() => expect(screen.queryByTestId('files-note-elsewhere')).toBeNull())
  })

  const tab = (props: Partial<Parameters<typeof ChangesTab>[0]> = {}) => (
    <Tooltip.Provider>
      <ChangesTab
        conversationId="c"
        workspace="/depot"
        items={[]}
        onSendNotes={() => {}}
        {...props}
      />
    </Tooltip.Provider>
  )

  it('sous un titre, comme les remarques de la relecture (4e revue, G3)', async () => {
    render(tab())
    const list = await waitFor(() => screen.getByTestId('changes-file-notes'))
    expect(list.querySelector('.review-notes-title')?.textContent).toContain(
      t('files.notesOnFiles')
    )
  })

  it('B retiré de [A, B, C] onglet ouvert : la remarque sur C ouvre C (4e revue, G1)', async () => {
    resetDiffNotesCache()
    saveDiffNotes('c', [
      {
        id: 'nc',
        view: 'file',
        file: fileNoteKey('/c', 'c.ts'),
        path: 'c.ts',
        side: 'new',
        from: 3,
        to: 3,
        code: 'x',
        comment: 'Sur C'
      }
    ])
    let paths = ['/a', '/b', '/c']
    window.api = {
      ...window.api,
      fileTree: { roots: async () => paths.map((path, index) => ({ index, name: path, path })) }
    } as unknown as Window['api']
    const onOpenFile = vi.fn()
    const { rerender } = render(tab({ onOpenFile, rootsKey: 'a b c' }))
    await waitFor(() => screen.getByTestId('files-note-elsewhere-open'))
    paths = ['/a', '/c']
    rerender(tab({ onOpenFile, rootsKey: 'a c' }))
    await act(async () => {})
    fireEvent.click(await waitFor(() => screen.getByTestId('files-note-elsewhere-open')))
    expect(onOpenFile).toHaveBeenLastCalledWith({ root: 1, path: 'c.ts', line: 3 })
  })

  it('dossiers illisibles : la remarque comptée reste montrée et supprimable (4e revue, G2)', async () => {
    window.api = {
      ...window.api,
      fileTree: { roots: async () => Promise.reject(new Error('boom')) }
    } as unknown as Window['api']
    render(tab({ onOpenFile: vi.fn() }))
    const row = await waitFor(() => screen.getByTestId('files-note-elsewhere'))
    expect(row.textContent).toContain('Pourquoi ce nom ?')
    expect(screen.queryByTestId('files-note-elsewhere-open')).toBeNull()
    fireEvent.click(screen.getByTestId('files-note-elsewhere-delete'))
    await waitFor(() => expect(screen.queryByTestId('files-note-elsewhere')).toBeNull())
  })
})

describe('onglet Modifications d’une discussion (fiche 276, T14)', () => {
  const api = window.api
  const git = vi.fn(async () => ({ ...REPO, files: [] }))
  beforeEach(() => {
    window.api = {
      ...api,
      changes: { git, gitFile: vi.fn() },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
  })
  afterEach(() => {
    cleanup()
    window.api = api
    git.mockClear()
  })

  it('ses documents, jamais l’état git ni « depuis le dernier commit »', async () => {
    render(
      <Tooltip.Provider>
        <ChangesTab conversationId="d" workspace="/documents" items={[]} discussion />
      </Tooltip.Provider>
    )
    const empty = await screen.findByTestId('changes-empty')
    expect(empty.textContent).toBe('L’agent n’a encore modifié aucun document de cette discussion.')
    expect(git).not.toHaveBeenCalled()
    expect(screen.queryByText('Git')).toBeNull()
  })

  it('espace Code : la vue Git et son texte, comme avant', async () => {
    render(
      <Tooltip.Provider>
        <ChangesTab conversationId="c" workspace="/depot" items={[]} />
      </Tooltip.Provider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('changes-empty').textContent).toBe(
        'Aucune modification depuis le dernier commit.'
      )
    )
    expect(git).toHaveBeenCalled()
  })
})

/**
 * Vue « Conversation » : ce que l'agent a modifié, et « Ouvrir » qui n'exécute rien. Remplaçant des
 * vérifications de composant des suites e2e `changes` (inventaire B, #3, #11) et `replay-changes`
 * (inventaire B, #6, #7). Le refus d'exécuter lui-même est choisi par le main
 * (`file-links.test.ts`) ; ici, la note que l'onglet en tire.
 */
describe('vue Conversation de l’onglet Modifications (fiches 021, 071, 272)', () => {
  const api = window.api
  const open = vi.fn()
  beforeEach(() => {
    open.mockReset()
    window.api = {
      ...api,
      changes: { git: async () => ({ ...REPO, files: [] }), gitFile: vi.fn(), open },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
  })
  afterEach(() => {
    cleanup()
    window.api = api
  })

  const edit = (id: number, path: string, oldText: string | null, newText: string) =>
    ({
      kind: 'tool',
      id,
      toolCallId: `t${id}`,
      title: 'Edit',
      toolKind: 'edit',
      status: 'completed',
      content: [{ type: 'diff', path, oldText, newText }],
      locations: []
    }) as TranscriptItem
  /** `write` d'OpenCode qui réécrit un fichier : abouti, sans diff (fiche 272). */
  const rewrite = (id: number, path: string) =>
    ({
      kind: 'tool',
      id,
      toolCallId: `t${id}`,
      title: 'write',
      toolKind: 'edit',
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'Wrote file successfully' } }],
      locations: [{ path }]
    }) as TranscriptItem

  // Une conversation neuve par essai : la vue choisie est retenue par conversation (fiche 185).
  let id = 0
  const show = (items: TranscriptItem[]) =>
    render(
      <Tooltip.Provider>
        <ChangesTab conversationId={`vue-${++id}`} workspace="/depot" items={items} />
      </Tooltip.Provider>
    )
  const names = () =>
    screen.getAllByTestId('changes-file').map((f) => f.querySelector('.changes-name')?.textContent)

  it('README.md puis src/app.js créé (« A »), dans l’ordre ; deux modifications, un seul fichier', async () => {
    show([
      edit(1, '/depot/README.md', '# Démo\n', '# Démo\nUn\n'),
      edit(2, '/depot/src/app.js', null, 'a\nb\nc\n'),
      edit(3, '/depot/README.md', '# Démo\nUn\n', '# Démo\nUn\nDeux\n')
    ])
    await waitFor(() => expect(names()).toEqual(['README.md', 'app.js']))
    const [readme, app] = screen.getAllByTestId('changes-file')
    expect(readme?.querySelector('.changes-badge')).toBeNull()
    expect(app?.querySelector('.changes-badge')?.textContent).toBe('A')
    expect(app?.querySelector('.changes-dir')?.textContent).toContain('src')
    expect(screen.getByTestId('changes-summary').textContent).toMatch(/2 fichiers/)
  })

  it('fichier réécrit sans diff : « modifié », sans totaux inventés, et pas d’« Annuler »', async () => {
    show([rewrite(1, '/depot/README.md'), edit(2, '/depot/a.txt', 'x\n', 'y\n')])
    await waitFor(() => expect(names()).toEqual(['README.md', 'a.txt']))
    const [readme, other] = screen.getAllByTestId('changes-file')
    expect(readme?.querySelector('.changes-stats')?.textContent).toBe('modifié')
    expect(readme?.textContent).not.toMatch(/\+0|−0/)
    expect(readme?.querySelector('[data-testid=changes-revert]')).toBeNull()
    // Un fichier avec son diff garde ses totaux et son « Annuler ».
    expect(other?.querySelector('.changes-stats')?.textContent).toBe('+1 −1')
    expect(other?.querySelector('[data-testid=changes-revert]')).toBeTruthy()
  })

  it('« Ouvrir » un exécutable : l’onglet dit pourquoi il a été montré plutôt qu’ouvert', async () => {
    open.mockResolvedValue({
      kind: 'revealed',
      path: '/depot/lancer.command',
      reason: 'executable'
    })
    show([edit(1, '/depot/lancer.command', null, 'echo hi\n')])
    await waitFor(() => expect(names()).toEqual(['lancer.command']))
    expect(screen.queryByTestId('changes-note')).toBeNull()
    fireEvent.click(screen.getByTestId('changes-open'))
    await waitFor(() => expect(open).toHaveBeenCalledWith(`vue-${id}`, '/depot/lancer.command'))
    expect((await screen.findByTestId('changes-note')).textContent).toContain('lancer.command')
    expect(screen.getByTestId('changes-note').textContent).toContain('peut s’exécuter')
  })

  it('« Ouvrir » un fichier ordinaire : ouvert, rien à dire', async () => {
    open.mockResolvedValue({ kind: 'opened', path: '/depot/README.md' })
    show([edit(1, '/depot/README.md', 'a\n', 'b\n')])
    await waitFor(() => expect(names()).toEqual(['README.md']))
    fireEvent.click(screen.getByTestId('changes-open'))
    await waitFor(() => expect(open).toHaveBeenCalled())
    expect(screen.queryByTestId('changes-note')).toBeNull()
  })
})

/** Vue Git d'une conversation en worktree : la barre du worktree, une case par fichier (fiche 110). */
describe('vue Git d’un worktree (fiche 110)', () => {
  const api = window.api
  afterEach(() => {
    cleanup()
    window.api = api
  })

  it('barre du worktree en tête, une case cochée par fichier modifié', async () => {
    window.api = {
      ...api,
      changes: {
        git: async () => ({
          root: '/depot/.worktrees/x',
          branch: 'bobine/x',
          files: [
            { path: 'README.md', status: 'modified', added: 1, removed: 0 },
            { path: 'notes.txt', status: 'untracked', added: 1, removed: 0 }
          ]
        }),
        gitFile: vi.fn()
      },
      worktree: {
        ...api.worktree,
        info: async () => ({
          title: 'x',
          branch: 'bobine/x',
          path: '/depot/.worktrees/x',
          root: '/depot',
          base: 'abc1234',
          baseShort: 'abc1234',
          baseBranch: 'main',
          dirtyAtStart: 1,
          dirty: 2,
          ahead: 0,
          behind: 0,
          commits: [],
          merged: false,
          pr: { ok: false, reason: 'noRemote' },
          noRemote: true
        })
      },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="wt"
          workspace="/depot/.worktrees/x"
          items={[]}
          initialView="git"
          initialViewSeq={1}
        />
      </Tooltip.Provider>
    )
    expect(await screen.findByTestId('worktree-bar')).toBeTruthy()
    expect(screen.getByTestId('worktree-dirty-at-start')).toBeTruthy()
    await waitFor(() => expect(screen.getAllByTestId('changes-check')).toHaveLength(2))
    expect(
      screen.getAllByTestId('changes-check').every((box) => (box as HTMLInputElement).checked)
    ).toBe(true)
    // Sans dépôt distant : ni « Ouvrir une PR » ni raison.
    expect(screen.queryByTestId('worktree-pr')).toBeNull()
    expect(screen.queryByTestId('worktree-pr-blocker')).toBeNull()
  })
})
