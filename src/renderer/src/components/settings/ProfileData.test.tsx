import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackupCheck, TrashEntry } from '@shared/profile'
import { RestoreRow, TrashList } from './ProfileData'

const originalApi = window.api
afterEach(() => {
  window.api = originalApi
})

const entry = (id: string, workspace: string, space?: 'discussion'): TrashEntry => ({
  id,
  title: `Titre ${id}`,
  workspace,
  ...(space ? { space } : {}),
  deletedAt: new Date().toISOString(),
  erasedAt: new Date(Date.now() + 10 * 86_400_000).toISOString()
})

describe('corbeille (fiche 196)', () => {
  it('une discussion (fiche 224) : « Discussion », jamais le nom de son dossier', async () => {
    const entries = [
      entry('d', '/data/discussions/3973c57d-c6ab', 'discussion'),
      entry('c', '/Users/ada/carnet')
    ]
    window.api = {
      ...originalApi,
      profile: { trash: async () => entries }
    } as unknown as Window['api']
    render(<TrashList readOnly={false} />)
    const rows = await screen.findAllByTestId('trash-item')
    expect(rows[0]?.textContent).toMatch(/^Titre dDiscussion · /)
    expect(rows[0]?.textContent).not.toContain('3973c57d')
    expect(rows[1]?.textContent).toContain('carnet · ')
  })

  it('la mère dit les travaux supprimés avec elle, qui reviendront avec elle (recette rc.4, T7)', async () => {
    const entries = [
      { ...entry('m', '/Users/ada/carnet'), children: 2 },
      { ...entry('u', '/Users/ada/carnet'), children: 1 },
      entry('f', '/Users/ada/carnet')
    ]
    window.api = {
      ...originalApi,
      profile: { trash: async () => entries }
    } as unknown as Window['api']
    render(<TrashList readOnly={false} />)
    const rows = await screen.findAllByTestId('trash-item')
    expect(rows[0]?.querySelector('[data-testid=trash-children]')?.textContent).toBe(
      'avec ses 2 travaux'
    )
    expect(rows[1]?.querySelector('[data-testid=trash-children]')?.textContent).toBe(
      'avec son travail'
    )
    expect(rows[2]?.querySelector('[data-testid=trash-children]')).toBeNull()
  })
})

/**
 * Restaurer une sauvegarde (fiche 197) : remplace les vérifications de composant de l'e2e `profil`
 * (n° 18, 19, 21). La reconnaissance d'une sauvegarde est dans `backup.test.ts` (main) ; Échap pris
 * par la carte dans la vraie fenêtre des Réglages, dans `SettingsKeys.test.tsx`.
 */
describe('restaurer une sauvegarde (fiche 197)', () => {
  const plain = (el: HTMLElement) => (el.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ')
  const withBackup = (check: BackupCheck) => {
    const restoreBackup = vi.fn(async () => undefined)
    window.api = {
      ...originalApi,
      profile: { chooseBackup: async () => check, restoreBackup }
    } as unknown as Window['api']
    return restoreBackup
  }
  const choose = async () => {
    render(<RestoreRow readOnly={false} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-restore'))
    })
  }
  const BACKUP: BackupCheck = {
    ok: true,
    folder: '/Users/ada/bobine-sauvegarde-2026-11-20',
    createdAt: '2026-11-20T10:00:00.000Z',
    conversations: 4,
    currentConversations: 7
  }

  it('un dossier qui n’est pas une sauvegarde : refusé, en clair, sans confirmation', async () => {
    withBackup({ ok: false, reason: 'notBackup' })
    await choose()
    expect(plain(screen.getByTestId('settings-restore-refused'))).toContain(
      'Ce dossier n’est pas une sauvegarde de Bobine.'
    )
    expect(screen.queryByTestId('settings-restore-confirm')).toBeNull()
  })

  it('confirmation dans la carte : ce qui sera remplacé, gardé à côté, clés à ressaisir', async () => {
    const restoreBackup = withBackup(BACKUP)
    await choose()
    const card = plain(screen.getByTestId('settings-restore-confirm'))
    expect(card).toContain('(4 conversations) ?')
    expect(card).toContain('Vos 7 conversations et vos réglages actuels seront remplacés.')
    expect(card).toContain('Ils sont d’abord gardés à côté')
    expect(card).toContain('il faudra les ressaisir')
    expect(restoreBackup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('settings-restore-go'))
    expect(restoreBackup).toHaveBeenCalledWith(BACKUP.folder)
  })

  it('Échap referme la confirmation : aucune restauration demandée', async () => {
    const restoreBackup = withBackup(BACKUP)
    await choose()
    const card = screen.getByTestId('settings-restore-confirm')
    // « Annuler » a le focus : Échap part de la carte.
    expect(card.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(screen.queryByTestId('settings-restore-confirm')).toBeNull()
    expect(restoreBackup).not.toHaveBeenCalled()
  })
})
