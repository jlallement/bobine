import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrphanWorktree } from '@shared/worktree-cycle'
import { OrphanWorktrees } from './OrphanWorktrees'

/**
 * Réglages › Données › Worktrees orphelins (fiches 110, 126) : remplace les vérifications de
 * composant de l'e2e `worktree-cycle` (n° 17, 18). La détection et la suppression réelles (dossier,
 * branche) sont dans `worktree-ipc.test.ts` (main).
 */

const ORPHAN: OrphanWorktree = {
  root: '/projets/demo',
  path: '/projets/demo/.bobine/worktrees/essai',
  branch: 'bobine/essai',
  dirty: 2,
  ahead: 1
}

/** Texte affiché, insécables de la typographie française ramenées à des espaces. */
const plain = (el: HTMLElement) => (el.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')

const api = window.api
let orphans: ReturnType<typeof vi.fn>
let removeOrphan: ReturnType<typeof vi.fn>
/** L'évènement du main « corbeille changée » (fiche 228). */
let orphansChanged: (() => void) | undefined

beforeEach(() => {
  orphans = vi.fn(async () => [ORPHAN])
  removeOrphan = vi.fn(async () => [])
  orphansChanged = undefined
  const onOrphansChanged = (listener: () => void) => {
    orphansChanged = listener
    return () => (orphansChanged = undefined)
  }
  Object.assign(window, {
    api: { ...api, worktree: { ...api.worktree, orphans, removeOrphan, onOrphansChanged } }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

describe('Réglages › Données : worktrees orphelins (fiche 110)', () => {
  it('orphelin listé : sa branche, ce qu’il contient, le chemin en infobulle', async () => {
    render(<OrphanWorktrees />)
    const list = await screen.findByTestId('orphans')
    expect(list.textContent).toContain('bobine/essai')
    expect(list.textContent).toContain('2 fichiers non commités · 1 commit non fusionné')
    expect(list.querySelector(`[title="${ORPHAN.path}"]`)).toBeTruthy()
  })

  it('« Nettoyer » : rien n’est supprimé avant la confirmation, qui dit ce qui sera perdu', async () => {
    render(<OrphanWorktrees />)
    fireEvent.click(await screen.findByTestId('orphans-clean'))
    expect(removeOrphan).not.toHaveBeenCalled()
    expect(plain(screen.getByTestId('confirm-row'))).toContain(
      'Perdu avec eux : 2 fichiers non commités · 1 commit non fusionné'
    )
    fireEvent.click(screen.getByTestId('confirm-row-keep'))
    expect(removeOrphan).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('orphans-clean'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    })
    expect(removeOrphan).toHaveBeenCalledWith(ORPHAN)
    expect(screen.getByTestId('orphans-none')).toBeTruthy()
  })

  it('corbeille changée (restauration…) : la liste est relue sans ⟳ (chasse rc.5)', async () => {
    const { unmount } = render(<OrphanWorktrees />)
    await screen.findByTestId('orphans')
    orphans.mockResolvedValue([])
    await act(async () => orphansChanged?.())
    expect(screen.getByTestId('orphans-none')).toBeTruthy()
    unmount()
    expect(orphansChanged).toBeUndefined()
  })

  it('« Nettoyer » refusé par le main (worktree tenu entre-temps) : erreur dite, liste relue', async () => {
    removeOrphan.mockRejectedValue(new Error('Ce worktree sert encore à une conversation'))
    render(<OrphanWorktrees />)
    fireEvent.click(await screen.findByTestId('orphans-clean'))
    orphans.mockResolvedValue([])
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    })
    expect(screen.getByText(/sert encore à une conversation/)).toBeTruthy()
    expect(screen.getByTestId('orphans-none')).toBeTruthy()
  })

  it('aucun orphelin : « Aucun. »', async () => {
    orphans.mockResolvedValue([])
    render(<OrphanWorktrees />)
    expect((await screen.findByTestId('orphans-none')).textContent).toBe('Aucun.')
  })
})
