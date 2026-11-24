import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import type { DiagnosticGroup } from '@shared/diagnostics'
import type { LogStatus } from '@shared/log-level'
import { DEFAULT_PREFERENCES } from '@shared/preferences'
import { DiagnosticsSettings } from './DiagnosticsSettings'

/**
 * Réglages › Diagnostic (fiches 061, 080, 133) : remplace les vérifications de composant de l'e2e
 * `diagnostic` (n° 6, 7, 9, 10, 16, 19, 22, 28). Les vérifications elles-mêmes (agent essayé hors
 * conversation, PATH, MCP) sont faites par le main : `src/main/diagnostics.test.ts`.
 */

const settings = {
  profiles: [
    {
      id: 'mock',
      label: 'Agent factice',
      available: true,
      command: 'mock',
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
  apiKeys: [],
  commands: []
} as unknown as AgentSettingsView

const SYSTEM: DiagnosticGroup[] = [
  {
    id: 'app',
    title: 'Bobine',
    checks: [{ id: 'version', label: 'Version', level: 'ok', detail: '1.0.0' }]
  },
  {
    id: 'environment',
    title: 'Environnement',
    checks: [
      { id: 'path', label: 'PATH', level: 'ok', detail: '/usr/bin' },
      { id: 'axe', label: 'AXe', level: 'optional', detail: 'absent' }
    ]
  }
]

const AGENT: DiagnosticGroup = {
  id: 'agent:mock',
  title: 'Agent factice',
  checks: [
    {
      id: 'auth',
      label: 'Connexion',
      level: 'error',
      detail: 'Connexion requise',
      fix: 'Saisissez la clé d’API.',
      action: 'open-agents-settings'
    }
  ]
}

const api = window.api
let calls: Record<string, ReturnType<typeof vi.fn>>
let status: LogStatus

beforeEach(() => {
  status = { level: 'normal', imposed: false, sizes: { main: 2048, agents: 0 } }
  calls = {
    system: vi.fn(async () => SYSTEM),
    agent: vi.fn(async () => AGENT),
    reveal: vi.fn(async () => undefined),
    open: vi.fn(async () => undefined),
    setLevel: vi.fn(async (level: LogStatus['level']) => ({ ...status, level })),
    writeText: vi.fn(async () => undefined)
  }
  Object.assign(navigator, { clipboard: { writeText: calls['writeText'] } })
  Object.assign(window, {
    api: {
      ...api,
      app: { ...api.app, getInfo: async () => ({ version: '1.0.0', electron: '44', os: 'macOS' }) },
      diagnostics: { system: calls['system'], agent: calls['agent'] },
      providers: { diagnose: async () => ({ id: 'providers', title: 'Fournisseurs', checks: [] }) },
      mcp: { list: async () => [], test: async () => ({ ok: true }) },
      log: {
        status: async () => status,
        setLevel: calls['setLevel'],
        open: calls['open'],
        reveal: calls['reveal']
      }
    }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

const show = async (props: Partial<Parameters<typeof DiagnosticsSettings>[0]> = {}) => {
  render(
    <DiagnosticsSettings
      settings={settings}
      onReloadShellEnv={async () => {}}
      onSection={vi.fn()}
      onOpenAgent={vi.fn()}
      {...props}
    />
  )
  await waitFor(() =>
    expect((screen.getByTestId('diagnostics-rerun') as HTMLButtonElement).disabled).toBe(false)
  )
  await screen.findByTestId('log-settings')
}

describe('Réglages › Diagnostic (fiche 061)', () => {
  it('la carte Journal suit le résumé, avant le premier groupe de vérifications', async () => {
    await show()
    const page = screen.getByTestId('diagnostics')
    const order = [...page.querySelectorAll('[data-testid]')]
      .map((el) => el.getAttribute('data-testid'))
      .filter(
        (id) =>
          id === 'diagnostics-summary' || id === 'log-settings' || id?.startsWith('diag-group-')
      )
    expect(order.slice(0, 3)).toEqual(['diagnostics-summary', 'log-settings', 'diag-group-app'])
  })

  it('groupes dans l’ordre : l’app, l’environnement, chaque agent, MCP, les fournisseurs', async () => {
    await show()
    const groups = [...document.querySelectorAll('.diag-group[data-testid^="diag-group-"]')].map(
      (g) => g.getAttribute('data-testid')
    )
    expect(groups).toEqual([
      'diag-group-app',
      'diag-group-environment',
      'diag-group-agent:mock',
      'diag-group-mcp',
      'diag-group-providers'
    ])
  })

  it('Journal : main.log et agents.log, leur taille, « Afficher dans le Finder », puis le niveau', async () => {
    await show()
    const card = screen.getByTestId('log-settings')
    expect(within(card).getByTestId('log-file-main').textContent).toContain('main.log')
    expect(within(card).getByTestId('log-file-agents').textContent).toContain('agents.log')
    expect(screen.getByTestId('log-size-agents').textContent).toContain('vide')
    expect((screen.getByTestId('log-reveal-agents') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('log-reveal-main').getAttribute('aria-label')).toBe(
      'Afficher main.log dans le Finder'
    )
    // Le niveau vient après les fichiers.
    const items = [...card.querySelectorAll('li')]
    expect(items.at(-1)?.querySelector('[data-testid="log-level"]')).toBeTruthy()
  })

  it('l’icône du Finder demande au main de montrer main.log', async () => {
    await show()
    fireEvent.click(screen.getByTestId('log-reveal-main'))
    expect(calls['reveal']).toHaveBeenCalledWith('main')
    fireEvent.click(screen.getByTestId('log-open-main'))
    expect(calls['open']).toHaveBeenCalledWith('main')
  })

  it('niveau du journal : Normal par défaut, réglable à chaud', async () => {
    await show()
    const level = screen.getByTestId('log-level') as HTMLSelectElement
    expect(level.value).toBe('normal')
    expect(level.disabled).toBe(false)
    expect(screen.getByTestId('log-level-hint').textContent).toBe('Seul main.log est écrit.')
    await act(async () => {
      fireEvent.change(level, { target: { value: 'detailed' } })
    })
    expect(calls['setLevel']).toHaveBeenCalledWith('detailed')
    await waitFor(() => expect(level.value).toBe('detailed'))
  })

  it('BOBINE_LOG impose le niveau : réglage grisé, et dit pourquoi', async () => {
    status = { ...status, level: 'trace', imposed: true }
    await show()
    const level = screen.getByTestId('log-level') as HTMLSelectElement
    expect(level.value).toBe('trace')
    expect(level.disabled).toBe(true)
    expect(screen.getByTestId('log-level-hint').textContent).toContain('Imposé par BOBINE_LOG.')
  })

  it('rapport copié : une ligne par vérification, avec sa marque', async () => {
    await show()
    await act(async () => {
      fireEvent.click(screen.getByTestId('diagnostics-copy'))
    })
    const report = String(calls['writeText']?.mock.calls[0]?.[0])
    const lines = report.split('\n')
    expect(lines.filter((l) => /^ {2}✓ Version/.test(l))).toHaveLength(1)
    expect(lines.filter((l) => /^ {2}✓ PATH/.test(l))).toHaveLength(1)
    expect(lines.filter((l) => /^ {2}– AXe/.test(l))).toHaveLength(1)
    expect(lines.filter((l) => /^ {2}✗ Connexion/.test(l))).toHaveLength(1)
    expect(report).toContain('→ Saisissez la clé d’API.')
  })

  it('« Relancer » refait les vérifications : en cours, puis finies', async () => {
    await show()
    expect(calls['system']).toHaveBeenCalledTimes(1)
    let finish: (groups: DiagnosticGroup[]) => void = () => {}
    calls['system']?.mockImplementationOnce(
      () => new Promise<DiagnosticGroup[]>((resolve) => (finish = resolve))
    )
    fireEvent.click(screen.getByTestId('diagnostics-rerun'))
    expect(calls['system']).toHaveBeenCalledTimes(2)
    expect(calls['agent']).toHaveBeenCalledTimes(2)
    expect((screen.getByTestId('diagnostics-rerun') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-level="pending"]')).toBeTruthy()
    await act(async () => finish(SYSTEM))
    await waitFor(() =>
      expect((screen.getByTestId('diagnostics-rerun') as HTMLButtonElement).disabled).toBe(false)
    )
    expect(document.querySelector('[data-level="pending"]')).toBeNull()
  })

  it('action « Réglages › Agents » d’un agent : la page de cet agent', async () => {
    const onOpenAgent = vi.fn()
    const onSection = vi.fn()
    await show({ onOpenAgent, onSection })
    fireEvent.click(await screen.findByTestId('diag-action-open-agents-settings'))
    expect(onOpenAgent).toHaveBeenCalledWith('mock')
    expect(onSection).not.toHaveBeenCalled()
  })
})
