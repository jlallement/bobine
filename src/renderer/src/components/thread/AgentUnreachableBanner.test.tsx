import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import { AgentUnreachableBanner } from './AgentUnreachableBanner'

describe('agent qui ne joint pas son modèle (fiche 275)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000_000)
  })
  afterEach(() => vi.useRealTimers())

  const message =
    "Can't reach opencode.ai. Check the network connection. (getaddrinfo ENOTFOUND proxy)"

  it('tentative et décompte, piste du proxy, message de l’agent replié et tel quel', () => {
    render(
      <AgentUnreachableBanner
        unreachable={{ attempt: 9, at: Date.now() + 24_000, message }}
        agent="OpenCode"
        proxy="http://•••@proxy:3128"
        onStop={() => {}}
      />
    )
    const banner = screen.getByTestId('agent-unreachable')
    expect(banner.getAttribute('role')).toBe('status')
    expect(banner.textContent).toContain(t('agentRetry.title', { agent: 'OpenCode' }))
    expect(screen.getByTestId('agent-unreachable-detail').textContent).toBe(
      t('agentRetry.detail', { attempt: 9, seconds: 24 })
    )
    act(() => vi.advanceTimersByTime(4000))
    expect(screen.getByTestId('agent-unreachable-detail').textContent).toBe(
      t('agentRetry.detail', { attempt: 9, seconds: 20 })
    )
    expect(screen.getByTestId('agent-unreachable-hint').textContent).toBe(
      t('agentRetry.proxy', { proxy: 'http://•••@proxy:3128' })
    )
    expect(screen.getByTestId('agent-unreachable-message').textContent).toBe(message)
    expect(banner.querySelector('details')?.open).toBe(false)
    // Heure passée : la tentative est en cours, plus de décompte.
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByTestId('agent-unreachable-detail').textContent).toBe(
      t('agentRetry.detailNow', { attempt: 9 })
    )
  })

  it('sans proxy : piste Wi-Fi, VPN ; sans message : rien de replié ; Arrêter et Réglages', () => {
    const onStop = vi.fn()
    const asked = vi.fn()
    window.addEventListener('bobine:open-settings', asked)
    render(<AgentUnreachableBanner unreachable={{ attempt: 2 }} agent="X" onStop={onStop} />)
    expect(screen.getByTestId('agent-unreachable-hint').textContent).toBe(t('agentRetry.noProxy'))
    expect(screen.queryByTestId('agent-unreachable-message')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('agentRetry.stop') }))
    expect(onStop).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: t('agentRetry.settings') }))
    expect((asked.mock.calls[0]?.[0] as CustomEvent).detail).toBe('agents')
    window.removeEventListener('bobine:open-settings', asked)
  })
})
