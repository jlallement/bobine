import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { Transcript } from './Transcript'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>
const subagent = (id: number, extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id,
  toolCallId: `s${id}`,
  title: `Running subagent: tâche ${id}`,
  toolKind: 'other',
  status: 'completed',
  content: [],
  locations: [],
  subagent: { type: 'explore', task: `Tâche ${id}` },
  ...extra
})

const view = (items: TranscriptItem[], onRespond = vi.fn()) =>
  render(
    <Transcript items={items} onRespondPermission={onRespond} onRespondElicitation={vi.fn()} />
  )

describe('Carte « Sous-agents » (fiche 117)', () => {
  it('sous-agents consécutifs : une carte, une ligne chacun, comptes et coût total', () => {
    view([
      { kind: 'user', id: 1, text: 'Explore' },
      subagent(2, {
        status: 'in_progress',
        subagentRun: {
          startedAt: Date.now() - 12_000,
          cost: { amount: 0.0021, currency: 'bobcoins' }
        }
      }),
      subagent(3, {
        content: [
          {
            type: 'content',
            content: { type: 'text', text: '<task_result>\nTrois **fichiers**.\n</task_result>' }
          }
        ],
        subagentRun: {
          startedAt: 1000,
          endedAt: 9000,
          cost: { amount: 0.002, currency: 'bobcoins' }
        }
      })
    ])
    const card = screen.getByTestId('subagents')
    expect(screen.getAllByTestId('subagents')).toHaveLength(1)
    expect(card.textContent).toContain('Sous-agents')
    expect(screen.getByTestId('subagents-counts').textContent).toBe('· 1 en cours, 1 fini')
    expect(screen.getByTestId('subagents-cost').textContent).toBe('0,0041 Bobcoins')
    const rows = within(card).getAllByTestId('subagent')
    expect(rows.map((r) => r.dataset.status)).toEqual(['in_progress', 'completed'])
    expect(rows[0]?.textContent).toMatch(/explore\s*Tâche 2/)
    expect(within(rows[0] as HTMLElement).getByTestId('subagent-meta').textContent).toMatch(
      /^1[23] s0,0021 Bobcoins$/
    )
    expect(within(rows[1] as HTMLElement).getByTestId('subagent-meta').textContent).toBe(
      '8 s0,002 Bobcoins'
    )
    // « Réponse » déplie la consigne et la réponse mise en forme, sans les balises.
    const second = rows[1] as HTMLDetailsElement
    fireEvent.click(within(second).getByTestId('subagent-toggle'))
    expect(second.open).toBe(true)
    const answer = within(second).getByTestId('subagent-answer')
    expect(answer.innerHTML).toContain('<strong>fichiers</strong>')
    expect(answer.innerHTML).not.toContain('task_result')
  })

  it('un sous-agent seul a la même carte ; un texte ou un outil sépare deux cartes', () => {
    view([
      subagent(1),
      { kind: 'agent', id: 2, text: 'Puis…' },
      subagent(3),
      { ...subagent(4), subagent: undefined, title: 'Outil', toolKind: 'read' } as ToolItem,
      subagent(5)
    ])
    const cards = screen.getAllByTestId('subagents')
    expect(cards).toHaveLength(3)
    expect(cards[0]?.textContent).toContain('Sous-agent')
    expect(cards[0]?.textContent).not.toContain('Sous-agents')
    expect(cards.map((c) => c.dataset.count)).toEqual(['1', '1', '1'])
  })

  it('autorisation en attente : sous la carte, avec la consigne ; coûts d’unités différentes : pas de total', () => {
    const onRespond = vi.fn()
    view(
      [
        subagent(1, {
          status: 'pending',
          permission: {
            requestId: 'r1',
            options: [{ optionId: 'allow', name: 'Allow once', kind: 'allow_once' }],
            state: 'pending'
          }
        }),
        subagent(2, { subagentRun: { cost: { amount: 1, currency: 'USD' } } }),
        subagent(3, { subagentRun: { cost: { amount: 1, currency: 'bobcoins' } } })
      ],
      onRespond
    )
    expect(screen.getByTestId('subagents-counts').textContent).toBe('· 1 attend un accord, 2 finis')
    expect(screen.queryByTestId('subagents-cost')).toBeNull()
    const waiting = screen.getAllByTestId('subagent')[0] as HTMLElement
    expect(waiting.dataset.status).toBe('waiting')
    expect(within(waiting).queryByTestId('subagent-toggle')).toBeNull()
    const permission = screen.getByTestId('permission')
    expect(permission.textContent).toContain('Lancer ce sous-agent\u00a0?')
    expect(permission.textContent).toContain('Tâche 1')
    expect(screen.getByTestId('subagents').contains(permission)).toBe(false)
    fireEvent.click(within(permission).getByText('Autoriser une fois'))
    expect(onRespond).toHaveBeenCalledWith('r1', 'allow')
  })
})
