import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { McpAgentView } from '@shared/mcp'
import type { RuleFileView } from '@shared/rules'
import { SessionSettingsMenu } from './Menus'

beforeAll(() => {
  // Le positionnement des menus (Radix) suit la taille de leur contenu ; jsdom ne la mesure pas.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const rule: RuleFileView = {
  path: '/maison/.bob/rules-code/style.md',
  label: '~/style.md',
  scope: 'personal'
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('menu « Réglages de la session »', () => {
  it('s’affiche une fois les règles lues, à sa taille, pas avant (fiche 082)', async () => {
    const rules = deferred<RuleFileView[]>()
    render(
      <Tooltip.Provider>
        <SessionSettingsMenu
          controls={[]}
          agentLabel="Agent factice"
          disabled={false}
          onSetControl={vi.fn()}
          onLoadRules={() => rules.promise}
          onOpenRule={vi.fn()}
        />
      </Tooltip.Provider>
    )
    fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
    expect(screen.queryByTestId('session-settings-content')).toBeNull()
    await act(async () => rules.resolve([rule]))
    expect(screen.getByTestId('session-settings-content')).toBeTruthy()
    expect(screen.getAllByTestId('rule-item').map((item) => item.textContent)).toEqual([
      expect.stringContaining('~/style.md')
    ])
  })

  it('règles trop lentes : affiché quand même après 300 ms, avec « … » en attendant', async () => {
    vi.useFakeTimers()
    try {
      render(
        <Tooltip.Provider>
          <SessionSettingsMenu
            controls={[]}
            agentLabel="Agent factice"
            disabled={false}
            onSetControl={vi.fn()}
            onLoadRules={() => new Promise<RuleFileView[]>(() => {})}
          />
        </Tooltip.Provider>
      )
      fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
      expect(screen.queryByTestId('session-settings-content')).toBeNull()
      await act(async () => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByTestId('session-settings-content').textContent).toContain('…')
    } finally {
      vi.useRealTimers()
    }
  })

  it('affiché par le repli de 300 ms : ce qui arrive ensuite attend sa fermeture (fiche 234)', async () => {
    // Ouvert au-dessus de la zone de saisie, un menu qui grandit fait monter ses lignes sous le
    // pointeur : le clic visé sur « Modèle » cochait « Réponses détaillées ».
    vi.useFakeTimers()
    try {
      const late = deferred<RuleFileView[]>()
      const onLoadRules = vi
        .fn<() => Promise<RuleFileView[]>>()
        .mockReturnValueOnce(late.promise)
        .mockReturnValue(new Promise<RuleFileView[]>(() => {}))
      render(
        <Tooltip.Provider>
          <SessionSettingsMenu
            controls={[]}
            agentLabel="Agent factice"
            disabled={false}
            onSetControl={vi.fn()}
            onLoadRules={onLoadRules}
          />
        </Tooltip.Provider>
      )
      const trigger = screen.getByTestId('session-settings')
      fireEvent.keyDown(trigger, { key: 'Enter' })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByTestId('session-settings-content').textContent).toContain('…')
      await act(async () => late.resolve([rule]))
      expect(screen.getByTestId('session-settings-content').textContent).toContain('…')
      expect(screen.queryByTestId('rule-item')).toBeNull()
      // Refermé puis rouvert : les règles arrivées entre-temps sont là d'emblée.
      fireEvent.keyDown(screen.getByTestId('session-settings-content'), { key: 'Escape' })
      expect(screen.queryByTestId('session-settings-content')).toBeNull()
      fireEvent.keyDown(trigger, { key: 'Enter' })
      await act(async () => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getAllByTestId('rule-item').map((item) => item.textContent)).toEqual([
        expect.stringContaining('~/style.md')
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('Serveurs MCP : « bobine · intégré » et les outils reçus, puis les serveurs de l’agent (fiche 099)', async () => {
    const open = vi.fn()
    const mcp: McpAgentView = {
      profileId: 'bob',
      label: 'IBM Bob',
      files: { global: '~/.bob/settings/mcp.json' },
      servers: []
    }
    render(
      <Tooltip.Provider>
        <SessionSettingsMenu
          controls={[]}
          agentLabel="IBM Bob"
          disabled={false}
          onSetControl={vi.fn()}
          onLoadMcp={async () => mcp}
          onLoadAppTools={async () => ({
            names: ['ask_user', 'terminal_read', 'terminal_run'],
            tokens: 610
          })}
          onOpenMcpSettings={open}
        />
      </Tooltip.Provider>
    )
    fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
    await act(async () => {})
    const row = screen.getByTestId('session-app-tools')
    expect(row.textContent).toBe(
      'bobine · intégré3 outils dans cette conversation · ≈ 610 jetons · Voir les outils'
    )
    expect(row.title).toBe('ask_user, terminal_read, terminal_run')
    expect(screen.getByTestId('session-mcp-none').textContent).toContain('Aucun autre serveur MCP')
    fireEvent.click(row)
    expect(open).toHaveBeenCalledWith('bobine')
  })

  it('ligne « Aucun autre serveur MCP » : l’onglet de l’agent de la conversation', async () => {
    const open = vi.fn()
    render(
      <Tooltip.Provider>
        <SessionSettingsMenu
          controls={[]}
          agentLabel="IBM Bob"
          disabled={false}
          onSetControl={vi.fn()}
          onLoadMcp={async () => undefined}
          onLoadAppTools={async () => ({ names: [], tokens: 0 })}
          onOpenMcpSettings={open}
        />
      </Tooltip.Provider>
    )
    fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
    await act(async () => {})
    expect(screen.getByTestId('session-app-tools').textContent).toContain(
      '0 outil dans cette conversation'
    )
    fireEvent.click(screen.getByTestId('session-mcp-none'))
    expect(open).toHaveBeenCalledWith()
  })

  it('démonté avant 300 ms : plus de minuteur en attente, rien ne touche l’état ensuite', async () => {
    // Le repli de 300 ms n'était jamais annulé : il appelait setOpen après le démontage, et en CI
    // après la fin de jsdom (« window is not defined »).
    vi.useFakeTimers()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const rules = deferred<RuleFileView[]>()
      const { unmount } = render(
        <Tooltip.Provider>
          <SessionSettingsMenu
            controls={[]}
            agentLabel="Agent factice"
            disabled={false}
            onSetControl={vi.fn()}
            onLoadRules={() => rules.promise}
          />
        </Tooltip.Provider>
      )
      fireEvent.keyDown(screen.getByTestId('session-settings'), { key: 'Enter' })
      expect(vi.getTimerCount()).toBeGreaterThan(0)
      unmount()
      expect(vi.getTimerCount()).toBe(0)
      await act(async () => {
        rules.resolve([rule])
        vi.advanceTimersByTime(1000)
      })
      expect(errors).not.toHaveBeenCalled()
      expect(warnings).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
      warnings.mockRestore()
      vi.useRealTimers()
    }
  })
})
