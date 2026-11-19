/**
 * « Lancer en parallèle… » et dossier de la mère (fiches 240, 262) : « Lancer » attend que le
 * dossier soit lu (un clic rapide partirait sans le choix affiché) ; modifié, une ligne discrète
 * le dit et « Lancer » part sans elles, choix porté par la requête ; « Changer… » propose de
 * committer d'abord. Dépôt sans commit : la fille travaillera dans le dossier.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { FolderDirty, LaunchFolderState } from '@shared/launch-folder'
import { ChildDialog } from './ChildDialog'

const mother: ConversationSummary = {
  id: 'm',
  title: 'Carnet',
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: '/depot',
  updatedAt: '2026-11-18T00:00:00Z',
  status: 'ready',
  draft: false
}
const profiles = [{ id: 'mock', label: 'Factice', available: true }] as ProfileSummary[]
const DIRTY: FolderDirty = {
  count: 1,
  files: [{ path: 'README.md', status: 'modified' }],
  commit: '68a62b5'
}

const at = (dirty?: FolderDirty, head = '68a62b5aa'): LaunchFolderState => ({
  place: 'worktree',
  root: '/depot',
  head,
  ...(dirty ? { dirty } : {})
})

const startChild = vi.fn()
let answer: (state: LaunchFolderState | null) => void = () => {}
beforeEach(() => {
  startChild.mockReset().mockResolvedValue({ id: 'f' })
  window.api.conversations = {
    view: vi.fn().mockResolvedValue({ snapshot: { controls: [] } }),
    startChild,
    // Lecture du dossier tenue par l'essai : il dit quand elle répond.
    childFolder: vi.fn(() => new Promise<LaunchFolderState | null>((resolve) => (answer = resolve)))
  } as unknown as Window['api']['conversations']
})

function open() {
  render(<ChildDialog mother={mother} profiles={profiles} onClose={vi.fn()} />)
  fireEvent.change(screen.getByTestId('child-prompt'), { target: { value: 'Écris l’API' } })
  return screen.getByTestId('child-launch') as HTMLButtonElement
}

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

describe('« Lancer en parallèle… » et dossier de la mère (fiches 240, 262)', () => {
  it('dossier pas encore lu : « Lancer » attend, rien ne part', async () => {
    const launch = open()
    expect(launch.disabled).toBe(true)
    fireEvent.click(launch)
    expect(startChild).not.toHaveBeenCalled()
    // Lu, propre : « Lancer » part.
    await act(async () => answer(at()))
    expect(launch.disabled).toBe(false)
    // Propre : rien à dire.
    expect(screen.queryByTestId('launch-line')).toBeNull()
    await act(async () => void fireEvent.click(launch))
    expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API' })
  })

  it('dossier modifié : une ligne, pas d’encadré ; « Lancer » part sans elles, dit', async () => {
    const launch = open()
    await act(async () => answer(at(DIRTY)))
    // Une ligne, et son seul bouton « Changer… » : pas d'encadré à boutons.
    const place = screen.getByTestId('child-launch-place')
    expect([...place.querySelectorAll('button')].map((b) => b.dataset.testid)).toEqual([
      'launch-line-change'
    ])
    expect(plain(screen.getByTestId('launch-line').textContent)).toBe(
      'Partira du dernier commit, sans votre modification'
    )
    expect(screen.getByTestId('launch-line-change').getAttribute('aria-label')).toBe(
      'Changer où partira ce travail'
    )
    expect(launch.disabled).toBe(false)
    await act(async () => void fireEvent.click(launch))
    expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API', uncommitted: 'anyway' })
  })

  it('dépôt sans commit : la fille travaillera dans ce dossier ; rien à choisir', async () => {
    const launch = open()
    await act(async () => answer({ place: 'here', reason: 'noCommit' }))
    expect(plain(screen.getByTestId('launch-line').textContent)).toBe(
      'Ce dépôt n’a pas encore de commit : ce travail se fera dans ce dossier, en même temps que l’agent, sans branche ni rien à fusionner'
    )
    await act(async () => void fireEvent.click(launch))
    expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API' })
  })

  it('fiche 244 : un fichier décoché ne part pas ; la fille part sans lui', async () => {
    const commitForChildren = vi.fn(async () => ({ hash: 'abc1234def', short: 'abc1234' }))
    window.api.conversations = { ...window.api.conversations, commitForChildren }
    const launch = open()
    await act(async () =>
      answer(
        at({
          ...DIRTY,
          count: 2,
          files: [...DIRTY.files, { path: '.env', status: 'untracked' }]
        })
      )
    )
    fireEvent.pointerDown(screen.getByTestId('launch-line-change'), { button: 0, ctrlKey: false })
    await act(async () => void fireEvent.click(await screen.findByTestId('launch-line-commit')))
    // Commit ouvert : « Lancer » attend.
    expect(launch.disabled).toBe(true)
    fireEvent.click(
      screen
        .getAllByTestId('launch-line-commit-file')
        .find((li) => li.dataset.path === '.env')
        ?.querySelector('input') as HTMLInputElement
    )
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    const confirm = screen.getByTestId('launch-line-commit-confirm')
    // La relecture du dossier après le commit : le .env reste.
    await act(async () => void fireEvent.click(confirm))
    await act(async () =>
      answer(at({ ...DIRTY, count: 1, files: [{ path: '.env', status: 'untracked' }] }, 'abc1234'))
    )
    expect(commitForChildren).toHaveBeenCalledWith('m', {
      message: expect.not.stringContaining('.env'),
      files: ['README.md']
    })
    expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API', uncommitted: 'anyway' })
  })
})
