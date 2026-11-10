import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TipId } from '@shared/tips'
import { TipsContext, type Tips } from '../../useTips'
import { ComposerTip } from './ComposerTip'

function fakeTips(current: TipId | null = null): Tips {
  const tips: Tips = {
    current,
    offer: vi.fn(),
    close: vi.fn(),
    never: vi.fn(),
    used: vi.fn()
  }
  return tips
}

const open = vi.fn()
const originalApi = window.api
beforeEach(() => {
  vi.useFakeTimers()
  window.api = { ...originalApi, help: { open } } as unknown as Window['api']
})
afterEach(() => {
  vi.useRealTimers()
  window.api = originalApi
})

const usage = (used: number) => ({ context: { used, size: 100 } })

describe('astuces de la saisie (fiche 191)', () => {
  it('aparté : offerte après 2 s de texte tapé pendant que l’agent travaille, pas avant', () => {
    const tips = fakeTips()
    const view = (busy: boolean, hasText: boolean) => (
      <TipsContext.Provider value={tips}>
        <ComposerTip busy={busy} hasText={hasText} usage={undefined} onTryAside={vi.fn()} />
      </TipsContext.Provider>
    )
    const { rerender } = render(view(false, true))
    act(() => vi.advanceTimersByTime(5000))
    expect(tips.offer).not.toHaveBeenCalled()
    rerender(view(true, true))
    act(() => vi.advanceTimersByTime(1900))
    expect(tips.offer).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(tips.offer).toHaveBeenCalledWith('aside')
  })

  it('aparté montrée : « Essayer » pose le texte en aparté, « En savoir plus », « Ne plus montrer », ×', () => {
    const tips = fakeTips('aside')
    const onTryAside = vi.fn()
    render(
      <TipsContext.Provider value={tips}>
        <ComposerTip busy hasText usage={undefined} onTryAside={onTryAside} />
      </TipsContext.Provider>
    )
    expect(screen.getByTestId('tip-aside').textContent).toContain('/btw')
    fireEvent.click(screen.getByTestId('tip-try'))
    expect(tips.used).toHaveBeenCalledWith('aside')
    expect(onTryAside).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('tip-learn-more'))
    expect(open).toHaveBeenCalledWith('aside')
    fireEvent.click(screen.getByTestId('tip-never'))
    expect(tips.never).toHaveBeenCalledWith('aside')
    fireEvent.click(screen.getByTestId('tip-close'))
    expect(tips.close).toHaveBeenCalled()
  })

  it('aparté montrée, texte envoyé : elle s’efface', () => {
    const tips = fakeTips('aside')
    render(
      <TipsContext.Provider value={tips}>
        <ComposerTip busy hasText={false} usage={undefined} onTryAside={vi.fn()} />
      </TipsContext.Provider>
    )
    expect(tips.close).toHaveBeenCalled()
  })

  it('contexte : au-delà de 85 %, une fois ; le pourcentage affiché', () => {
    const tips = fakeTips()
    const view = (used: number, t: Tips) => (
      <TipsContext.Provider value={t}>
        <ComposerTip busy={false} hasText={false} usage={usage(used)} onTryAside={vi.fn()} />
      </TipsContext.Provider>
    )
    const { rerender } = render(view(80, tips))
    expect(tips.offer).not.toHaveBeenCalled()
    rerender(view(86, tips))
    rerender(view(90, tips))
    expect(tips.offer).toHaveBeenCalledTimes(1)
    expect(tips.offer).toHaveBeenCalledWith('context')
    rerender(view(92, fakeTips('context')))
    expect(screen.getByTestId('tip-context').textContent).toContain('92')
  })

  it('sans fournisseur (réglage coupé hors app) : rien', () => {
    const { container } = render(
      <ComposerTip busy hasText usage={usage(99)} onTryAside={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('message répété (fiche 191)', () => {
  it('« Planifier… » ouvre la page des tâches ; « Ne plus montrer »', () => {
    const tips = { ...fakeTips('scheduled'), planRepeated: vi.fn() }
    render(
      <TipsContext.Provider value={tips}>
        <ComposerTip busy={false} hasText={false} usage={undefined} onTryAside={vi.fn()} />
      </TipsContext.Provider>
    )
    expect(screen.getByTestId('tip-scheduled').textContent).toContain('Troisième fois')
    fireEvent.click(screen.getByTestId('tip-plan'))
    expect(tips.planRepeated).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('tip-never'))
    expect(tips.never).toHaveBeenCalledWith('scheduled')
  })
})
