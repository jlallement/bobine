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

/** Relevés de coût seuls (la relecture, `cost-reading`, est vérifiée à part). */
const reports = (events: AgentEvent[]) => events.filter((e) => e.type === 'usage-report')
const readings = (events: AgentEvent[]) => events.filter((e) => e.type === 'cost-reading')

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
    expect(reports(events)).toHaveLength(1)
    vi.advanceTimersByTime(1500)
    expect(reports(events).at(-1)).toEqual({
      type: 'usage-report',
      cost: { amount: 4, currency: 'bobcoins' }
    })
  })

  it('reads once more at 5 s when the cost written after the turn is late (fiche 157)', () => {
    vi.useFakeTimers()
    const { cost, events } = setup([1, 1, 4, 9])
    cost.turnEnded()
    vi.advanceTimersByTime(1500)
    expect(reports(events)).toHaveLength(1)
    vi.advanceTimersByTime(3500)
    expect(reports(events).at(-1)).toEqual({
      type: 'usage-report',
      cost: { amount: 4, currency: 'bobcoins' }
    })
    // Trouvé : plus de relecture pour ce tour.
    vi.advanceTimersByTime(60_000)
    expect(reports(events)).toHaveLength(2)
  })

  it('no extra read once the cost has changed at 1.5 s', () => {
    vi.useFakeTimers()
    const { cost, events } = setup([1, 4, 9])
    cost.turnEnded()
    vi.advanceTimersByTime(60_000)
    expect(reports(events).map((e) => (e.type === 'usage-report' ? e.cost.amount : 0))).toEqual([
      1, 4
    ])
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

  it('a cost written after the last timed read is read as soon as the source changes', () => {
    // CI Windows du 2026-11-18 : écriture de Bob (agent factice) après la relecture de 5 s.
    vi.useFakeTimers()
    const events: AgentEvent[] = []
    const written: { amount?: number } = {}
    let changed: (() => void) | undefined
    const stopped = vi.fn()
    const source: CostSource = {
      id: 'bob-db',
      currency: 'bobcoins',
      session: () => written.amount,
      watch: (onChange) => {
        changed = onChange
        return stopped
      }
    }
    const cost = new SessionCost(
      source,
      () => 's1',
      (e) => events.push(e)
    )
    cost.turnEnded()
    vi.advanceTimersByTime(6000)
    expect(reports(events)).toEqual([])
    written.amount = 0.0125
    changed?.()
    changed?.()
    vi.advanceTimersByTime(100)
    expect(reports(events)).toEqual([
      { type: 'usage-report', cost: { amount: 0.0125, currency: 'bobcoins' } }
    ])
    // Coût lu : la source n'est plus guettée.
    expect(stopped).toHaveBeenCalledTimes(1)
  })

  it('stops watching the source after a minute, or when the agent stops', () => {
    vi.useFakeTimers()
    const stopped = vi.fn()
    const source: CostSource = {
      id: 'bob-db',
      currency: 'bobcoins',
      session: () => undefined,
      watch: () => stopped
    }
    const cost = new SessionCost(
      source,
      () => 's1',
      () => {}
    )
    cost.turnEnded()
    vi.advanceTimersByTime(60_000)
    expect(stopped).toHaveBeenCalledTimes(1)
    cost.turnEnded()
    cost.stopWatching()
    expect(stopped).toHaveBeenCalledTimes(2)
  })

  describe('relecture d’après un tour (`cost-reading`, fiche 285)', () => {
    it('tour fini avant l’écriture tardive du précédent : le coût du sien est lu aussi', () => {
      // Étape partie à la borne (CI chargée, fix17) : l'écriture du tour d'avant tombe pendant la
      // relecture du nouveau tour ; elle n'est pas son changement, celui du tour suit.
      vi.useFakeTimers()
      const written: { amount?: number } = {}
      const source: CostSource = {
        id: 'bob-db',
        currency: 'bobcoins',
        session: () => written.amount
      }
      const events: AgentEvent[] = []
      const cost = new SessionCost(
        source,
        () => 's1',
        (e) => events.push(e)
      )
      cost.turnEnded()
      vi.advanceTimersByTime(1000)
      cost.turnEnded()
      // Écriture du tour d'avant, lue à 1,5 s du nouveau tour ; puis celle du nouveau tour.
      written.amount = 0.0125
      vi.advanceTimersByTime(1500)
      written.amount = 0.025
      vi.advanceTimersByTime(4000)
      expect(reports(events).map((e) => e.type === 'usage-report' && e.cost.amount)).toEqual([
        0.0125, 0.025
      ])
    })

    it('finie dès qu’un coût est relevé (ici, tout de suite)', () => {
      vi.useFakeTimers()
      const { cost, events } = setup([1, 4])
      cost.turnEnded()
      // Coût lu tout de suite (1) : celui du tour d'avant est connu, relecture finie.
      expect(readings(events)).toEqual([
        { type: 'cost-reading', active: true },
        { type: 'cost-reading', active: false }
      ])
      vi.advanceTimersByTime(60_000)
      expect(readings(events)).toHaveLength(2)
    })

    it('sans changement : finie après la dernière relecture à heure fixe (5 s), coût connu', () => {
      vi.useFakeTimers()
      const { cost, events } = setup([1])
      cost.report()
      cost.turnEnded()
      expect(readings(events)).toEqual([{ type: 'cost-reading', active: true }])
      vi.advanceTimersByTime(4999)
      expect(readings(events)).toHaveLength(1)
      vi.advanceTimersByTime(1)
      expect(readings(events).at(-1)).toEqual({ type: 'cost-reading', active: false })
    })

    it('source illisible : finie à 5 s, coût inconnu', () => {
      vi.useFakeTimers()
      const { cost, events } = setup([undefined])
      cost.turnEnded()
      vi.advanceTimersByTime(5000)
      expect(readings(events)).toEqual([
        { type: 'cost-reading', active: true },
        { type: 'cost-reading', active: false, unknown: true }
      ])
    })

    it('un tour plus récent : la fin de la relecture d’avant ne compte pas pour lui', () => {
      vi.useFakeTimers()
      const { cost, events } = setup([1])
      cost.report()
      cost.turnEnded()
      vi.advanceTimersByTime(3000)
      cost.turnEnded()
      // 5 s après le premier tour : sa relecture se tait, celle du second continue.
      vi.advanceTimersByTime(2000)
      expect(readings(events).filter((e) => !e.active)).toHaveLength(0)
      vi.advanceTimersByTime(3000)
      expect(readings(events).filter((e) => !e.active)).toHaveLength(1)
    })

    it('rien sans source de coût', () => {
      const events: AgentEvent[] = []
      new SessionCost(
        undefined,
        () => 's1',
        (e) => events.push(e)
      ).turnEnded()
      expect(events).toEqual([])
    })
  })
})
