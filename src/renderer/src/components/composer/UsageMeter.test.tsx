import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ConversationUsage } from '@shared/usage'
import { UsageMeter } from './UsageMeter'

beforeAll(() => {
  // Le positionnement des menus (Radix) suit la taille de leur contenu ; jsdom ne la mesure pas.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')

function meter(usage: ConversationUsage) {
  return (
    <Tooltip.Provider>
      <UsageMeter usage={usage} agentLabel="Agent factice" />
    </Tooltip.Provider>
  )
}

describe('détail de la consommation : le seul endroit où le coût se voit (fiche 113)', () => {
  it('coût cumulé, moyenne par échange et une ligne par échange, le plus récent en haut', () => {
    render(
      meter({
        context: { used: 2550, size: 200_000 },
        cost: { amount: 0.025, currency: 'USD' },
        tokens: {
          input: 2050,
          output: 500,
          cachedRead: 0,
          cachedWrite: 0,
          thought: 0,
          total: 2550,
          turns: 2
        },
        turns: [
          { at: 1, input: 1000, output: 200, total: 1200, costStart: 0, costEnd: 0.01 },
          { at: 2, input: 1050, output: 300, total: 1350, costStart: 0.01, costEnd: 0.025 }
        ]
      })
    )
    fireEvent.click(screen.getByTestId('usage-meter'))
    expect(plain(screen.getByTestId('usage-cost').textContent)).toBe('0,025 $US')
    expect(plain(screen.getByTestId('usage-average').textContent)).toContain(
      '0,0125 $US · 1 275 jetons'
    )
    const turns = screen.getAllByTestId('usage-turn').map((li) => plain(li.textContent))
    expect(turns).toHaveLength(2)
    expect(turns[0]).toContain('0,015 $US')
    expect(turns[0]).toContain('1,1k → 300')
    expect(turns[1]).toContain('0,01 $US')
  })

  it('agent qui ne donne que son coût (comme Bob) : la puce montre le coût, lignes sans jetons', () => {
    render(
      meter({
        cost: { amount: 0.025, currency: 'bobcoins' },
        turns: [
          { at: 1, costStart: 0, costEnd: 0.0125 },
          { at: 2, costStart: 0.0125, costEnd: 0.025 }
        ]
      })
    )
    expect(plain(screen.getByTestId('usage-meter').textContent)).toBe('0,025 Bobcoins')
    fireEvent.click(screen.getByTestId('usage-meter'))
    expect(plain(screen.getByTestId('usage-average').textContent)).toContain('0,0125 Bobcoins')
    const rows = screen.getAllByTestId('usage-turn')
    expect(rows).toHaveLength(2)
    expect(rows.every((li) => li.classList.contains('cost-only'))).toBe(true)
    expect(rows[0]?.querySelector('.cost-turn-tokens')).toBeNull()
  })

  it('après un changement de session : total de la conversation, cette session et l’autre agent à part (fiche 164)', () => {
    render(
      meter({
        cost: { amount: 0.25, currency: 'bobcoins' },
        earlier: { bobcoins: 2, USD: 0.4 }
      })
    )
    expect(plain(screen.getByTestId('usage-meter').textContent)).toBe('2,25 Bobcoins')
    fireEvent.click(screen.getByTestId('usage-meter'))
    expect(plain(screen.getByTestId('usage-cost').textContent)).toBe('2,25 Bobcoins')
    expect(plain(screen.getByTestId('usage-session-cost').textContent)).toContain('0,25 Bobcoins')
    expect(plain(screen.getByTestId('usage-other-cost').textContent)).toContain('0,40 $US')
  })

  it('sans échange rapporté : ni moyenne ni liste', () => {
    render(meter({ context: { used: 10, size: 100 } }))
    fireEvent.click(screen.getByTestId('usage-meter'))
    expect(screen.queryByTestId('usage-average')).toBeNull()
    expect(screen.queryByTestId('usage-turns')).toBeNull()
  })
})
