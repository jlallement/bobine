import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import { setLanguage } from '../../i18n'
import {
  agentEntries,
  searchSettings,
  settingsIndex,
  type SettingsSection
} from '../../settings-search'
import { parseChangelog } from './AboutSettings'
import { SettingsDialog } from './SettingsDialog'

// Titre d'une version publiée : `X.Y.Z — date`, préversion semver comprise (`1.0.0-beta.1`,
// fiche 218).
const VERSION_NUMBER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?= — )/

const settings: AgentSettingsView = {
  profiles: [
    {
      id: 'bob',
      label: 'IBM Bob',
      available: true,
      command: 'bob acp',
      capabilities: {
        announced: {
          name: 'IBM Bob',
          version: '2.0.6',
          seenAt: '2026-10-14T08:00:00.000Z',
          items: [
            { id: 'reopen', label: 'Reprendre une conversation de l’historique', supported: true },
            {
              id: 'images',
              label: 'Images dans les messages',
              supported: false,
              detail: 'Envoyée par son `chemin`.'
            }
          ]
        },
        specific: [
          { id: 'cost-bob-db', label: 'Consommation en bobcoins', detail: 'Base `bob.db`.' }
        ]
      }
    },
    {
      id: 'opencode',
      label: 'OpenCode',
      available: false,
      command: 'opencode acp',
      reason: 'Commande « opencode » introuvable.',
      capabilities: { specific: [] }
    }
  ],
  profileId: 'bob',
  workspace: '/projets/demo',
  recentWorkspaces: ['/projets/demo'],
  notifications: true,
  preferences: DEFAULT_PREFERENCES,
  inGitRepo: true,
  newConversation: {},
  rememberedTools: [{ profileId: 'bob', profileLabel: 'IBM Bob', tools: ['Updating todo list'] }],
  approvals: {
    sites: ['github.com'],
    commands: [{ workspace: '/projet', commands: ['pnpm dev'] }],
    worktreeSetups: []
  },
  apiKeys: [
    {
      profileId: 'bob',
      profileLabel: 'IBM Bob',
      keys: [{ env: 'BOB_API_KEY', label: 'Clé', stored: false, fromEnvironment: false }]
    }
  ],
  commands: []
}

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

function Harness({ initial }: { initial: SettingsSection }) {
  const [section, setSection] = useState<SettingsSection>(initial)
  return <SettingsDialog {...dialogProps(section)} onSection={setSection} />
}

beforeEach(() => {
  Object.assign(window, {
    api: {
      app: {
        getInfo: async () => ({ version: '0.1.0', electron: '44', os: 'macOS' }),
        fonts: async () => ({ families: ['Avenir Next', 'Menlo'], monospace: ['Menlo'] })
      },
      // Fournisseurs de modèles et réseau d'entreprise (fiche 104) : rien de configuré.
      providers: { list: async () => [] },
      settings: { network: async () => ({ settings: {}, fromShell: {} }) },
      // Worktrees orphelins (fiche 110) : aucun.
      worktree: { orphans: async () => [] },
      // Éditeurs installés (fiche 156) : aucun.
      editors: { list: async () => [] },
      // Corbeille (fiche 196) : vide.
      profile: {
        status: async () => ({ readOnly: false, notices: [] }),
        onChanged: () => () => {},
        trash: async () => []
      },
      // Astuces (fiche 191) : deux masquées.
      tips: {
        state: async () => ({ hidden: ['aside', 'context'], quietMs: 0 }),
        reset: async () => ({ hidden: [], quietMs: 0 })
      }
    }
  })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  delete (window as { api?: unknown }).api
})

/** Libellés affichés (lignes et titres) du corps des réglages. */
const shownLabels = () =>
  [...document.querySelectorAll('.settings-body .settings-row-label, .settings-body h3')].map(
    (el) => el.textContent?.trim() ?? ''
  )

describe('SettingsDialog — recherche (fiche 051)', () => {
  it('l’index connaît chaque réglage affiché, section par section, pages d’agent comprises', () => {
    const sections: SettingsSection[] = [
      'general',
      'appearance',
      'notifications',
      'conversation',
      'agents',
      'privacy',
      'data'
    ]
    const indexed = [...settingsIndex(), ...agentEntries(settings.profiles, settings.apiKeys)]
    const missing = (section: SettingsSection, page?: string) =>
      shownLabels().filter(
        (label) =>
          !indexed.some(
            (e) => e.section === section && e.label === label && (e.page ?? undefined) === page
          )
      )
    for (const section of sections) {
      const { unmount } = render(<Harness initial={section} />)
      expect(shownLabels().length).toBeGreaterThan(0)
      expect([section, missing(section)]).toEqual([section, []])
      unmount()
    }
    render(<Harness initial="agents" />)
    fireEvent.click(screen.getByTestId('settings-agent'))
    expect(screen.getByTestId('settings-agent-page')).toBeTruthy()
    expect(missing('agents', 'bob')).toEqual([])
  })

  it('« consommation » mène à « Mon activité », hors des réglages (fiche 144)', () => {
    const onOpenActivity = vi.fn()
    render(<SettingsDialog {...dialogProps('general')} onOpenActivity={onOpenActivity} />)
    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: 'consommation' } })
    const result = screen
      .getAllByTestId('settings-result')
      .find((r) => r.textContent === 'Mon activitéMon activité') as HTMLElement
    fireEvent.click(result)
    expect(onOpenActivity).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('settings-usage')).toBeNull()
  })

  it('« journal » et « log » mènent à la carte Journal du Diagnostic (fiche 133)', () => {
    for (const query of ['journal', 'log', 'main.log']) {
      expect(searchSettings(query)).toContainEqual(
        expect.objectContaining({ section: 'diagnostics', label: 'Journal' })
      )
    }
  })

  it('résultats à la place de la section ; un clic ouvre la section et fait ressortir le réglage', () => {
    render(<Harness initial="general" />)
    const search = screen.getByTestId('settings-search')
    fireEvent.change(search, { target: { value: 'largeur' } })
    expect(screen.queryByText('Votre prénom')).toBeNull()
    const [result] = screen.getAllByTestId('settings-result')
    expect(result?.textContent).toContain('Largeur du fil')
    expect(result?.textContent).toContain('Apparence')
    fireEvent.click(result as HTMLElement)
    expect((search as HTMLInputElement).value).toBe('')
    const row = screen.getByText('Largeur du fil').closest('.settings-row')
    expect(row?.classList.contains('settings-flash')).toBe(true)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    fireEvent.change(search, { target: { value: 'rien de tel' } })
    expect(screen.getByTestId('settings-no-result').textContent).toContain('rien de tel')
    // Entrée ouvre le premier résultat.
    fireEvent.change(search, { target: { value: 'prenom' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByText('Votre prénom')).toBeTruthy()
  })

  it('un réglage dans « Avancé » : la recherche le déplie (fiche 136)', () => {
    render(<Harness initial="general" />)
    fireEvent.change(screen.getByTestId('settings-search'), {
      target: { value: 'conversations gardées actives' }
    })
    fireEvent.click(screen.getAllByTestId('settings-result')[0] as HTMLElement)
    const advanced = screen.getByTestId('settings-conversation-advanced') as HTMLDetailsElement
    expect(advanced.open).toBe(true)
    expect(
      screen.getByText('Conversations gardées actives').closest('.settings-row')?.classList
    ).toContain('settings-flash')
  })

  it('« Propre à IBM Bob » ou « Clé » : la recherche ouvre la page de l’agent (fiche 136)', () => {
    render(<Harness initial="general" />)
    const search = screen.getByTestId('settings-search')
    fireEvent.change(search, { target: { value: 'propre ibm' } })
    const [result] = screen.getAllByTestId('settings-result')
    expect(result?.textContent).toContain('Agents › IBM Bob')
    fireEvent.click(result as HTMLElement)
    expect(screen.getByTestId('settings-agent-page').getAttribute('data-agent')).toBe('bob')
    expect(screen.getByTestId('settings-heading').textContent).toBe('IBM Bob')
    // Retour à la liste, puis la clé d'API de Bob.
    fireEvent.click(screen.getByTestId('settings-agent-back'))
    expect(screen.queryByTestId('settings-agent-page')).toBeNull()
    fireEvent.change(search, { target: { value: 'clé bob' } })
    const key = screen
      .getAllByTestId('settings-result')
      .find((r) => r.querySelector('.settings-result-label')?.textContent === 'Clé')
    fireEvent.click(key as HTMLElement)
    expect(screen.getByTestId('api-key-BOB_API_KEY').classList).toContain('settings-flash')
  })
})

describe('SettingsDialog — pages d’agent (fiches 054, 136)', () => {
  it('une ligne par agent installé ; sa page dit ce qu’il annonce et ce qui lui est propre', () => {
    render(<Harness initial="agents" />)
    const [bob, ...others] = screen.getAllByTestId('settings-agent')
    // Seulement les agents installés ; les autres nommés avec la marche à suivre (fiche 058).
    expect(others).toEqual([])
    expect(screen.getByTestId('settings-agents-missing').textContent).toContain(
      'OpenCode (Commande «\u00a0opencode\u00a0» introuvable.)'
    )
    expect(bob?.textContent).toContain('Prêt · 2.0.6')
    fireEvent.click(bob as HTMLElement)
    const page = screen.getByTestId('settings-agent-page')
    expect(page.textContent).toContain('bob acp')
    const caps = screen.getByTestId('agent-capabilities')
    expect(caps.querySelector('li.yes')?.textContent).toContain('Reprendre une conversation')
    expect(caps.querySelector('li.no code')?.textContent).toBe('chemin')
    expect(page.textContent).toContain('Propre à IBM Bob')
    expect(screen.getByTestId('agent-specific').textContent).toContain('Consommation en bobcoins')
    // « Relancer » : la conversation active utilise IBM Bob.
    expect(screen.queryByTestId('agent-page-restart')).toBeNull()
  })

  it('« Relancer » relance l’agent de la conversation active quand c’est le sien', () => {
    const onRestartAgent = vi.fn()
    render(<SettingsDialog {...dialogProps('agents')} onRestartAgent={onRestartAgent} />)
    fireEvent.click(screen.getByTestId('settings-agent'))
    fireEvent.click(screen.getByTestId('agent-page-restart'))
    expect(onRestartAgent).toHaveBeenCalled()
  })

  it('la recherche « version » mène aux agents', () => {
    render(<Harness initial="general" />)
    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: 'version' } })
    const labels = screen.getAllByTestId('settings-result').map((r) => r.textContent)
    expect(labels.some((l) => l?.includes('Agents'))).toBe(true)
  })
})

describe('SettingsDialog — clés d’API (fiche 100)', () => {
  it('« Définir » toujours actif ; trousseau indisponible : dit à l’enregistrement', async () => {
    const onSetApiKey = vi.fn(() =>
      Promise.reject(
        new Error(
          "Error invoking remote method 'settings:setApiKey': Error: Le trousseau macOS n’est pas disponible : la clé ne peut pas être enregistrée."
        )
      )
    )
    render(<SettingsDialog {...dialogProps('agents')} onSetApiKey={onSetApiKey} />)
    fireEvent.click(screen.getByTestId('settings-agent'))
    const edit = screen.getByTestId('api-key-edit')
    expect((edit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(edit)
    fireEvent.change(screen.getByTestId('api-key-value'), { target: { value: 'secret' } })
    await act(async () => {
      fireEvent.submit(screen.getByTestId('api-key-value'))
    })
    expect(onSetApiKey).toHaveBeenCalledWith('bob', 'BOB_API_KEY', 'secret')
    expect(document.querySelector('.api-key-error')?.textContent).toBe(
      'Le trousseau macOS n’est pas disponible : la clé ne peut pas être enregistrée.'
    )
  })
})

describe('SettingsDialog — apparence (fiche 136)', () => {
  it('cinq thèmes sur une ligne, six accents : chaque choix part dans les préférences', () => {
    const onPreferences = vi.fn()
    render(<SettingsDialog {...dialogProps('appearance')} onPreferences={onPreferences} />)
    expect(screen.getByTestId('theme-system').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('theme-sepia'))
    fireEvent.click(screen.getByTestId('theme-black'))
    fireEvent.click(screen.getByTestId('theme-system'))
    fireEvent.click(screen.getByTestId('accent-graphite'))
    expect(screen.queryByTestId('accent-system')).toBeNull()
    expect(onPreferences.mock.calls.map(([change]) => change)).toEqual([
      { theme: 'light', lightTheme: 'sepia' },
      { theme: 'dark', darkTheme: 'black' },
      { theme: 'system', lightTheme: 'light', darkTheme: 'dark' },
      { accent: 'graphite' }
    ])
    expect(screen.getByTestId('appearance-preview')).toBeTruthy()
  })

  it('polices installées dans les listes ; une police enregistrée absente reste, marquée', async () => {
    const onPreferences = vi.fn()
    const preferences = { ...DEFAULT_PREFERENCES, codeFont: 'JetBrains Mono' }
    render(
      <SettingsDialog
        {...dialogProps('appearance')}
        settings={{ ...settings, preferences }}
        onPreferences={onPreferences}
      />
    )
    await act(async () => {})
    const options = (id: string) =>
      [...(screen.getByTestId(id) as HTMLSelectElement).options].map((o) => o.textContent)
    expect(options('settings-conversation-font')).toEqual([
      'Système (sans serif)',
      'Serif (New York)',
      'Avenir Next',
      'Menlo'
    ])
    expect(options('settings-code-font')).toEqual([
      'SF Mono (système)',
      'JetBrains Mono (non installée)',
      'Menlo'
    ])
    expect(options('settings-terminal-font')).toEqual(['Automatique', 'Menlo'])
    fireEvent.change(screen.getByTestId('settings-terminal-font'), { target: { value: 'Menlo' } })
    expect(onPreferences).toHaveBeenCalledWith({ terminalFontFamily: 'Menlo' })
  })
})

describe('SettingsDialog — langue (fiche 074)', () => {
  afterEach(() => setLanguage('fr'))

  it('« Système », puis chaque langue sous son propre nom ; le choix part dans les préférences', () => {
    const onPreferences = vi.fn()
    render(<SettingsDialog {...dialogProps('general')} onPreferences={onPreferences} />)
    const select = screen.getByTestId('settings-language') as HTMLSelectElement
    expect(select.value).toBe('system')
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Système',
      'Français',
      'English'
    ])
    fireEvent.change(select, { target: { value: 'en' } })
    expect(onPreferences).toHaveBeenCalledWith({ language: 'en' })
  })

  it('suit la langue sans fermer les réglages, et se retrouve en cherchant dans l’une ou l’autre', () => {
    render(<Harness initial="general" />)
    expect(screen.getByText('Langue')).toBeTruthy()
    act(() => setLanguage('en'))
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByText('Language')).toBeTruthy()
    expect(screen.getByText('You')).toBeTruthy()
    fireEvent.change(screen.getByTestId('settings-search'), { target: { value: 'français' } })
    expect(screen.getAllByTestId('settings-result')[0]?.textContent).toContain('Language')
  })

  it('menus et fenêtres de macOS dans une autre langue : « Relancer » (app packagée)', async () => {
    const relaunch = vi.fn(async () => undefined)
    Object.assign(window, {
      api: {
        app: { getInfo: async () => ({ nativeLanguage: 'fr' }), relaunch },
        editors: { list: async () => [] },
        tips: { state: async () => ({ hidden: [], quietMs: 0 }) }
      }
    })
    render(<Harness initial="general" />)
    // Infos de l'app reçues : déjà dans la langue de macOS, rien à relancer.
    await act(async () => {})
    expect(screen.queryByTestId('settings-language-native')).toBeNull()
    act(() => setLanguage('en'))
    fireEvent.click(await screen.findByTestId('settings-language-relaunch'))
    expect(screen.getByTestId('settings-language-native').textContent).toContain('next launch')
    expect(relaunch).toHaveBeenCalled()
  })
})

describe('SettingsDialog — à propos', () => {
  afterEach(() => setLanguage('fr'))

  const titlesOf = (changelog: HTMLElement) =>
    [...changelog.querySelectorAll<HTMLElement>('[data-testid=settings-version]')].map(
      (summary) => summary.dataset['title'] ?? null
    )

  it('nouveautés du CHANGELOG, une ligne par version, la plus récente seule ouverte', async () => {
    render(<Harness initial="about" />)
    expect(await screen.findByText('Version 0.1.0')).toBeTruthy()
    const changelog = screen.getByTestId('settings-changelog')
    const titles = titlesOf(changelog)
    const details = [...changelog.querySelectorAll('details')]
    expect(details.map((d) => d.open)).toEqual(details.map((_, i) => i === 0))
    // « Prochaine version » entre deux publications, puis renommée « X.Y.Z[-pré] — date ».
    expect(titles[0] === 'Prochaine version' || VERSION_NUMBER.test(titles[0] ?? '')).toBe(true)
    expect(titles).toContain('0.1.1 — 14 octobre 2026')
    // Le titre du fichier n'est pas répété sous « Nouveautés ».
    expect(changelog.querySelector('h1')).toBeNull()
  })

  it('en anglais, celles de CHANGELOG.en.md, version pour version', () => {
    const versions = (titles: (string | null)[]) =>
      titles.map((title) => VERSION_NUMBER.exec(title ?? '')?.[0] ?? 'next')
    render(<Harness initial="about" />)
    const changelog = screen.getByTestId('settings-changelog')
    const french = titlesOf(changelog)
    act(() => setLanguage('en'))
    const english = titlesOf(changelog)
    expect(english[0] === 'Next version' || VERSION_NUMBER.test(english[0] ?? '')).toBe(true)
    expect(english).toContain('0.1.1 — October 14, 2026')
    expect(versions(english)).toEqual(versions(french))
  })

  it('préversion : titre `1.0.0-beta.1 — date`, nom et date séparés (fiche 218)', () => {
    const changelog = [
      '# Nouveautés',
      '',
      'Introduction.',
      '',
      '## 1.0.0-rc.2 — 2 décembre 2026',
      '',
      '- Candidate.',
      '',
      '## 1.0.0-beta.1 — 10 novembre 2026',
      '',
      '### Nouveau',
      '',
      '- Bêta publique.',
      '',
      '## 0.11.2 — 9 novembre 2026',
      '',
      '- Corrections.'
    ].join('\n')
    const versions = parseChangelog(changelog)
    expect(versions.map(({ name, date }) => [name, date])).toEqual([
      ['1.0.0-rc.2', '2 décembre 2026'],
      ['1.0.0-beta.1', '10 novembre 2026'],
      ['0.11.2', '9 novembre 2026']
    ])
    expect(versions[1]?.body).toBe('### Nouveau\n\n- Bêta publique.')
    for (const { title } of versions) expect(VERSION_NUMBER.test(title)).toBe(true)
    expect(VERSION_NUMBER.exec('1.0.0-beta.1 — 10 novembre 2026')?.[0]).toBe('1.0.0-beta.1')
    expect(VERSION_NUMBER.test('1.0.0-beta.1 sans date')).toBe(false)
    expect(VERSION_NUMBER.test('Prochaine version')).toBe(false)
  })

  describe('agents ACP déclarés (fiche 141)', () => {
    const acme = {
      id: 'custom-acme',
      label: 'Acme',
      command: 'acme-agent',
      args: ['--acp'],
      env: { ACME_REGION: 'eu' }
    }
    const withAcme: AgentSettingsView = {
      ...settings,
      profiles: [
        ...settings.profiles,
        {
          id: 'custom-acme',
          label: 'Acme',
          available: false,
          reason: 'Commande « acme-agent » introuvable.',
          command: 'acme-agent --acp',
          capabilities: { specific: [] },
          custom: acme
        }
      ]
    }

    it('« Ajouter un agent ACP… » : erreurs sous leur champ, « Ajouter » grisé, puis envoyé', async () => {
      const onSaveCustomAgent = vi.fn(async () => 'custom-acme')
      render(<SettingsDialog {...dialogProps('agents')} onSaveCustomAgent={onSaveCustomAgent} />)
      fireEvent.click(screen.getByTestId('settings-add-agent'))
      expect(screen.getByTestId('settings-heading').textContent).toBe('Nouvel agent ACP')
      const save = screen.getByTestId('custom-agent-save') as HTMLButtonElement
      expect(save.disabled).toBe(true)
      fireEvent.change(screen.getByTestId('custom-agent-label'), { target: { value: 'Acme' } })
      fireEvent.change(screen.getByTestId('custom-agent-commandLine'), {
        target: { value: 'npx -y @acme/agent --acp' }
      })
      const env = screen.getByTestId('custom-agent-envText')
      fireEvent.change(env, { target: { value: 'ACME_REGION=eu\nACME LOG' } })
      // Pas d'erreur avant d'avoir quitté le champ.
      expect(screen.queryByTestId('custom-agent-problem')).toBeNull()
      fireEvent.blur(env)
      expect(screen.getByTestId('custom-agent-problem').textContent).toContain('Ligne 2')
      expect(save.disabled).toBe(true)
      fireEvent.change(env, { target: { value: 'ACME_REGION=eu' } })
      expect(screen.queryByTestId('custom-agent-problem')).toBeNull()
      await act(async () => {
        fireEvent.click(save)
      })
      expect(onSaveCustomAgent).toHaveBeenCalledWith(
        {
          label: 'Acme',
          commandLine: 'npx -y @acme/agent --acp',
          envText: 'ACME_REGION=eu',
          apiKeyEnv: '',
          compactCommand: ''
        },
        undefined
      )
    })

    it('refus du main : la raison dans le formulaire, qui reste ouvert', async () => {
      const onSaveCustomAgent = vi.fn(async () => {
        throw new Error('Refusé par le main')
      })
      render(<SettingsDialog {...dialogProps('agents')} onSaveCustomAgent={onSaveCustomAgent} />)
      fireEvent.click(screen.getByTestId('settings-add-agent'))
      fireEvent.change(screen.getByTestId('custom-agent-label'), { target: { value: 'A' } })
      fireEvent.change(screen.getByTestId('custom-agent-commandLine'), { target: { value: 'a' } })
      await act(async () => {
        fireEvent.click(screen.getByTestId('custom-agent-save'))
      })
      expect(screen.getByTestId('custom-agent-error').textContent).toBe('Refusé par le main')
      expect(screen.getByTestId('custom-agent-form')).toBeTruthy()
    })

    it('introuvable mais listé ; sa page : modifier, puis supprimer après confirmation', async () => {
      const onSaveCustomAgent = vi.fn(async () => 'custom-acme')
      const onRemoveCustomAgent = vi.fn()
      render(
        <SettingsDialog
          {...dialogProps('agents')}
          settings={withAcme}
          onSaveCustomAgent={onSaveCustomAgent}
          onRemoveCustomAgent={onRemoveCustomAgent}
        />
      )
      const row = screen
        .getAllByTestId('settings-agent')
        .find((r) => r.dataset['agent'] === 'custom-acme')
      expect(row?.textContent).toContain('Commande introuvable')
      fireEvent.click(row as HTMLElement)
      expect(screen.getByTestId('agent-specific').textContent).toContain('Rien')
      fireEvent.click(screen.getByTestId('agent-page-edit'))
      expect(screen.getByTestId('settings-heading').textContent).toBe('Modifier Acme')
      expect((screen.getByTestId('custom-agent-commandLine') as HTMLInputElement).value).toBe(
        'acme-agent --acp'
      )
      await act(async () => {
        fireEvent.click(screen.getByTestId('custom-agent-save'))
      })
      expect(onSaveCustomAgent).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Acme', envText: 'ACME_REGION=eu' }),
        'custom-acme'
      )
      // Revenu sur sa page.
      fireEvent.click(screen.getByTestId('custom-agent-remove'))
      expect(onRemoveCustomAgent).not.toHaveBeenCalled()
      fireEvent.click(screen.getByTestId('confirm-row-confirm'))
      expect(onRemoveCustomAgent).toHaveBeenCalledWith('custom-acme')
      expect(screen.getByTestId('settings-agent-list')).toBeTruthy()
    })
  })
})
