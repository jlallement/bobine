import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { APPROVAL_GROUPS } from '@shared/approval-rules'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'
import type { SettingsSection } from '../../settings-search'
import { SettingsDialog, type AgentPageRequest } from './SettingsDialog'

/**
 * La fenêtre des Réglages, page par page (fiches 027, 051, 136, 141, 197, 215) : remplace les
 * vérifications de composant des e2e `settings` (n° 23, 25, 27, 28, 30, 34), `profil` (n° 20),
 * `regles-approbation` (n° 19), `custom-agent` (n° 1, 3), `providers` (n° 12), `diagnostic`
 * (n° 19), `pendant-tour` (n° 8) et `filles` (n° 45). Le fichier `SettingsDialog.test.tsx` garde
 * l'index de la recherche, les thèmes, les langues et les nouveautés.
 */

const settings: AgentSettingsView = {
  profiles: [
    {
      id: 'bob',
      label: 'IBM Bob',
      available: true,
      command: 'bob acp',
      approvalRules: true,
      capabilities: { specific: [] }
    },
    {
      id: 'opencode',
      label: 'OpenCode',
      available: true,
      command: 'opencode acp',
      providers: true,
      capabilities: { specific: [] }
    },
    {
      id: 'custom-acme',
      label: 'Acme',
      available: true,
      command: 'acme-agent --acp',
      capabilities: { specific: [] },
      custom: {
        id: 'custom-acme',
        label: 'Acme',
        command: 'acme-agent',
        args: ['--acp'],
        env: {},
        apiKeyEnv: 'ACME_API_KEY'
      }
    }
  ],
  profileId: 'bob',
  workspace: '/projets/demo',
  recentWorkspaces: ['/projets/demo'],
  notifications: true,
  preferences: DEFAULT_PREFERENCES,
  inGitRepo: true,
  newConversation: {},
  rememberedTools: [],
  approvals: { sites: [], commands: [], worktreeSetups: [] },
  apiKeys: [
    {
      profileId: 'bob',
      profileLabel: 'IBM Bob',
      keys: [{ env: 'BOB_API_KEY', label: 'Clé', stored: true, fromEnvironment: false }]
    },
    {
      profileId: 'custom-acme',
      profileLabel: 'Acme',
      keys: [{ env: 'ACME_API_KEY', label: 'Clé d’Acme', stored: false, fromEnvironment: false }]
    }
  ],
  commands: []
} as unknown as AgentSettingsView

const noop = () => {}

function dialogProps(section: SettingsSection): ComponentProps<typeof SettingsDialog> {
  return {
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
    onSaveCustomAgent: async () => 'custom-acme',
    onRemoveCustomAgent: noop,
    onNewConversation: noop,
    onReloadShellEnv: async () => {},
    onBackupHistory: async () => null,
    onOpenActivity: noop,
    projectCommands: [],
    onCommands: noop
  }
}

/** Section et préférences tenues comme dans l'app : un changement revient dans la vue. */
function Harness({
  initial,
  start = {},
  onOpenChange = noop,
  agentRequest
}: {
  initial: SettingsSection
  start?: Partial<Preferences>
  onOpenChange?: (open: boolean) => void
  agentRequest?: AgentPageRequest
}) {
  const [section, setSection] = useState<SettingsSection>(initial)
  const [preferences, setPreferences] = useState<Preferences>({ ...DEFAULT_PREFERENCES, ...start })
  return (
    <SettingsDialog
      {...dialogProps(section)}
      settings={{ ...settings, preferences }}
      onSection={setSection}
      onPreferences={(change) => setPreferences((p) => ({ ...p, ...change }))}
      onOpenChange={onOpenChange}
      {...(agentRequest ? { agentRequest } : {})}
    />
  )
}

const api = window.api
let removeProvider: ReturnType<typeof vi.fn>

beforeEach(() => {
  const provider = {
    id: 'llmaas',
    name: 'LLMaaS interne',
    baseURL: 'https://llm.interne.test/v1',
    models: [],
    enabled: true,
    key: { kind: 'env', env: 'LLMAAS_API_KEY' },
    keyStored: false,
    keyFromEnvironment: false
  }
  const providersView = (providers: unknown[]) => [
    {
      profileId: 'opencode',
      label: 'OpenCode',
      file: '~/.config/opencode/opencode.json',
      providers,
      only: false
    }
  ]
  removeProvider = vi.fn(async () => providersView([]))
  Object.assign(window, {
    api: {
      ...api,
      app: {
        ...api.app,
        getInfo: async () => ({ version: '1.0.0', electron: '44', os: 'macOS' }),
        fonts: async () => ({ families: [], monospace: [] })
      },
      providers: {
        list: async () => providersView([provider]),
        remove: removeProvider,
        diagnose: async () => ({ id: 'providers', title: 'Fournisseurs', checks: [] })
      },
      settings: { network: async () => ({ settings: {}, fromShell: {} }) },
      profile: {
        ...api.profile,
        chooseBackup: async () => ({
          ok: true,
          folder: '/sauvegarde',
          createdAt: '2026-11-20T10:00:00.000Z',
          conversations: 2,
          currentConversations: 3
        }),
        restoreBackup: vi.fn()
      },
      tips: { state: async () => ({ hidden: [], quietMs: 0 }), reset: async () => ({}) },
      approvalRules: {
        get: async () => ({
          ok: true,
          rules: {
            profileId: 'bob',
            file: '~/.bob/settings/settings.json',
            exists: true,
            groups: APPROVAL_GROUPS.map((id) => ({
              id,
              enabled: id === 'read',
              forbidden: false,
              outsideWorkspace: false
            })),
            defaultGroups: false,
            otherGroups: [],
            commands: { allowed: [], denied: [], defaultList: false },
            outsideWorkspaceAllowed: false,
            autoApprovalEnabled: true,
            forbiddenGroups: []
          }
        }),
        change: vi.fn(),
        open: vi.fn()
      },
      diagnostics: {
        system: async () => [],
        agent: async (profileId: string) => ({
          id: `agent:${profileId}`,
          title: profileId,
          checks:
            profileId === 'bob'
              ? [
                  {
                    id: 'auth',
                    label: 'Connexion',
                    level: 'error',
                    detail: 'Connexion requise',
                    action: 'open-agents-settings'
                  }
                ]
              : []
        })
      },
      mcp: { list: async () => [], test: async () => ({ ok: true }) },
      log: {
        status: async () => ({ level: 'normal', imposed: false, sizes: { main: 0, agents: 0 } })
      }
    }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

const heading = () => screen.getByTestId('settings-heading').textContent
const plain = (el: Element) => (el.textContent ?? '').replace(/[  ]/g, ' ')

describe('Réglages › Agents (fiches 136, 141)', () => {
  it('« Relire le PATH » n’est plus dans Agents (il est au Diagnostic)', () => {
    render(<Harness initial="agents" />)
    expect(screen.queryByRole('button', { name: /Relire le PATH/ })).toBeNull()
    expect(screen.getByTestId('settings-agent-list')).toBeTruthy()
  })

  it('page d’un agent : « ‹ Agents » ramène à la liste', () => {
    render(<Harness initial="agents" />)
    fireEvent.click(screen.getAllByTestId('settings-agent')[0] as HTMLElement)
    expect(heading()).toBe('IBM Bob')
    fireEvent.click(screen.getByTestId('settings-agent-back'))
    expect(heading()).toBe('Agents')
    expect(screen.getByTestId('settings-agent-list')).toBeTruthy()
  })

  it('« Ajouter un agent ACP… » est la dernière ligne de la liste', () => {
    render(<Harness initial="agents" />)
    const rows = [...screen.getByTestId('settings-agent-list').querySelectorAll('li')]
    expect(rows.at(-1)?.querySelector('[data-testid="settings-add-agent"]')).toBeTruthy()
    expect(rows.at(-1)?.textContent).toContain('Ajouter un agent ACP')
  })

  it('page d’un agent déclaré : sa clé d’API, « Modifier… », « Déclaré dans Bobine »', () => {
    render(<Harness initial="agents" />)
    fireEvent.click(
      screen
        .getAllByTestId('settings-agent')
        .find((row) => row.dataset['agent'] === 'custom-acme') as HTMLElement
    )
    expect(screen.getByTestId('api-key-ACME_API_KEY')).toBeTruthy()
    expect(screen.getByTestId('agent-page-edit').textContent).toContain('Modifier')
    expect(screen.getByTestId('custom-agent-declared')).toBeTruthy()
    expect(screen.getByText('Déclaré dans Bobine')).toBeTruthy()
  })

  it('fournisseur supprimé : on reste sur la page de l’agent', async () => {
    render(<Harness initial="agents" />)
    fireEvent.click(
      screen
        .getAllByTestId('settings-agent')
        .find((row) => row.dataset['agent'] === 'opencode') as HTMLElement
    )
    fireEvent.click(await screen.findByTestId('provider-remove'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    })
    expect(removeProvider).toHaveBeenCalledWith('opencode', 'llmaas')
    await screen.findByTestId('providers-none')
    expect(screen.getByTestId('settings-agent-page').dataset['agent']).toBe('opencode')
    expect(heading()).toBe('OpenCode')
  })

  it('« Gérer » d’une carte de commande : la page des approbations de l’agent', async () => {
    render(
      <Harness initial="agents" agentRequest={{ profileId: 'bob', sub: 'approvals', seq: 1 }} />
    )
    expect(await screen.findByTestId('approval-rules-page')).toBeTruthy()
    expect(heading()).toBe('Approbations')
    // Retour : la page de l'agent, puis la liste.
    fireEvent.click(screen.getByTestId('settings-agent-back'))
    expect(screen.getByTestId('settings-agent-page').dataset['agent']).toBe('bob')
  })
})

describe('Réglages › Diagnostic → Agents (fiche 061)', () => {
  it('action « Réglages › Agents » : la page de l’agent, avec ses clés', async () => {
    render(<Harness initial="diagnostics" />)
    fireEvent.click(await screen.findByTestId('diag-action-open-agents-settings'))
    expect(screen.getByTestId('settings-agent-page').dataset['agent']).toBe('bob')
    expect(screen.getByTestId('api-key-BOB_API_KEY')).toBeTruthy()
  })
})

describe('Réglages › Conversations (fiches 102, 118, 157)', () => {
  it('conversations gardées actives : de 6 à 2, pas en dessous', () => {
    render(<Harness initial="conversation" />)
    const advanced = screen.getByTestId('settings-conversation-advanced') as HTMLDetailsElement
    fireEvent.click(advanced.querySelector('summary') as HTMLElement)
    const count = () => screen.getByTestId('settings-max-live').textContent
    const less = screen.getByTestId('settings-max-live-less') as HTMLButtonElement
    expect(count()).toBe('6')
    for (let i = 0; i < 4; i++) fireEvent.click(less)
    expect(count()).toBe('2')
    expect(less.disabled).toBe(true)
    fireEvent.click(less)
    expect(count()).toBe('2')
  })

  it('plafond par conversation : activé, 1 en montant, le champ suit les préférences', () => {
    render(<Harness initial="conversation" start={{ costCapEnabled: true, costCapAmount: 1 }} />)
    expect((screen.getByTestId('settings-cost-cap') as HTMLInputElement).checked).toBe(true)
    const amount = screen.getByTestId('settings-cost-cap-amount') as HTMLInputElement
    expect(amount.value).toBe('1')
    expect(amount.disabled).toBe(false)
  })

  it('« Proposer des travaux » (ex-« conversations filles ») se trouve ; « Quand ça s’y prête » par défaut', () => {
    render(<Harness initial="general" />)
    fireEvent.change(screen.getByTestId('settings-search'), {
      target: { value: 'Proposer des travaux' }
    })
    const result = screen
      .getAllByTestId('settings-result')
      .find((r) => r.textContent?.startsWith('Proposer des travaux'))
    fireEvent.click(result as HTMLElement)
    expect(heading()).toBe('Conversations')
    const active = screen.getByTestId('child-proposals-whenFitting')
    expect(active.getAttribute('aria-checked')).toBe('true')
    expect(plain(active)).toBe('Quand ça s’y prête')
  })
})

describe('Réglages : recherche et raccourcis (fiches 051, 027)', () => {
  it('liste des raccourcis : ⌘N, ⌃`, ⇧⌘U dans la notation du Mac', () => {
    render(<Harness initial="shortcuts" />)
    const keys = [...screen.getByTestId('settings-shortcuts-table').querySelectorAll('kbd')].map(
      (k) => k.textContent
    )
    expect(keys).toEqual(expect.arrayContaining(['⌘N', '⌃`', '⇧⌘U']))
  })

  it('⌘F met le focus dans la recherche ; « veille » puis Entrée : le réglage ouvert et mis en avant', () => {
    render(<Harness initial="appearance" />)
    fireEvent.keyDown(screen.getByTestId('settings'), { key: 'f', metaKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('settings-search'))
    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: 'veille' } })
    fireEvent.keyDown(screen.getByTestId('settings-search'), { key: 'Enter' })
    expect(heading()).toBe('Général')
    const flashed = document.querySelector('.settings-flash')
    expect(flashed?.textContent).toContain('Empêcher la mise en veille')
  })

  it('Échap vide d’abord la recherche (« aucun résultat » avant) ; les réglages restent ouverts', () => {
    const onOpenChange = vi.fn()
    render(<Harness initial="general" onOpenChange={onOpenChange} />)
    const search = screen.getByTestId('settings-search') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'rien de tel' } })
    expect(screen.getByTestId('settings-no-result')).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(search.value).toBe('')
    expect(screen.queryByTestId('settings-no-result')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('Réglages › Données : restaurer (fiche 197)', () => {
  it('Échap ferme la confirmation de la restauration, pas les réglages', async () => {
    const onOpenChange = vi.fn()
    render(<Harness initial="data" onOpenChange={onOpenChange} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-restore'))
    })
    const card = await screen.findByTestId('settings-restore-confirm')
    expect(card.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('settings-restore-confirm')).toBeNull())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(within(screen.getByTestId('settings')).getByTestId('settings-restore')).toBeTruthy()
  })
})
