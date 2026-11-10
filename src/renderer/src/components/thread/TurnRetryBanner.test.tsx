import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import { secondsLeft, TurnRetryBanner } from './TurnRetryBanner'

describe('bandeau de reconnexion (fiche 142)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('décompte la prochaine tentative, et « Réessayer maintenant »', () => {
    const onRetry = vi.fn()
    render(
      <TurnRetryBanner
        retry={{ cause: 'network', attempt: 3, max: 5, at: Date.now() + 8000 }}
        onRetry={onRetry}
      />
    )
    expect(screen.getByText(t('turnRetry.network'))).toBeTruthy()
    const detail = () => screen.getByTestId('turn-retry-detail').textContent
    expect(detail()).toBe(t('turnRetry.countdown', { seconds: 8, attempt: 3, max: 5 }))
    act(() => vi.advanceTimersByTime(3000))
    expect(detail()).toBe(t('turnRetry.countdown', { seconds: 5, attempt: 3, max: 5 }))
    fireEvent.click(screen.getByRole('button', { name: t('turnRetry.retryNow') }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('limite de débit, puis tentatives épuisées : « Réessayer » seul', () => {
    const { rerender } = render(
      <TurnRetryBanner
        retry={{ cause: 'rate-limit', attempt: 1, max: 5, at: Date.now() + 2000 }}
        onRetry={() => {}}
      />
    )
    expect(screen.getByText(t('turnRetry.rateLimit'))).toBeTruthy()
    rerender(
      <TurnRetryBanner retry={{ cause: 'network', attempt: 5, max: 5 }} onRetry={() => {}} />
    )
    expect(screen.getByText(t('turnRetry.exhausted'))).toBeTruthy()
    expect(screen.getByTestId('turn-retry-detail').textContent).toBe(
      t('turnRetry.exhaustedDetail', { max: 5 })
    )
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([t('turnRetry.retry')])
  })

  it('jamais « dans 0 s »', () => {
    expect(secondsLeft(10_000, 2_001)).toBe(8)
    expect(secondsLeft(10_000, 10_500)).toBe(1)
  })
})
