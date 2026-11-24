import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { ALL_FEATURES, type PlatformFeatures } from '@shared/platform'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import { forgetFreshStart } from '../../fresh-start'
import { initI18n } from '../../i18n'
import type { SettingsSection } from '../../settings-search'
import { SettingsDialog } from './SettingsDialog'

/**
 * Réglages avec les capacités de Linux puis de Windows (fiches 145, 229) : remplace les
 * vérifications de composant de l'e2e `textes-plateforme` (n° 1 à 7 et 9 ; le n° 8, clé en clair,
 * est dans `ApiKeys.test.tsx`). Chaque page est rendue avec les textes propres au système
 * (`withSystemTexts`) ; la transmission des capacités du main au renderer reste à l'e2e `platform`.
 */

// Ce que le main donne hors du Mac (`main/platform.ts`) : rien de ce que seul macOS a.
const LINUX: PlatformFeatures = {
  ...ALL_FEATURES,
  simulator: false,
  selfInstall: false,
  nativeLanguage: false,
  screenCapture: false,
  finder: false,
  explorer: false,
  windowsPaths: false,
  dockBadge: false,
  appMenu: false,
  insetTitleBar: false,
  commandKey: false,
  overlayScrollbars: false,
  glass: false,
  hiddenPaint: false
}
const WINDOWS: PlatformFeatures = { ...LINUX, explorer: true, windowsPaths: true }

/** Mots du Mac interdits ailleurs, comme l'e2e les cherchait. */
const MAC = /\bMac\b|\bFinder\b|\bDock\b|trousseau macOS|macOS Keychain|⌘/

const settings = {
  profiles: [
    {
      id: 'mock',
      label: 'Agent factice',
      available: true,
      command: 'mock acp',
      capabilities: { specific: [] }
    }
  ],
  profileId: 'mock',
  workspace: '/projets/demo',
  recentWorkspaces: [],
  notifications: true,
  preferences: DEFAULT_PREFERENCES,
  inGitRepo: true,
  newConversation: {},
  rememberedTools: [],
  approvals: { sites: [], commands: [], worktreeSetups: [] },
  apiKeys: [
    {
      profileId: 'mock',
      profileLabel: 'Agent factice',
      keys: [{ env: 'MOCK_AGENT_API_KEY', label: 'Clé', stored: false, fromEnvironment: false }]
    }
  ],
  commands: []
} as unknown as AgentSettingsView

const noop = () => {}
const props = (section: SettingsSection): ComponentProps<typeof SettingsDialog> => ({
  open: true,
  section,
  onSection: noop,
  onOpenChange: noop,
  settings,
  onPreferences: noop,
  onNotifications: noop,
  onOpenNotificationSettings: noop,
  onForgetWorkspace: noop,
  onForgetTool: noop,
  onForgetApproval: noop,
  onSetApiKey: async () => {},
  onRemoveApiKey: noop,
  onSaveCustomAgent: async () => 'x',
  onRemoveCustomAgent: noop,
  onNewConversation: noop,
  onReloadShellEnv: async () => {},
  onBackupHistory: async () => null,
  onOpenActivity: noop,
  projectCommands: [],
  onCommands: noop
})

function Harness() {
  const [section, setSection] = useState<SettingsSection>('general')
  return <SettingsDialog {...props(section)} onSection={setSection} />
}

const api = window.api

/** Lance la fenêtre avec les capacités d'un système : textes et notation des raccourcis. */
function onPlatform(features: PlatformFeatures) {
  Object.assign(window, {
    api: {
      ...api,
      app: {
        ...api.app,
        features,
        getInfo: async () => ({
          version: '1.0.0',
          electron: '44',
          os: 'Linux',
          freshStart: { temporary: false, askReset: false }
        }),
        fonts: async () => ({ families: [], monospace: [] })
      },
      providers: { list: async () => [] },
      settings: { network: async () => ({ settings: {}, fromShell: {} }) },
      tips: { state: async () => ({ hidden: [], quietMs: 0 }), reset: vi.fn() }
    }
  })
  forgetFreshStart()
  initI18n('fr')
}

afterEach(() => {
  Object.assign(window, { api })
  initI18n('fr')
})

const page = () => screen.getByTestId('settings').textContent ?? ''
const macWord = () => MAC.exec(page())?.[0]
const open = (section: SettingsSection) =>
  fireEvent.click(screen.getByTestId(`settings-${section}`))

describe.each([
  ['Linux', LINUX],
  ['Windows', WINDOWS]
] as const)('Réglages sous %s (fiches 145, 229)', (_name, features) => {
  it('Général : la section de la plateforme, aucun mot du Mac', () => {
    onPlatform(features)
    render(<Harness />)
    expect(page()).toContain(i18next.t('settings.general.mac'))
    expect(i18next.t('settings.general.mac')).not.toMatch(MAC)
    expect(macWord()).toBeUndefined()
  })

  it('Notifications : le libellé du rebond de la plateforme, aucun mot du Mac', () => {
    onPlatform(features)
    render(<Harness />)
    open('notifications')
    expect(page()).toContain(i18next.t('settings.notifications.dockBounce.label'))
    expect(screen.queryByTestId('settings-dock-badge')).toBeNull()
    expect(macWord()).toBeUndefined()
  })

  it('Données : « agents neufs » de la plateforme, aucun mot du Mac', async () => {
    onPlatform(features)
    render(<Harness />)
    open('data')
    await screen.findByTestId('fresh-start-card')
    expect(page()).toContain(i18next.t('settings.data.fresh.agentsLabel'))
    expect(macWord()).toBeUndefined()
  })

  it('page de l’agent : l’aide des clés nomme le bon trousseau, aucun mot du Mac', () => {
    onPlatform(features)
    render(<Harness />)
    open('agents')
    fireEvent.click(screen.getByTestId('settings-agent'))
    const hint = i18next.t('settings.agents.page.keysHint')
    expect(page()).toContain(hint)
    expect(hint).not.toMatch(MAC)
    expect(macWord()).toBeUndefined()
  })
})

describe('Windows et Linux nomment chacun leur trousseau (fiche 229)', () => {
  it('l’aide des clés diffère : DPAPI sous Windows, pas sous Linux', () => {
    onPlatform(WINDOWS)
    const windows = i18next.t('settings.agents.page.keysHint')
    onPlatform(LINUX)
    const linux = i18next.t('settings.agents.page.keysHint')
    expect(windows).toContain('DPAPI')
    expect(linux).not.toContain('DPAPI')
  })
})
