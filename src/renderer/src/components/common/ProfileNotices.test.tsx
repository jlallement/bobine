import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileStatus } from '@shared/profile'
import { ProfileNotices } from './Profile'

/**
 * Avis du profil en tête de la fenêtre (fiches 196, 197) : remplace les vérifications de
 * composant de l'e2e `profil` (n° 7, 8, 11). Les cas et leur gravité viennent du main
 * (`profile-integrity.test.ts`) ; « Afficher dans le Finder » par identifiant, jamais par chemin,
 * est vérifié dans `unsaved-at-quit.test.ts`.
 */

const STATUS: ProfileStatus = {
  readOnly: false,
  notices: [
    {
      id: 'settings',
      level: 'warning',
      message: { key: 'profile.notice.settingsDamaged' },
      reveal: true,
      detail: 'Unexpected token } in JSON at position 12'
    },
    {
      id: 'index',
      level: 'warning',
      message: { key: 'profile.notice.indexRebuilt', params: { count: 3 } }
    },
    {
      id: 'restored',
      level: 'info',
      message: { key: 'profile.notice.restored', params: { date: '20 novembre' } }
    }
  ]
} as unknown as ProfileStatus

const api = window.api
let status: ProfileStatus
let changed: ((next: ProfileStatus) => void) | null
let calls: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  status = STATUS
  changed = null
  calls = {
    dismiss: vi.fn(async (id: string) => {
      status = { ...status, notices: status.notices.filter((n) => n.id !== id) }
      changed?.(status)
      return status
    }),
    reveal: vi.fn(async () => undefined)
  }
  Object.assign(window, {
    api: {
      ...api,
      profile: {
        status: async () => status,
        onChanged: (listener: (next: ProfileStatus) => void) => {
          changed = listener
          return () => {}
        },
        dismiss: calls['dismiss'],
        reveal: calls['reveal'],
        openReleases: vi.fn()
      }
    }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

const plain = (el: Element) => (el.textContent ?? '').replace(/[  ]/g, ' ')
const shown = () => screen.queryAllByTestId('profile-notice')

describe('avis du profil (fiches 196, 197)', () => {
  it('trois avis, chacun à sa gravité ; une erreur serait une alerte', async () => {
    render(<ProfileNotices />)
    await waitFor(() => expect(shown()).toHaveLength(3))
    expect(shown().map((n) => n.dataset.level)).toEqual(['warning', 'warning', 'info'])
    expect(shown().map((n) => n.getAttribute('role'))).toEqual(['status', 'status', 'status'])
  })

  it('réglages mis de côté ; liste des conversations refaite avec leur nombre ; sans chemin', async () => {
    render(<ProfileNotices />)
    await waitFor(() => expect(shown()).toHaveLength(3))
    expect(plain(shown()[0] as HTMLElement)).toContain('Vos réglages étaient illisibles')
    expect(plain(shown()[1] as HTMLElement)).toContain('à partir des 3 conversations trouvées')
    expect(plain(screen.getByTestId('profile-notices'))).not.toMatch(/\/|settings\.json/)
  })

  it('« Afficher dans le Finder » désigne l’avis ; le détail technique se déplie', async () => {
    render(<ProfileNotices />)
    fireEvent.click(await screen.findByTestId('profile-notice-reveal'))
    expect(calls['reveal']).toHaveBeenCalledWith('settings')
    expect(shown()[0]?.querySelector('code')).toBeNull()
    fireEvent.click(screen.getByTestId('profile-notice-details'))
    expect(shown()[0]?.querySelector('code')?.textContent).toContain('Unexpected token')
  })

  it('un avis se ferme par × : les autres restent', async () => {
    render(<ProfileNotices />)
    await waitFor(() => expect(shown()).toHaveLength(3))
    await act(async () => {
      fireEvent.click(
        shown()[1]?.querySelector('[data-testid="profile-notice-dismiss"]') as Element
      )
    })
    expect(calls['dismiss']).toHaveBeenCalledWith('index')
    expect(shown().map((n) => n.dataset.level)).toEqual(['warning', 'info'])
  })
})
