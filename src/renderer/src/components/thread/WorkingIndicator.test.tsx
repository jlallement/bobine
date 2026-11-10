import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { WorkingIndicator } from './WorkingIndicator'

const user = (id: number): TranscriptItem => ({ kind: 'user', id, text: `message ${id}` })
const agent = (id: number): TranscriptItem => ({ kind: 'agent', id, text: `réponse ${id}` })
const elapsed = () => screen.getByTestId('working').querySelector('.working-time')?.textContent
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe('chronomètre du tour (fiche 095)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 18, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('repart de zéro quand le message du nouveau tour arrive après le statut « occupé »', () => {
    const first = render(<WorkingIndicator conversationId="c-tours" items={[user(1)]} />)
    wait(67_000)
    expect(elapsed()).toBe('1 min 07')
    first.unmount()

    // 2e tour : l'indicateur apparaît avant le message de l'utilisateur, puis le message arrive.
    const before = [user(1), agent(2)]
    const second = render(<WorkingIndicator conversationId="c-tours" items={before} />)
    second.rerender(<WorkingIndicator conversationId="c-tours" items={[...before, user(3)]} />)
    wait(6_000)
    expect(elapsed()).toBe('6 s')
  })

  it('garde le début du tour en revenant sur la conversation', () => {
    const items = [user(1)]
    const first = render(<WorkingIndicator conversationId="c-retour" items={items} />)
    wait(10_000)
    first.unmount()
    render(<WorkingIndicator conversationId="c-retour" items={items} />)
    wait(1_000)
    expect(elapsed()).toBe('11 s')
  })
})

describe('chronomètre de l’étape (fiche 128)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 23, 18, 0))
  })
  afterEach(() => vi.useRealTimers())

  const thought = (id: number): TranscriptItem => ({ kind: 'thought', id, text: 'je réfléchis' })
  const patch = (id: number): TranscriptItem => ({
    kind: 'tool',
    id,
    toolCallId: `t${id}`,
    title: 'patch',
    toolKind: 'edit',
    status: 'pending',
    content: [],
    locations: []
  })
  const time = () => screen.getByTestId('working').querySelector('.working-time')

  it('le temps repart de zéro à chaque étape ; la durée du tour est en infobulle', () => {
    const ui = (items: TranscriptItem[]) => (
      <WorkingIndicator conversationId="c-etapes" items={items} />
    )
    const first = [user(1), thought(2)]
    const view = render(ui(first))
    wait(10_000)
    expect(time()?.textContent).toBe('10 s')
    // Le patch est annoncé : nouvelle étape, le temps repart de zéro.
    view.rerender(ui([...first, patch(3)]))
    wait(5_000)
    expect(time()?.textContent).toBe('5 s')
    expect(screen.getByTestId('working').querySelector('.working-label')?.textContent).toBe(
      'Prépare une modification…'
    )
    // Le tour, lui, dure depuis le message.
    expect(time()?.getAttribute('title')).toBe('Tour commencé il y a 15 s')
    wait(55_000)
    expect(time()?.textContent).toBe('1 min 00')
    expect(time()?.getAttribute('title')).toBe('Tour commencé il y a 1 min 10')
  })
})
