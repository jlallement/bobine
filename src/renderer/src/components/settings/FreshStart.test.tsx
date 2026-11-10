import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FreshStartInfo, ResetPlan } from '@shared/fresh-start'
import { forgetFreshStart } from '../../fresh-start'
import { FreshStartCard, TemporaryProfileChip } from './FreshStart'

const original = window.api
const PLAN: ResetPlan = {
  items: [
    { kind: 'conversations', bytes: 412 * 1024 * 1024, count: 128 },
    { kind: 'settings', bytes: 48 * 1024 },
    { kind: 'usage', bytes: 2_200_000 },
    { kind: 'browser', bytes: 86 * 1024 * 1024 },
    { kind: 'other', bytes: 31 * 1024 * 1024 }
  ],
  keychain: true,
  canUninstall: true
}
let api: Record<string, ReturnType<typeof vi.fn>>

function mount(info: Partial<FreshStartInfo> = {}, plan: ResetPlan = PLAN) {
  api = {
    getInfo: vi.fn(async () => ({ freshStart: { temporary: false, askReset: false, ...info } })),
    resetPlan: vi.fn(async () => plan),
    reset: vi.fn(async () => undefined),
    openTemporaryProfile: vi.fn(async () => undefined)
  }
  window.api = { ...original, app: { ...original?.app, ...api } } as unknown as Window['api']
}

beforeEach(() => forgetFreshStart())
afterEach(() => {
  window.api = original
})

describe('Réglages › Données › Recommencer à neuf (fiche 148)', () => {
  it('« Ouvrir » lance la seconde Bobine, agents neufs si la case est cochée', async () => {
    mount()
    render(<FreshStartCard />)
    await screen.findByTestId('fresh-start-card')
    await act(async () => fireEvent.click(screen.getByTestId('fresh-start-open')))
    expect(api['openTemporaryProfile']).toHaveBeenLastCalledWith(false)
    expect(screen.getByTestId('fresh-start-note').textContent).toContain('profil temporaire')
    fireEvent.click(screen.getByTestId('fresh-start-agents'))
    await act(async () => fireEvent.click(screen.getByTestId('fresh-start-open')))
    expect(api['openTemporaryProfile']).toHaveBeenLastCalledWith(true)
  })

  it('« Réinitialiser… » : ce qui part, avec les tailles, ce qui reste ; « Garder » n’efface rien', async () => {
    mount()
    render(<FreshStartCard />)
    fireEvent.click(await screen.findByTestId('fresh-start-reset'))
    const trash = await screen.findByTestId('fresh-start-trash')
    // Les tailles viennent d'Intl : espaces insécables ramenés à des espaces.
    expect(
      [...trash.querySelectorAll('li')].map((li) => li.textContent?.replace(/\s/g, ' '))
    ).toEqual([
      'Conversations128 · 412 Mo',
      'Réglages, clés d’API, sites autorisés48 ko',
      'Journal de consommation2,1 Mo',
      'Cookies et données du navigateur86 Mo',
      'Journaux, cache et le reste31 Mo'
    ])
    expect(screen.getByText(/Bobine Safe Storage/)).toBeTruthy()
    expect(screen.getByTestId('fresh-start-keep').textContent).toContain('L’app Bobine')
    expect(screen.getByTestId('fresh-start-confirm-reset').textContent).toBe(
      'Tout effacer et redémarrer'
    )
    fireEvent.click(screen.getByTestId('confirm-row-keep'))
    expect(screen.queryByTestId('fresh-start-confirm')).toBeNull()
    expect(api['reset']).not.toHaveBeenCalled()
  })

  it('désinstaller : l’app passe du côté corbeille, le bouton le dit, puis confirmé', async () => {
    mount()
    render(<FreshStartCard />)
    fireEvent.click(await screen.findByTestId('fresh-start-reset'))
    fireEvent.click(await screen.findByTestId('fresh-start-uninstall'))
    expect(screen.getByTestId('fresh-start-trash').textContent).toContain('L’app Bobine')
    expect(screen.getByTestId('fresh-start-keep').textContent).not.toContain('L’app Bobine')
    expect(screen.getByTestId('fresh-start-confirm-reset').textContent).toBe(
      'Tout effacer et désinstaller'
    )
    await act(async () => fireEvent.click(screen.getByTestId('fresh-start-confirm-reset')))
    expect(api['reset']).toHaveBeenCalledWith(true)
  })

  it('app non installée (développement) : pas de case, Bobine se ferme sans relance', async () => {
    mount({}, { ...PLAN, canUninstall: false, keychain: false })
    render(<FreshStartCard />)
    fireEvent.click(await screen.findByTestId('fresh-start-reset'))
    await screen.findByTestId('fresh-start-trash')
    expect(screen.queryByTestId('fresh-start-uninstall')).toBeNull()
    expect(screen.queryByText(/Bobine Safe Storage/)).toBeNull()
    expect(screen.getByTestId('fresh-start-confirm-reset').textContent).toBe(
      'Tout effacer et fermer'
    )
    await act(async () => fireEvent.click(screen.getByTestId('fresh-start-confirm-reset')))
    expect(api['reset']).toHaveBeenCalledWith(false)
  })

  it('--reinitialiser : la confirmation s’ouvre d’elle-même, une seule fois', async () => {
    mount({ askReset: true })
    const { unmount } = render(<FreshStartCard />)
    await screen.findByTestId('fresh-start-confirm')
    unmount()
    render(<FreshStartCard />)
    await screen.findByTestId('fresh-start-card')
    expect(screen.queryByTestId('fresh-start-confirm')).toBeNull()
  })

  it('profil temporaire : pas de section, une pastille dans la barre de titre', async () => {
    mount({ temporary: true })
    render(
      <>
        <FreshStartCard />
        <TemporaryProfileChip />
      </>
    )
    await waitFor(() => expect(screen.getByTestId('temporary-profile')).toBeTruthy())
    expect(screen.getByTestId('temporary-profile').textContent).toBe(
      'Profil temporaire · effacé à la fermeture'
    )
    expect(screen.queryByTestId('fresh-start-card')).toBeNull()
  })
})
