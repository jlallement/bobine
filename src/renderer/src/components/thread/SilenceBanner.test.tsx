import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import { SilenceBanner, silentMinutes } from './SilenceBanner'

describe('bandeau de silence (fiche 194)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('dit depuis combien de minutes, en statut (jamais une alerte), et suit l’heure', () => {
    const since = Date.now() - 5 * 60_000
    render(<SilenceBanner since={since} onStop={() => {}} />)
    const banner = screen.getByTestId('silence-banner')
    expect(banner.getAttribute('role')).toBe('status')
    expect(banner.textContent).toContain(t('silenceBanner.title', { minutes: 5 }))
    act(() => vi.advanceTimersByTime(60_000))
    expect(banner.textContent).toContain(t('silenceBanner.title', { minutes: 6 }))
    expect(document.activeElement).toBe(document.body)
  })

  it('« Arrêter » arrête la réponse ; « Attendre » masque jusqu’au prochain silence', () => {
    const onStop = vi.fn()
    const { rerender } = render(<SilenceBanner since={1000} onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: t('silenceBanner.stop') }))
    expect(onStop).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: t('silenceBanner.wait') }))
    expect(screen.queryByTestId('silence-banner')).toBeNull()
    rerender(<SilenceBanner since={2000} onStop={onStop} />)
    expect(screen.getByTestId('silence-banner')).toBeTruthy()
  })

  it('au moins une minute', () => {
    expect(silentMinutes(0, 10_000)).toBe(1)
    expect(silentMinutes(0, 12 * 60_000 + 5000)).toBe(12)
  })
})
