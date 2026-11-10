import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from './transcript'
import {
  groupTools,
  subagentsState,
  toolGroupState,
  toolGroupSummary,
  type ToolItem
} from './tool-groups'

let next = 1
const tool = (extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id: next++,
  toolCallId: `t${next}`,
  title: 'Outil',
  toolKind: 'read',
  status: 'completed',
  content: [],
  locations: [],
  ...extra
})
const text = (): TranscriptItem => ({ kind: 'agent', id: next++, text: 'Texte' })
const shape = (items: TranscriptItem[], standalone?: (item: TranscriptItem) => boolean) =>
  groupTools(items, standalone).map((e) =>
    e.kind === 'tools'
      ? e.items.length
      : e.kind === 'subagents'
        ? `sub${e.items.length}`
        : e.item.kind
  )

describe('groupTools (fiche 047)', () => {
  it('au moins deux outils consécutifs forment un groupe ; un texte coupe la suite', () => {
    expect(shape([text(), tool(), tool(), tool(), text(), tool(), text()])).toEqual([
      'agent',
      3,
      'agent',
      'tool',
      'agent'
    ])
    const [group] = groupTools([tool(), tool()])
    expect(group?.kind === 'tools' && group.key).toBe(group?.kind === 'tools' && group.items[0]?.id)
  })

  it('autorisation en attente, plan à valider, sous-agent, carte de plan : hors des groupes', () => {
    const pending = tool({
      permission: { requestId: 'r', options: [], state: 'pending' }
    })
    const plan = tool({
      toolKind: 'switch_mode',
      permission: { requestId: 'r2', options: [], state: 'cancelled' }
    })
    const subagent = tool({ subagent: { task: 'Chercher' } })
    expect(shape([tool(), tool(), pending, tool()])).toEqual([2, 'tool', 'tool'])
    expect(shape([tool(), plan, tool()])).toEqual(['tool', 'tool', 'tool'])
    expect(shape([tool(), subagent, tool(), tool()])).toEqual(['tool', 'sub1', 2])
    const anchor = tool()
    expect(shape([tool(), anchor, tool()], (i) => i === anchor)).toEqual(['tool', 'tool', 'tool'])
    // Une autorisation déjà donnée n'empêche pas le regroupement.
    const allowed = tool({
      permission: {
        requestId: 'r3',
        options: [],
        state: { optionId: 'a', kind: 'allow_once', name: 'Autoriser' }
      }
    })
    expect(shape([tool(), allowed])).toEqual([2])
  })

  it('sous-agents consécutifs : une carte, même seul ou en attente d’autorisation (fiche 117)', () => {
    const sub = (extra: Partial<ToolItem> = {}) =>
      tool({ subagent: { task: 'Chercher' }, ...extra })
    const waiting = sub({ permission: { requestId: 'r', options: [], state: 'pending' } })
    expect(shape([text(), sub(), waiting, tool(), tool(), sub(), text(), sub()])).toEqual([
      'agent',
      'sub2',
      2,
      'sub1',
      'agent',
      'sub1'
    ])
    const first = sub()
    const [card] = groupTools([first, sub()])
    expect(card?.kind === 'subagents' && card.key).toBe(first.id)
  })

  it('état d’une carte « Sous-agents » : comptes par état, coût total de même unité', () => {
    const sub = (extra: Partial<ToolItem> = {}) =>
      tool({ subagent: { task: 'Chercher' }, ...extra })
    const cost = (amount: number, currency = 'bobcoins') => ({
      subagentRun: { cost: { amount, currency } }
    })
    expect(
      subagentsState([
        sub({ status: 'in_progress', ...cost(0.0021) }),
        sub({ ...cost(0.0058) }),
        sub({ status: 'failed' }),
        sub({ status: 'pending', permission: { requestId: 'r', options: [], state: 'pending' } })
      ])
    ).toEqual({
      running: 1,
      waiting: 1,
      done: 1,
      failed: 1,
      refused: 0,
      cancelled: 0,
      cost: { amount: 0.0079, currency: 'bobcoins' }
    })
    expect(subagentsState([sub(cost(1)), sub(cost(1, 'USD'))]).cost).toBeUndefined()
    expect(subagentsState([sub()]).cost).toBeUndefined()
  })

  it('résumé par genre d’outil et par panneau de l’app ; état du groupe', () => {
    expect(toolGroupSummary([tool(), tool(), tool({ toolKind: 'search' })])).toBe(
      '2 lectures et 1 recherche'
    )
    expect(
      toolGroupSummary([
        tool({ toolKind: 'other', appTool: { label: 'Saisit « Ada »', group: 'browser' } }),
        tool({ toolKind: 'other', appTool: { label: 'Capture la page', group: 'browser' } }),
        tool({ toolKind: 'execute' }),
        tool({ toolKind: 'fetch' }),
        tool({ toolKind: 'fetch' })
      ])
    ).toBe('2 actions dans le navigateur, 1 commande et 2 accès réseau')
    const running = tool({ status: 'in_progress' })
    expect(toolGroupState([tool(), running, tool({ status: 'failed' })])).toEqual({
      running,
      failed: 1,
      refused: 0,
      cancelled: 0
    })
    expect(toolGroupState([tool({ status: 'cancelled' }), tool()])).toEqual({
      failed: 0,
      refused: 0,
      cancelled: 1
    })
  })
})
