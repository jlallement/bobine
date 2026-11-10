import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { CostSource } from './adapters'
import { SessionCost } from './session-cost'

const toolEnd = {
  sessionUpdate: 'tool_call_update',
  toolCallId: 't1',
  status: 'completed'
} as SessionUpdate

function setup(amounts: (number | undefined)[], sessionId: string | undefined = 's1') {
  const events: AgentEvent[] = []
  let i = 0
  const source: CostSource = {
    id: 'bob-db',
    currency: 'bobcoins',
    session: () => amounts[Math.min(i++, amounts.length - 1)]
  }
  const cost = new SessionCost(
    source,
    () => sessionId,
    (e) => events.push(e)
  )
  return { cost, events }
}

describe('SessionCost', () => {
  afterEach(() => vi.useRealTimers())

  it('reports a cost only when it changes, never a starting zero', () => {
    const { cost, events } = setup([0, 2, 2, 3])
    for (let n = 0; n < 4; n++) cost.report()
    expect(events).toEqual([
      { type: 'usage-report', cost: { amount: 2, currency: 'bobcoins' } },
      { type: 'usage-report', cost: { amount: 3, currency: 'bobcoins' } }
    ])
  })

  it('reports the same cost again after a reset (new launch)', () => {
    const { cost, events } = setup([2])
    cost.report()
    cost.reset()
    cost.report()
    expect(events).toHaveLength(2)
  })

  it('reads nothing without a session or a source', () => {
    expect(setup([5], undefined).events).toEqual([])
    const events: AgentEvent[] = []
    new SessionCost(
      undefined,
      () => 's1',
      (e) => events.push(e)
    ).report()
    expect(events).toEqual([])
  })

  it('reads again shortly after the turn ends', () => {
    vi.useFakeTimers()
    const { cost, events } = setup([1, 4])
    cost.turnEnded()
    expect(events).toHaveLength(1)
    vi.advanceTimersByTime(1500)
    expect(events.at(-1)).toEqual({
      type: 'usage-report',
      cost: { amount: 4, currency: 'bobcoins' }
    })
  })

  it('reads at the end of a tool, at most every 2 s', () => {
    vi.useFakeTimers()
    const { cost, events } = setup([1, 2, 3])
    cost.noteUpdate(toolEnd)
    cost.noteUpdate(toolEnd)
    cost.noteUpdate({ ...toolEnd, status: 'in_progress' } as SessionUpdate)
    expect(events).toHaveLength(1)
    vi.advanceTimersByTime(2000)
    cost.noteUpdate(toolEnd)
    expect(events).toHaveLength(2)
  })

  it('gives subagent costs only when the source reads them', () => {
    expect(setup([1]).cost.subagentOptions()).toEqual({})
    const source: CostSource = {
      id: 'bob-db',
      currency: 'bobcoins',
      session: () => undefined,
      subagents: (id) => [{ id: `${id}-a`, title: 'a', createdAt: 0 }]
    }
    const options = new SessionCost(
      source,
      () => 's1',
      () => {}
    ).subagentOptions()
    expect(options.costs?.currency).toBe('bobcoins')
    expect(options.costs?.read()).toEqual([{ id: 's1-a', title: 'a', createdAt: 0 }])
  })
})
