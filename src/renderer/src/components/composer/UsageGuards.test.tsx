import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import type { ConversationUsage } from '@shared/usage'
import type { UsageActions } from '../../useTurnGuards'
import { CompactButton, CostCapRow } from './UsageGuards'

const prefs = { costCapEnabled: true, costCapAmount: 5, costCapTokens: 2_000_000 }
const usd: ConversationUsage = { cost: { amount: 1.5, currency: 'USD' } }

describe('puce de consommation, pendant le tour (fiche 157)', () => {
  it('« Compacter » à 80 % quand l’agent a une commande de compaction', () => {
    const onCompact = vi.fn()
    const { rerender } = render(
      <Tooltip.Provider>
        <CompactButton actions={{ onCompact, compactCommand: '/compact' }} level="warn" />
      </Tooltip.Provider>
    )
    fireEvent.click(screen.getByTestId('usage-compact'))
    expect(onCompact).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('usage-compact').className).toContain('warn')
    // Sous 80 %, ou sans commande (agent occupé, profil sans compaction) : rien.
    rerender(
      <Tooltip.Provider>
        <CompactButton actions={{ onCompact }} level={undefined} />
      </Tooltip.Provider>
    )
    expect(screen.queryByTestId('usage-compact')).toBeNull()
    rerender(
      <Tooltip.Provider>
        <CompactButton actions={{}} level="full" />
      </Tooltip.Provider>
    )
    expect(screen.queryByTestId('usage-compact')).toBeNull()
  })

  it('plafond de la conversation : celui des réglages, une valeur propre, « Aucun »', () => {
    const onSetCostCap = vi.fn()
    const actions: UsageActions = { preferences: prefs, onSetCostCap, costCap: 'settings' }
    const { rerender } = render(<CostCapRow usage={usd} actions={actions} />)
    expect(screen.getByTestId('usage-cap-value').textContent).toContain('5')
    expect(screen.getByTestId('usage-cap-default').getAttribute('aria-pressed')).toBe('true')
    const input = screen.getByTestId('usage-cap-input')
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSetCostCap).toHaveBeenCalledWith({ limit: 8, unit: 'USD' })
    fireEvent.click(screen.getByTestId('usage-cap-none'))
    expect(onSetCostCap).toHaveBeenCalledWith('none')
    // Conversation créée sans plafond : « Aucun » ; « Par défaut » lui donne celui des réglages.
    rerender(<CostCapRow usage={usd} actions={{ preferences: prefs, onSetCostCap }} />)
    expect(screen.getByTestId('usage-cap-value').textContent).toBe(t('turnGuards.cap.none'))
    expect(screen.getByTestId('usage-cap-none').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('usage-cap-default'))
    expect(onSetCostCap).toHaveBeenCalledWith('settings')
  })

  it('sans coût connu : en jetons ; rien tant que l’agent n’a rien donné', () => {
    const actions: UsageActions = {
      preferences: prefs,
      onSetCostCap: vi.fn(),
      costCap: 'settings'
    }
    const tokens: ConversationUsage = {
      tokens: { input: 1, output: 1, cachedRead: 0, cachedWrite: 0, thought: 0, total: 2, turns: 1 }
    }
    const { rerender } = render(<CostCapRow usage={tokens} actions={actions} />)
    expect(screen.getByTestId('usage-cap').textContent).toContain(t('turnGuards.cap.tokensUnit'))
    rerender(<CostCapRow usage={{}} actions={actions} />)
    expect(screen.queryByTestId('usage-cap')).toBeNull()
  })
})

describe('plafond et coût inconnu (fiche 266, D12)', () => {
  const actions = (): UsageActions => ({
    preferences: prefs,
    onSetCostCap: vi.fn(),
    costCap: 'settings'
  })
  const turn = (id: string, name: string) => ({ model: { id, name }, costStart: 0, costEnd: 0 })

  it('coût nul d’un modèle payant : le plafond dit qu’il ne peut pas se déclencher', () => {
    const paid: ConversationUsage = {
      cost: { amount: 0, currency: 'USD' },
      turns: [turn('openai/gpt-6.1-sol', 'GPT-6.1 Sol')]
    }
    render(<CostCapRow usage={paid} actions={actions()} />)
    expect(screen.getByTestId('usage-cap-not-reported').textContent).toBe(
      t('turnGuards.cap.notReported')
    )
  })

  it('modèle gratuit, coût payé ou bobcoins : rien à dire', () => {
    const free: ConversationUsage = {
      cost: { amount: 0, currency: 'USD' },
      turns: [turn('opencode/tidepool-alpha-free', 'Tidepool Alpha Free')]
    }
    for (const usage of [free, usd, { cost: { amount: 0, currency: 'bobcoins' } }]) {
      const { unmount } = render(<CostCapRow usage={usage} actions={actions()} />)
      expect(screen.queryByTestId('usage-cap-not-reported')).toBeNull()
      unmount()
    }
  })
})
