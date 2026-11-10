import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { contextBreakdown } from '@shared/context-breakdown'
import type { TranscriptItem } from '@shared/transcript'
import { SessionContext } from './SessionContext'
import { SessionRunning } from './SessionRunning'
import { useMcpTokens } from './SessionTab'

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
