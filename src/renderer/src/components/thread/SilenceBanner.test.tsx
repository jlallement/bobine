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

  it('proxy défini (fiche 275) : cité masqué, « Réglages réseau » ; sans proxy, rien de plus', () => {
    const asked = vi.fn()
    window.addEventListener('bobine:open-settings', asked)
    const { rerender } = render(
      <SilenceBanner since={1000} proxy="http://•••@proxy:3128" onStop={() => {}} />
    )
    expect(screen.getByTestId('silence-proxy').textContent).toBe(
      t('silenceBanner.proxy', { proxy: 'http://•••@proxy:3128' })
    )
    expect(screen.getByTestId('silence-proxy').querySelector('code')?.textContent).toBe(
      'http://•••@proxy:3128'
    )
    fireEvent.click(screen.getByRole('button', { name: t('silenceBanner.settings') }))
    expect((asked.mock.calls[0]?.[0] as CustomEvent).detail).toBe('agents')
    window.removeEventListener('bobine:open-settings', asked)
    rerender(<SilenceBanner since={1000} onStop={() => {}} />)
    expect(screen.queryByTestId('silence-proxy')).toBeNull()
    expect(screen.queryByTestId('silence-settings')).toBeNull()
  })

  it('au moins une minute', () => {
    expect(silentMinutes(0, 10_000)).toBe(1)
    expect(silentMinutes(0, 12 * 60_000 + 5000)).toBe(12)
  })

  it('réglages réseau changés (fiche 276) : la piste le dit, « Relancer l’agent » à la place de « Réglages réseau »', () => {
    const onRestart = vi.fn()
    render(
      <SilenceBanner
        since={1000}
        proxy="http://•••@proxy:3128"
        networkStale
        onStop={() => {}}
        onRestart={onRestart}
      />
    )
    expect(screen.getByTestId('silence-network-stale').textContent).toBe(
      t('silenceBanner.networkStale')
    )
    expect(screen.queryByTestId('silence-proxy')).toBeNull()
    expect(screen.queryByTestId('silence-settings')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('silenceBanner.restart') }))
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: t('silenceBanner.wait') })).toBeTruthy()
  })

  it('l’adresse du proxy d’une seule pièce avec ses parenthèses, entière en infobulle (fiche 276)', () => {
    render(<SilenceBanner since={1000} proxy="http://•••@proxy:3128" onStop={() => {}} />)
    const addr = screen.getByTestId('silence-proxy').querySelector('.network-addr')
    expect(addr?.textContent).toMatch(/^\(http:\/\/•••@proxy:3128\)/)
    expect(addr?.querySelector('code')?.getAttribute('title')).toBe('http://•••@proxy:3128')
  })
})
