import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALL_FEATURES } from '@shared/platform'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import { searchSettings } from '../../settings-search'
import { NotificationsSettings } from './NotificationsSettings'

const show = () =>
  render(
    <NotificationsSettings
      preferences={DEFAULT_PREFERENCES}
      notifications
      onPreferences={vi.fn()}
      onNotifications={vi.fn()}
      onOpenNotificationSettings={vi.fn()}
    />
  )

/** Capacités de la fenêtre (fiche 145), comme le preload les donne. */
const withFeatures = (dockBadge: boolean) =>
  vi.stubGlobal('api', { app: { features: { ...ALL_FEATURES, dockBadge } } })

describe('compteur sur l’icône du Dock (fiches 119, 145)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('proposé là où la plateforme l’a, réglage et recherche', () => {
    withFeatures(true)
    show()
    expect(screen.getByTestId('settings-dock-badge')).toBeTruthy()
    expect(searchSettings('compteur').map((e) => e.label)).toContain('Compteur sur l’icône du Dock')
  })

  it('ailleurs, ni réglage ni résultat de recherche', () => {
    withFeatures(false)
    show()
    expect(screen.queryByTestId('settings-dock-badge')).toBeNull()
    expect(screen.getByTestId('settings-dock-bounce')).toBeTruthy()
    expect(searchSettings('compteur').map((e) => e.label)).not.toContain(
      'Compteur sur l’icône du Dock'
    )
  })
})

/**
 * Rebond du Dock (fiche 101) : remplace les vérifications de composant de l'e2e `settings`
 * (n° 18 à 21). Le moteur du rebond est dans `dock-bounce.test.ts` (main).
 */
describe('rebond du Dock (fiche 101)', () => {
  const bounce = () => screen.getByTestId('settings-dock-bounce') as HTMLInputElement

  it('activé par défaut, en retrait sous « Notifications »', () => {
    show()
    expect(DEFAULT_PREFERENCES.dockBounce).toBe(true)
    expect(bounce().checked).toBe(true)
    expect(bounce().closest('.settings-row')?.classList.contains('sub')).toBe(true)
  })

  it('le réglage s’enregistre', () => {
    const onPreferences = vi.fn()
    render(
      <NotificationsSettings
        preferences={DEFAULT_PREFERENCES}
        notifications
        onPreferences={onPreferences}
        onNotifications={vi.fn()}
        onOpenNotificationSettings={vi.fn()}
      />
    )
    fireEvent.click(bounce())
    expect(onPreferences).toHaveBeenCalledWith({ dockBounce: false })
  })

  it('notifications coupées : rebond grisé, sa valeur gardée', () => {
    render(
      <NotificationsSettings
        preferences={DEFAULT_PREFERENCES}
        notifications={false}
        onPreferences={vi.fn()}
        onNotifications={vi.fn()}
        onOpenNotificationSettings={vi.fn()}
      />
    )
    expect(bounce().disabled).toBe(true)
    expect(bounce().checked).toBe(true)
  })
})
