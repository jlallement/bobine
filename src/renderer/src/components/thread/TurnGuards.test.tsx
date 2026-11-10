import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import type { TerminalState } from '@shared/terminal-output'
import type { TranscriptItem } from '@shared/transcript'
import { TurnControlsContext, type TurnControls } from '../../turn-controls'
import { lastOutputAt, StalledNotice, stalledMinutes } from './StalledNotice'
import { CostCapCard } from './CostCapCard'
import { TurnLimitCard } from './TurnLimitCard'

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')

function controls(change: Partial<TurnControls> = {}): TurnControls {
  return {
    busy: true,
    cancel: vi.fn(),
    stalledAfterMs: 3 * 60_000,
    answerCostCap: vi.fn(),
    answerTurnLimit: vi.fn(),
    ...change
  }
}

describe('commande sans sortie (fiche 157)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('minutes à signaler au-delà du seuil ; la dernière sortie remet le compte à zéro', () => {
    expect(stalledMinutes(0, 2 * 60_000, 3 * 60_000)).toBeUndefined()
    expect(stalledMinutes(0, 3 * 60_000, 3 * 60_000)).toBe(3)
    expect(stalledMinutes(0, 2_000, 1_000)).toBe(1)
    expect(lastOutputAt('outil-a', 10, 100)).toBe(100)
    expect(lastOutputAt('outil-a', 10, 500)).toBe(100)
    expect(lastOutputAt('outil-a', 12, 900)).toBe(900)
  })

  it('« Aucune sortie depuis 3 min » et « Interrompre » ; rien hors du tour ou après la fin', () => {
    const value = controls()
    const terminal: TerminalState = { output: 'Résolution…\n' }
    const view = (state: TerminalState, c: TurnControls = value) => (
      <TurnControlsContext.Provider value={c}>
        <StalledNotice toolCallId="silencieuse" terminal={state} />
      </TurnControlsContext.Provider>
    )
    const { rerender } = render(view(terminal))
    expect(screen.queryByTestId('stalled-notice')).toBeNull()
    act(() => vi.advanceTimersByTime(3 * 60_000))
    expect(screen.getByTestId('stalled-notice').textContent).toContain(
      t('turnGuards.stalled.notice', { count: 3 })
    )
    fireEvent.click(screen.getByTestId('stalled-interrupt'))
    expect(value.cancel).toHaveBeenCalledTimes(1)
    // Une nouvelle sortie : l'avis disparaît.
    rerender(view({ output: `${terminal.output}suite\n` }))
    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.queryByTestId('stalled-notice')).toBeNull()
    // Commande finie, ou tour fini : rien.
    act(() => vi.advanceTimersByTime(4 * 60_000))
    rerender(view({ output: 'x', exited: true, exitCode: 0 }))
    expect(screen.queryByTestId('stalled-notice')).toBeNull()
    rerender(view({ output: 'x' }, controls({ busy: false })))
    expect(screen.queryByTestId('stalled-notice')).toBeNull()
  })

  it('sans contrôles du tour (fil d’un sous-agent) : rien', () => {
    render(<StalledNotice toolCallId="seule" terminal={{ output: '' }} />)
    act(() => vi.advanceTimersByTime(10 * 60_000))
    expect(screen.queryByTestId('stalled-notice')).toBeNull()
  })
})

describe('carte « Plafond atteint » (fiche 157)', () => {
  const item: Extract<TranscriptItem, { kind: 'cost-cap' }> = {
    kind: 'cost-cap',
    id: 7,
    limit: 1,
    unit: 'USD',
    spent: 1.2,
    step: 1,
    interrupted: true
  }

  it('dépense et plafond, « Continuer (plafond + 1 $) » ou « Arrêter »', () => {
    const value = controls()
    render(
      <TurnControlsContext.Provider value={value}>
        <CostCapCard item={item} />
      </TurnControlsContext.Provider>
    )
    expect(plain(screen.getByTestId('cost-cap-card').textContent)).toContain(
      plain(t('turnGuards.cap.title'))
    )
    fireEvent.click(screen.getByTestId('cost-cap-continue'))
    expect(value.answerCostCap).toHaveBeenCalledWith(7, 'continue')
    fireEvent.click(screen.getByTestId('cost-cap-stop'))
    expect(value.answerCostCap).toHaveBeenCalledWith(7, 'stop')
  })

  it('une fois répondue : le plafond relevé, plus de boutons', () => {
    render(
      <TurnControlsContext.Provider value={controls()}>
        <CostCapCard item={{ ...item, answer: 'continue', raisedTo: 3 }} />
      </TurnControlsContext.Provider>
    )
    expect(screen.queryByTestId('cost-cap-continue')).toBeNull()
    expect(plain(screen.getByTestId('cost-cap-answer').textContent)).toMatch(/3/)
  })

  it('message retenu : cité sur la carte ; carte remplacée : plus de boutons', () => {
    const { rerender } = render(
      <TurnControlsContext.Provider value={controls()}>
        <CostCapCard item={{ ...item, interrupted: false, held: 'Encore un module' }} />
      </TurnControlsContext.Provider>
    )
    expect(screen.getByTestId('cost-cap-held').textContent).toContain('Encore un module')
    expect(screen.getByTestId('cost-cap-held').textContent).toContain(t('turnGuards.cap.held'))
    rerender(
      <TurnControlsContext.Provider value={controls()}>
        <CostCapCard item={{ ...item, held: 'Encore', superseded: true }} />
      </TurnControlsContext.Provider>
    )
    expect(screen.queryByTestId('cost-cap-continue')).toBeNull()
  })
})

describe('carte « limite d’étapes » (fiche 209)', () => {
  type Card = Extract<TranscriptItem, { kind: 'turn-limit' }>
  const card = (change: Partial<Card> = {}): Card => ({
    kind: 'turn-limit',
    id: 9,
    refused: false,
    reopen: false,
    ...change
  })
  const show = (item: Card, value: TurnControls | null = controls({ busy: false })) =>
    render(
      <TurnControlsContext.Provider value={value}>
        <TurnLimitCard item={item} />
      </TurnControlsContext.Provider>
    )
  const buttons = () =>
    screen.queryAllByRole('button').map((b) => [b.textContent, b.className.includes('primary')])

  it('travail arrêté : « Continuer » seul', () => {
    const value = controls({ busy: false })
    show(card(), value)
    expect(plain(screen.getByTestId('turn-limit-card').textContent)).toContain(
      plain(t('turnGuards.limit.title'))
    )
    expect(buttons()).toEqual([[t('turnGuards.limit.continue'), true]])
    fireEvent.click(screen.getByTestId('turn-limit-continue'))
    expect(value.answerTurnLimit).toHaveBeenCalledWith(9, 'continue')
  })

  it('refus : « Rouvrir la session et continuer » en premier, puis la session neuve', () => {
    show(card({ refused: true, reopen: true }))
    expect(screen.getByTestId('turn-limit-card').textContent).toContain(
      t('turnGuards.limit.refusedDetail')
    )
    expect(buttons()).toEqual([
      [t('turnGuards.limit.reopen'), true],
      [t('turnGuards.limit.renew'), false]
    ])
  })

  it('refus sans réouverture possible : la session neuve seule, en bouton principal', () => {
    show(card({ refused: true }))
    expect(buttons()).toEqual([[t('turnGuards.limit.renew'), true]])
  })

  it('répondue, remplacée, ou sans contrôles : plus de boutons ; pendant une réponse : grisés', () => {
    const { unmount } = show(card({ refused: true, answer: 'renew' }))
    expect(buttons()).toEqual([])
    expect(screen.getByTestId('turn-limit-answer').textContent).toBe(t('turnGuards.limit.renewed'))
    unmount()
    show(card({ superseded: true }))
    expect(buttons()).toEqual([])
    cleanup()
    show(card(), null)
    expect(buttons()).toEqual([])
    cleanup()
    show(card(), controls({ busy: true }))
    expect(screen.getByTestId('turn-limit-continue').hasAttribute('disabled')).toBe(true)
  })
})
