import { render, screen } from '@testing-library/react'
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
