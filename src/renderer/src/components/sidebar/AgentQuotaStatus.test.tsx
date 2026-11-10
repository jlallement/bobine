import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentQuota } from '@shared/usage'
import { AgentQuotaStatus } from './AgentQuotaStatus'

const quota = (change: Partial<AgentQuota> = {}): AgentQuota => ({
  profileId: 'bob',
  profileLabel: 'IBM Bob',
  currency: 'bobcoins',
  limit: 1000,
  used: 812.5,
  readAt: new Date(2026, 9, 20, 17, 13).getTime(),
  ...change
})

/** Espaces insécables (séparateur de milliers français) ramenées à des espaces. */
const text = (testId: string) =>
  (screen.getByTestId(testId).textContent ?? '').replace(/[  ]/g, ' ')

describe('quota de l’agent sous son nom (fiche 091)', () => {
  it('état, part consommée et barre orange au-delà de 80 % ; détail au clic', () => {
    const { container } = render(
      <AgentQuotaStatus quota={quota()} status="Prêt" agentLabel="Bob" onRefresh={vi.fn()} />
    )
    expect(text('agent-status')).toBe('Prêt · 81 % du quota')
    expect(container.querySelector('.usage-bar.warn span')?.getAttribute('style')).toContain(
      'width: 81.25%'
    )
    fireEvent.click(screen.getByTestId('agent-quota'))
    expect(text('quota-value')).toBe('812,5 / 1 000 Bobcoins')
    expect(text('quota-left')).toBe('187,5 Bobcoins')
    expect(text('quota-details')).toContain('Selon le serveur de Bob')
    expect(text('quota-details')).toContain('lu à 17:13')
  })

  it('dépassé, puis illimité : pas de pourcentage, plafond « Illimité »', () => {
    const { rerender, container } = render(
      <AgentQuotaStatus
        quota={quota({ used: 1012 })}
        status="Prêt"
        agentLabel="Bob"
        onRefresh={vi.fn()}
      />
    )
    expect(text('agent-status')).toBe('Prêt · 101 % du quota')
    expect(container.querySelector('.usage-bar.full span')?.getAttribute('style')).toContain(
      'width: 100%'
    )
    fireEvent.click(screen.getByTestId('agent-quota'))
    expect(screen.getByTestId('quota-details').textContent).toContain('Dépassé de')
    expect(text('quota-left')).toBe('12 Bobcoins')
    rerender(
      <AgentQuotaStatus
        quota={quota({ limit: null, used: 12.34 })}
        status="Prêt"
        agentLabel="Bob"
        onRefresh={vi.fn()}
      />
    )
    expect(text('agent-status')).toBe('Prêt · 12,34 Bobcoins ce mois-ci')
    expect(container.querySelector('.usage-bar')).toBeNull()
    expect(text('quota-details')).toContain('Illimité')
  })

  it('« Actualiser » relit le quota, « Lecture… » en attendant', async () => {
    let done: () => void = () => {}
    const onRefresh = vi.fn(() => new Promise<void>((resolve) => (done = resolve)))
    render(
      <AgentQuotaStatus quota={quota()} status="Prêt" agentLabel="Bob" onRefresh={onRefresh} />
    )
    fireEvent.click(screen.getByTestId('agent-quota'))
    fireEvent.click(screen.getByTestId('quota-refresh'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('quota-refresh').textContent).toBe('Lecture…')
    expect(screen.getByTestId('quota-refresh').hasAttribute('disabled')).toBe(true)
    await act(async () => done())
    expect(screen.getByTestId('quota-refresh').textContent).toBe('Actualiser')
  })
})
