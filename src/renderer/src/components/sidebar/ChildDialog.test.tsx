/**
 * « Lancer en parallèle… » et dossier de la mère (fiche 240) : « Lancer » attend que le dossier
 * soit lu ; modifié, il attend le choix. Trouvé par la suite e2e complète sur `main` : un clic
 * rapide partait avant la lecture, ou tombait sur « Partir quand même » arrivé sous le pointeur.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { FolderDirty } from '@shared/launch-folder'
import { ARM_MS } from '../thread/useArmedCard'
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

const startChild = vi.fn()
let answer: (dirty: FolderDirty | null) => void = () => {}
beforeEach(() => {
  startChild.mockReset().mockResolvedValue({ id: 'f' })
  window.api.conversations = {
    view: vi.fn().mockResolvedValue({ snapshot: { controls: [] } }),
    startChild,
    // Lecture du dossier tenue par l'essai : il dit quand elle répond.
    childFolderDirty: vi.fn(() => new Promise<FolderDirty | null>((resolve) => (answer = resolve)))
  } as unknown as Window['api']['conversations']
})

function open() {
  render(<ChildDialog mother={mother} profiles={profiles} onClose={vi.fn()} />)
  fireEvent.change(screen.getByTestId('child-prompt'), { target: { value: 'Écris l’API' } })
  return screen.getByTestId('child-launch') as HTMLButtonElement
}

describe('« Lancer en parallèle… » et dossier de la mère (fiche 240)', () => {
  it('dossier pas encore lu : « Lancer » attend, rien ne part', async () => {
    const launch = open()
    expect(launch.disabled).toBe(true)
    fireEvent.click(launch)
    expect(startChild).not.toHaveBeenCalled()
    // Lu, propre : « Lancer » part.
    await act(async () => answer(null))
    expect(launch.disabled).toBe(false)
    await act(async () => void fireEvent.click(launch))
    expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API' })
  })

  it('dossier modifié : « Lancer » attend le choix ; le bloc s’arme avant de compter un clic', async () => {
    vi.useFakeTimers()
    try {
      const launch = open()
      await act(async () => answer(DIRTY))
      expect(launch.disabled).toBe(true)
      const block = screen.getByTestId('launch-dirty')
      expect(block.hasAttribute('data-armed')).toBe(false)
      act(() => vi.advanceTimersByTime(ARM_MS))
      expect(block.hasAttribute('data-armed')).toBe(true)
      await act(async () => void fireEvent.click(screen.getByTestId('launch-dirty-anyway')))
      expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API', uncommitted: 'anyway' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('fiche 244 : un fichier décoché ne part pas ; la fille part sans lui', async () => {
    const commitForChildren = vi.fn(async () => ({ hash: 'abc1234def', short: 'abc1234' }))
    window.api.conversations = { ...window.api.conversations, commitForChildren }
    const launch = open()
    await act(async () =>
      answer({
        ...DIRTY,
        count: 2,
        files: [...DIRTY.files, { path: '.env', status: 'untracked' }]
      })
    )
    expect(launch.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('launch-dirty-commit'))
    fireEvent.click(
      screen
        .getAllByTestId('launch-dirty-commit-file')
        .find((li) => li.dataset.path === '.env')
        ?.querySelector('input') as HTMLInputElement
    )
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-dirty-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    const confirm = screen.getByTestId('launch-dirty-commit-confirm')
    // La relecture du dossier après le commit : le .env reste.
    await act(async () => void fireEvent.click(confirm))
    await act(async () =>
      answer({ ...DIRTY, count: 1, files: [{ path: '.env', status: 'untracked' }] })
    )
    expect(commitForChildren).toHaveBeenCalledWith('m', {
      message: expect.not.stringContaining('.env'),
      files: ['README.md']
    })
    expect(startChild).toHaveBeenCalledWith('m', { text: 'Écris l’API', uncommitted: 'anyway' })
  })
})
