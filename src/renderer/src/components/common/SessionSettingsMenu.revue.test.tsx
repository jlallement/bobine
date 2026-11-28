/**
 * Essais M1 à M3 du testeur (second passage du lot 2, sur `4ca2e240`), gardés comme essais
 * permanents, assertions intactes. Adaptations : la relecture rend le dossier relu (`workspace`) ;
 * M3 exprime « autre conversation, autre dossier » par le dossier de la vue (`workspace`, posé par
 * le main), que l'essai d'origine ne pouvait pas dire (même vue aux deux ouvertures) ; M1 en
 * horloges simulées (mêmes durées), sans les `console.log` de diagnostic.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { McpAgentView, McpAuthState, McpAuthView } from '@shared/mcp'
import { resetMcpAuthStore } from '../../mcp-auth'
import { SessionSettingsMenu } from './Menus'

beforeAll(() => {
  // Le positionnement des menus (Radix) suit la taille de leur contenu ; jsdom ne la mesure pas.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

describe('REVUE menu ⚙ (fiche 293)', () => {
  const figma = {
    name: 'figma',
    transport: 'http' as const,
    url: 'https://mcp.figma.com/mcp',
    enabled: true,
    scope: 'global' as const,
    file: '~/.config/opencode/opencode.json',
    authPreset: 'figma'
  }
  const view: McpAgentView = {
    profileId: 'opencode',
    label: 'OpenCode',
    files: { global: '~/.config/opencode/opencode.json' },
    servers: [figma],
    oauth: true,
    workspace: '/projets/a'
  }
  const read = (status: McpAuthState['status'], workspace = '/projets/a'): McpAuthView => ({
    profileId: 'opencode',
    workspace,
    agentFound: true,
    servers: [{ profileId: 'opencode', name: 'figma', status }],
    terminal: {}
  })
  const original = window.api
  afterEach(() => {
    window.api = original
  })
  function mount(authStates: () => Promise<McpAuthView>, views: McpAgentView[] = [view]) {
    let opened = 0
    resetMcpAuthStore()
    window.api = {
      ...original,
      mcp: { test: vi.fn(), authStates, onAuthState: () => () => {} }
    } as unknown as Window['api']
    render(
      <Tooltip.Provider>
        <SessionSettingsMenu
          controls={[]}
          agentLabel="OpenCode"
          disabled={false}
          onSetControl={vi.fn()}
          onLoadMcp={async () => views[Math.min(opened++, views.length - 1)]}
          onLoadAppTools={async () => ({ names: [], tokens: 0 })}
        />
      </Tooltip.Provider>
    )
  }

  it('M1 dix ouvertures du menu : dix relectures chez l’agent (dix processus `auth list`)', async () => {
    // Horloges simulées au lieu de vraies pauses de 350 ms (règle de la fiche 250) ; mêmes durées.
    vi.useFakeTimers()
    try {
      const authStates = vi.fn(async () => read('connected'))
      mount(authStates)
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(350)
        })
        fireEvent.keyDown(screen.getByTestId('session-settings-content'), { key: 'Escape' })
        await act(async () => {})
      }
      expect(authStates.mock.calls.length).toBeLessThanOrEqual(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('M2 relecture lente : le menu attend 300 ms alors que tout le reste est lu', async () => {
    vi.useFakeTimers()
    try {
      mount(() => new Promise<McpAuthView>(() => {}))
      fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
      expect(screen.queryByTestId('session-settings-content')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('M3 dernier état connu (relu ailleurs) affiché et figé quand la relecture est lente', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      mount(
        () =>
          ++calls === 1 ? Promise.resolve(read('connected')) : new Promise<McpAuthView>(() => {}),
        [view, { ...view, workspace: '/projets/autre' }]
      )
      fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      fireEvent.keyDown(screen.getByTestId('session-settings-content'), { key: 'Escape' })
      // Autre conversation, autre dossier : l'agent dirait « à connecter », mais lentement.
      fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      expect(screen.getByTestId('session-mcp').textContent).not.toContain('connecté')
    } finally {
      vi.useRealTimers()
    }
  })
})
