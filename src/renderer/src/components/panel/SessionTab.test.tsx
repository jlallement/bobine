import * as Tooltip from '@radix-ui/react-tooltip'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { contextBreakdown } from '@shared/context-breakdown'
import type { PrTrack } from '@shared/pr-tracking'
import { emptyTranscript, type TranscriptItem } from '@shared/transcript'
import i18next from 'i18next'
import { SessionContext } from './SessionContext'
import { SessionEnvironment } from './SessionEnvironment'
import { SessionRunning } from './SessionRunning'
import { SessionTab, useMcpTokens, type SessionTabData } from './SessionTab'

const items: TranscriptItem[] = [{ kind: 'user', id: 1, text: 'x'.repeat(4000) }]
const wrap = (node: React.ReactNode) => render(<Tooltip.Provider>{node}</Tooltip.Provider>)
const lines = () =>
  screen.getAllByTestId('session-line').map((line) => line.getAttribute('data-line'))

describe('onglet « Session » : contexte (fiche 166)', () => {
  it('avec le total de l’agent : barre, pourcentage, Agent et Libre', () => {
    const breakdown = contextBreakdown({
      items,
      usage: { context: { used: 50_000, size: 200_000 }, cost: { amount: 1.5, currency: 'USD' } },
      appTools: 6_000
    })
    const { container } = wrap(<SessionContext breakdown={breakdown} agentLabel="Bob" />)
    expect(lines()).toEqual(['messages', 'bobine', 'agent', 'free'])
    expect(screen.getByTestId('session-context-bar')).toBeTruthy()
    expect(screen.getByTestId('session-context-total').textContent).toContain('25')
    // Jamais d'argent (fiche 113), même quand l'agent annonce un coût.
    expect(container.textContent).not.toMatch(/\$|USD|1[.,]5/)
  })

  it('sans total (Bob) : « ≈ N utilisés », ni barre, ni Agent, ni Libre ; l’agent est nommé', () => {
    const breakdown = contextBreakdown({ items, appTools: 6_000 })
    wrap(<SessionContext breakdown={breakdown} agentLabel="Bob" />)
    expect(lines()).toEqual(['messages', 'bobine'])
    expect(screen.queryByTestId('session-context-bar')).toBeNull()
    expect(screen.getByTestId('session-context-total').textContent).toMatch(/^≈ /)
    expect(screen.getByTestId('session-context-hint').textContent).toContain('Bob')
  })

  it('total estimé après une compaction (fiche 257) : « ≈ » au total, « Libre » estimé, expliqué', () => {
    const breakdown = contextBreakdown({
      items,
      usage: { context: { used: 9_871, size: 628_000, estimated: true } }
    })
    wrap(<SessionContext breakdown={breakdown} agentLabel="OpenCode" />)
    const total = screen.getByTestId('session-context-total')
    expect(total.textContent).toMatch(/^≈ /)
    expect(total.hasAttribute('data-estimated')).toBe(true)
    const free = screen.getAllByTestId('session-line').find((l) => l.dataset['line'] === 'free')
    expect(free?.textContent).toContain('≈')
    expect(screen.getByTestId('session-context-estimated').textContent).toContain('OpenCode')
  })

  it('total de l’agent : pas d’explication d’estimation, « Libre » exact', () => {
    const breakdown = contextBreakdown({
      items,
      usage: { context: { used: 11_965, size: 628_000 } }
    })
    wrap(<SessionContext breakdown={breakdown} agentLabel="OpenCode" />)
    expect(screen.getByTestId('session-context-total').textContent).not.toMatch(/^≈ /)
    expect(screen.queryByTestId('session-context-estimated')).toBeNull()
  })

  const mcpLine = () =>
    screen.getAllByTestId('session-line').find((l) => l.dataset['line'] === 'mcp')
  const withMcp = (mcp: { tokens: number; servers: number; measured: number; testing: boolean }) =>
    contextBreakdown({ items, mcp })

  it('autres MCP jamais mesurés : « Mesurer », qui lance la mesure sur demande', () => {
    const onMeasure = vi.fn()
    wrap(
      <SessionContext
        breakdown={withMcp({ tokens: 0, servers: 2, measured: 0, testing: false })}
        agentLabel="Bob"
        onMeasureMcp={onMeasure}
      />
    )
    expect(mcpLine()?.textContent).toContain('Mesurer')
    expect(mcpLine()?.textContent).not.toContain('≈')
    expect(onMeasure).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('session-measure-mcp'))
    expect(onMeasure).toHaveBeenCalledTimes(1)
  })

  it('autres MCP : valeur connue, « 1 sur 2 mesuré », rafraîchir ; « mesure… » pendant la mesure', () => {
    const { rerender } = wrap(
      <SessionContext
        breakdown={withMcp({ tokens: 1_500, servers: 2, measured: 1, testing: false })}
        agentLabel="Bob"
        onMeasureMcp={() => {}}
      />
    )
    expect(mcpLine()?.textContent).toContain('≈ 1,5k')
    expect(screen.getByTestId('session-mcp-partial').textContent).toBe('1 sur 2 mesuré')
    expect(screen.getByTestId('session-measure-mcp')).toBeTruthy()
    rerender(
      <Tooltip.Provider>
        <SessionContext
          breakdown={withMcp({ tokens: 1_500, servers: 2, measured: 1, testing: true })}
          agentLabel="Bob"
          onMeasureMcp={() => {}}
        />
      </Tooltip.Provider>
    )
    expect(mcpLine()?.textContent).toBe('Autres serveurs MCPmesure…')
  })
})

describe('onglet « Session » : mesure MCP sur demande (fiche 166)', () => {
  const originalApi = window.api
  afterEach(() => {
    // Démontés avant de rendre l'API d'origine : leurs effets de fin appellent encore celle de
    // l'essai (QUA-1/2, fiche 250).
    cleanup()
    window.api = originalApi
  })

  it('l’affichage ne lance aucune sonde ; « measure » teste les serveurs activés', async () => {
    const test = vi.fn(async () => ({ ok: true as const, tools: ['a'], toolTokens: 900, ms: 1 }))
    window.api = { ...originalApi, mcp: { test } } as unknown as Window['api']
    const view = {
      profileId: 'p-demande',
      label: 'Bob',
      files: { global: '/g' },
      servers: [
        {
          name: 'a',
          transport: 'stdio' as const,
          enabled: true,
          scope: 'global' as const,
          file: '/g'
        }
      ]
    }
    const { result } = renderHook(() => useMcpTokens(async () => view, 'p-demande'))
    await waitFor(() => expect(result.current.line?.servers).toBe(1))
    expect(result.current.line).toMatchObject({ measured: 0, tokens: 0, testing: false })
    expect(test).not.toHaveBeenCalled()
    act(() => result.current.measure())
    await waitFor(() => expect(result.current.line).toMatchObject({ measured: 1, tokens: 900 }))
    expect(test).toHaveBeenCalledTimes(1)
  })
})

describe('onglet « Session » : en cours (fiche 166)', () => {
  it('durée, Arrêter quand Bobine sait, rien pour un sous-agent ; terminées repliées', () => {
    const onStop = vi.fn()
    const onOpenChild = vi.fn()
    const now = Date.now()
    wrap(
      <SessionRunning
        running={{
          running: [
            {
              key: 'terminal:1',
              kind: 'terminal',
              label: 'zsh',
              startedAt: now - 65_000,
              stop: { kind: 'terminal', tabId: '1' }
            },
            { key: 'subagent:a', kind: 'subagent', label: 'Explorer', startedAt: now - 5_000 },
            {
              key: 'child:f',
              kind: 'child',
              label: 'Fille',
              childId: 'f',
              startedAt: now,
              stop: { kind: 'child', childId: 'f' }
            }
          ],
          finished: [
            { key: 'server:web', kind: 'server', label: 'web', startedAt: 0, endedAt: 8_000 }
          ]
        }}
        onStop={onStop}
        onOpenChild={onOpenChild}
      />
    )
    const stops = screen.getAllByTestId('session-stop')
    expect(stops).toHaveLength(2)
    expect(screen.getAllByTestId('session-entry-duration')[0]?.textContent).toMatch(/1/)
    fireEvent.click(stops[0] as HTMLElement)
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ key: 'terminal:1' }))
    fireEvent.click(screen.getByText('Fille'))
    expect(onOpenChild).toHaveBeenCalledWith('f')
    expect(screen.queryByTestId('session-finished')).toBeNull()
    fireEvent.click(screen.getByTestId('session-finished-toggle'))
    expect(screen.getByTestId('session-finished').textContent).toContain('web')
  })
})

describe('onglet « Session » : dossier d’une discussion (fiche 224)', () => {
  const folder = '/Users/moi/Library/Application Support/Bobine/discussions/3973c57d-c6ab-4c06'
  const env = (discussion: boolean, onRevealWorkspace = vi.fn()) =>
    wrap(
      <SessionEnvironment
        agentLabel="Bob"
        modelControl={undefined}
        modeControl={undefined}
        canSet={false}
        onSetControl={() => {}}
        workspace={folder}
        discussion={discussion}
        onRevealWorkspace={onRevealWorkspace}
        onOpenGit={() => {}}
        finder
      />
    )

  it('« Documents : Cette discussion », jamais l’identifiant ni le chemin ; s’affiche dans le Finder', async () => {
    const onReveal = vi.fn()
    env(true, onReveal)
    const button = screen.getByTestId('session-folder')
    expect(button.textContent).toBe(i18next.t('sessionTab.thisDiscussion'))
    expect(screen.getByTestId('session-environment').textContent).not.toMatch(/3973c57d/)
    expect(screen.getByText(i18next.t('sessionTab.documents'))).toBeTruthy()
    fireEvent.focus(button)
    await waitFor(() =>
      expect(screen.getAllByRole('tooltip')[0]?.textContent).toBe(
        `${i18next.t('workspaceMenu.revealFinder')} — ${i18next.t('sessionTab.discussionDocuments')}`
      )
    )
    expect(document.body.textContent).not.toMatch(/discussions\//)
    fireEvent.click(button)
    expect(onReveal).toHaveBeenCalled()
  })

  it('espace Code : le nom du dossier, comme avant', () => {
    env(false)
    expect(screen.getByTestId('session-folder').textContent).toBe('3973c57d-c6ab-4c06')
  })
})

/**
 * Onglet entier, l'app simulée par `window.api` : remplaçant des vérifications de composant des
 * suites e2e `session` (inventaire C, #3, #4) et `pr-ci` (inventaire B, #12).
 */
describe('onglet « Session » rendu entier (fiches 166, 176)', () => {
  const originalApi = window.api
  afterEach(() => {
    cleanup()
    window.api = originalApi
  })

  const select = (category: string, current: string, values: string[]) => ({
    id: category,
    name: category,
    category,
    type: 'select' as const,
    currentValue: current,
    options: values.map((value) => ({ value, name: value }))
  })
  const snapshot = {
    status: 'ready',
    info: { profileId: 'mock', profileLabel: 'Agent factice', agentName: 'Agent factice' },
    controls: [
      select('model', 'mock/rapide', ['mock/rapide', 'mock/lent']),
      select('mode', 'code', ['code', 'plan'])
    ],
    commands: [],
    promptCapabilities: {},
    queued: []
  } as unknown as SessionTabData['snapshot']

  function show(pr: PrTrack = { status: 'none', checkedAt: 0 }) {
    window.api = {
      ...originalApi,
      conversations: { appTools: async () => ({ tokens: 0 }) },
      changes: { git: async () => null },
      pr: { status: async () => pr, onChanged: () => () => {} }
    } as unknown as Window['api']
    const onOpenGit = vi.fn()
    const data: SessionTabData = {
      snapshot,
      settings: null,
      transcript: emptyTranscript,
      workspace: '/Users/moi/demo',
      gitBranch: 'main',
      running: { running: [], finished: [] },
      onSetControl: () => {},
      onRevealWorkspace: () => {},
      onRevealFolder: () => {},
      onWarn: () => {},
      onOpenGit,
      onOpenConversationChanges: () => {},
      onOpenConversation: () => {},
      onLoadMcp: async () => undefined
    }
    wrap(<SessionTab conversationId="c1" data={data} />)
    return { onOpenGit }
  }

  it('environnement : agent, modèle, mode, dossier et branche', () => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    const { onOpenGit } = show()
    const env = screen.getByTestId('session-environment')
    expect(screen.getByTestId('session-agent').textContent).toBe('Agent factice')
    expect(env.querySelector('[data-testid=model-chip]')?.textContent).toContain('rapide')
    expect(env.querySelector('[data-testid=mode-chip]')?.textContent).toContain('code')
    expect(screen.getByTestId('session-folder').textContent).toBe('demo')
    expect(screen.getByTestId('session-branch').textContent).toBe('main')
    fireEvent.click(screen.getByTestId('session-branch'))
    expect(onOpenGit).toHaveBeenCalledTimes(1)
    // La puce du modèle ouvre le même menu que dans la zone de saisie.
    fireEvent.click(env.querySelector('[data-testid=model-chip]') as HTMLElement)
    expect(screen.getByTestId('control-model-mock/lent')).toBeTruthy()
  })

  it('PR suivie : ligne « Pull request » avec l’état des contrôles, qui ouvre la vue Git', async () => {
    const { onOpenGit } = show({
      status: 'found',
      checkedAt: 0,
      options: { autoFix: false, autoMerge: false },
      pr: {
        number: 7,
        url: 'https://github.com/o/r/pull/7',
        title: 'x',
        state: 'open',
        draft: false,
        head: 'h1',
        checks: [
          { name: 'CI / test', state: 'failed' },
          { name: 'CI / lint', state: 'passed' }
        ],
        summary: 'failed',
        comments: 0,
        mergeable: 'mergeable',
        base: 'main',
        mergeState: 'clean'
      }
    })
    const line = await screen.findByTestId('session-pr-line')
    expect(line.textContent).toContain(`#7 · ${i18next.t('prTrack.checks.failed', { count: 1 })}`)
    fireEvent.click(line)
    expect(onOpenGit).toHaveBeenCalledTimes(1)
  })

  it('sans PR : pas de ligne « Pull request »', async () => {
    show()
    await waitFor(() => expect(screen.getByTestId('session-tab')).toBeTruthy())
    expect(screen.queryByTestId('session-pr')).toBeNull()
  })
})
