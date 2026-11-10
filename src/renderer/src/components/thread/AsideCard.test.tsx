import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { AsideView } from '@shared/aside'
import type { AsideState } from '../../useAside'
import { ComposerInbox } from '../../useFileDrop'
import { AsideCard } from './AsideCard'

function state(view?: AsideView, overrides: Partial<AsideState> = {}): AsideState {
  return {
    conversationId: 'c1',
    view,
    visible: true,
    focusTick: 0,
    withContext: false,
    setWithContext: vi.fn(),
    start: vi.fn(),
    ask: vi.fn(),
    close: vi.fn(),
    ...overrides
  }
}

const answered: AsideView = {
  conversationId: 'c1',
  status: 'ready',
  agentLabel: 'Agent factice',
  exchanges: [{ question: 'Quel flag ?', answer: 'C’est `--trust`.', refused: 1, tools: 0 }],
  cost: { amount: 0.0125, currency: 'USD' }
}

describe('carte « Aparté » (fiche 180)', () => {
  it('vide : champ prêt, estimation du fil joint, « Demander » quand la question est tapée', () => {
    const aside = state()
    render(
      <AsideCard
        aside={aside}
        items={[{ kind: 'user', id: 1, text: 'x'.repeat(400) }]}
        inbox={new ComposerInbox()}
      />
    )
    const input = screen.getByTestId('aside-input')
    expect(document.activeElement).toBe(input)
    expect(screen.getByRole('region', { name: i18next.t('aside.title') })).toBeTruthy()
    expect(screen.getByText(/jetons/).textContent).toMatch(/≈ \d+ jetons/)
    const ask = screen.getByTestId('aside-ask') as HTMLButtonElement
    expect(ask.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Quel flag ?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(aside.ask).toHaveBeenCalledWith('Quel flag ?')
    fireEvent.click(screen.getByTestId('aside-with-context'))
    expect(aside.setWithContext).toHaveBeenCalledWith(true)
  })

  it('réponse, refus d’office, coût ; « Ajouter au fil » met la citation dans la saisie', () => {
    const aside = state(answered)
    const inbox = new ComposerInbox()
    const prefill = vi.spyOn(inbox, 'prefill')
    render(<AsideCard aside={aside} items={[]} inbox={inbox} />)
    expect(screen.getByTestId('aside-answer').textContent).toContain('--trust')
    expect(screen.getByTestId('aside-refused').textContent).toBe(
      i18next.t('aside.refused', { count: 1 })
    )
    expect(screen.getByTestId('aside-cost').textContent).toContain('0,0125')
    fireEvent.click(screen.getByTestId('aside-quote'))
    expect(aside.close).toHaveBeenCalled()
    expect(prefill).toHaveBeenCalledWith({
      id: 'c1',
      text: '> **Aparté** — Quel flag ?\n>\n> C’est `--trust`.\n',
      attachments: []
    })
  })

  it('pendant la réponse : « Demander » désactivé, pas de citation ; Échap ferme', () => {
    const aside = state({
      ...answered,
      status: 'answering',
      exchanges: [{ question: 'Quel flag ?', answer: '', refused: 0, tools: 0 }]
    })
    render(<AsideCard aside={aside} items={[]} inbox={new ComposerInbox()} />)
    expect(screen.getByText(i18next.t('aside.answering'))).toBeTruthy()
    expect(screen.queryByTestId('aside-quote')).toBeNull()
    fireEvent.change(screen.getByTestId('aside-input'), { target: { value: 'Autre' } })
    expect((screen.getByTestId('aside-ask') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(screen.getByTestId('aside-input'), { key: 'Escape' })
    expect(aside.close).toHaveBeenCalled()
  })
})
