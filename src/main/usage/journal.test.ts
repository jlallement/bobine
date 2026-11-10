import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { AgentEvent, AgentSnapshot } from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from '../agent/agent-host'
import { bobDbCosts } from '../agent/bob-costs'
import type { AgentProfile } from '../agent/profiles'
import { costBetween, UsageJournal, type TurnContext } from './journal'
import { aggregateTurns } from './report'
import { openUsageDb, type TurnRow, type UsageDb } from './usage-db'

const tempDir = (prefix: string) => mkdtempSync(join(tmpdir(), prefix))

const context: TurnContext = {
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: '/projets/app/.worktrees/fille',
  parentId: 'mere'
}

/** Journal sur une vraie base temporaire, avec des évènements écrits à la main. */
function setup(options: { known?: { amount: number; currency: string }; describe?: boolean } = {}) {
  const db = openUsageDb(join(tempDir('journal-'), 'usage.sqlite'))
  let now = 10_000
  const journal = new UsageJournal({
    db,
    describe: () => (options.describe === false ? undefined : context),
    knownCost: () => options.known,
    repoRoot: (folder) => (folder.startsWith('/projets/app') ? '/projets/app' : undefined),
    now: () => (now += 1000)
  })
  const send = (event: AgentEvent, conversationId = 'c1') =>
    journal.onEvent({ conversationId, event })
  return { db, journal, send, rows: () => db.select() }
}

const user = (at: number, extra: Partial<Extract<AgentEvent, { type: 'user-message' }>> = {}) =>
  ({ type: 'user-message', text: 'Vas-y', at, ...extra }) as AgentEvent
const end = (at: number, usage?: Extract<AgentEvent, { type: 'turn-end' }>['usage']): AgentEvent =>
  ({ type: 'turn-end', stopReason: 'end_turn', at, ...(usage ? { usage } : {}) }) as AgentEvent
const update = (u: SessionUpdate): AgentEvent => ({ type: 'update', update: u })
const usageUpdate = (used: number, amount: number, currency = 'USD') =>
  update({ sessionUpdate: 'usage_update', used, size: 200_000, cost: { amount, currency } })
const tool = (id: string, kind?: string) =>
  update({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: id,
    ...(kind ? { kind } : {})
  } as SessionUpdate)
const status = (s: AgentSnapshot['status']): AgentEvent =>
  ({ type: 'status', snapshot: { status: s } as AgentSnapshot }) as AgentEvent

describe('journal de consommation : un tour, une ligne (fiche 130)', () => {
  it('tour sans jetons ni coût : une ligne quand même (échange et durée)', () => {
    const { send, rows } = setup()
    send(user(1000, { mode: { id: 'code', name: 'Code' } }))
    send(end(4000))
    expect(rows()).toEqual([
      {
        id: 'c1:1000',
        conversationId: 'c1',
        parentId: 'mere',
        startedAt: 1000,
        endedAt: 4000,
        profileId: 'mock',
        profileLabel: 'Agent factice',
        mode: { id: 'code', name: 'Code' },
        workspace: '/projets/app/.worktrees/fille',
        repoRoot: '/projets/app',
        stopReason: 'end_turn',
        tokens: {},
        tools: {},
        subagents: 0
      }
    ])
  })

  it('comme OpenCode : coût par tour d’après le coût cumulé, jetons, contexte, outils par genre', () => {
    const { send, rows } = setup()
    send(user(1000))
    send(tool('t1', 'read'))
    send(tool('t1', 'read'))
    send(tool('t2', 'edit'))
    send(tool('t3'))
    send(usageUpdate(900, 0.01))
    send(end(2000, { inputTokens: 800, outputTokens: 100, totalTokens: 900, cachedReadTokens: 50 }))
    send(user(3000))
    send(usageUpdate(1900, 0.025))
    send(end(4000, { inputTokens: 1700, outputTokens: 200, totalTokens: 1900 }))
    const [first, second] = rows()
    expect(first).toMatchObject({
      tokens: { input: 800, output: 100, cachedRead: 50, total: 900 },
      cost: { amount: 0.01, currency: 'USD' },
      context: { used: 900, size: 200_000 },
      tools: { read: 1, edit: 1, other: 1 }
    })
    expect(second).toMatchObject({ cost: { amount: 0.015, currency: 'USD' }, tools: {} })
  })

  it('comme Bob : coût relu après la fin du tour, sur la même ligne', () => {
    const { send, rows } = setup({ known: { amount: 1, currency: 'bobcoins' } })
    send(user(1000))
    send(end(2000))
    // Coût cumulé pas encore réécrit par Bob : rien de dépensé pour l'instant.
    expect(rows()[0]?.cost).toEqual({ amount: 0, currency: 'bobcoins' })
    send({ type: 'usage-report', cost: { amount: 1.0125, currency: 'bobcoins' } })
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toMatchObject({
      id: 'c1:1000',
      cost: { amount: 0.0125, currency: 'bobcoins' }
    })
  })

  it('remise à zéro (fiche 137) : un coût annoncé après coup ne recrée pas la ligne effacée', () => {
    const { db, journal, send, rows } = setup({ known: { amount: 1, currency: 'bobcoins' } })
    send(user(1000))
    send(end(2000))
    // Un tour en cours au moment de la remise à zéro : écrit à sa fin.
    send(user(3000), 'c2')
    db.clear()
    journal.forgetWritten()
    send({ type: 'usage-report', cost: { amount: 1.0125, currency: 'bobcoins' } })
    expect(rows()).toEqual([])
    send(end(4000), 'c2')
    expect(rows().map((r) => r.id)).toEqual(['c2:3000'])
    send(user(5000))
    send(end(6000))
    expect(rows().map((r) => r.id)).toEqual(['c2:3000', 'c1:5000'])
  })

  it('conversation rouverte : le coût que le fil connaît est le point de départ', () => {
    const { send, rows } = setup({ known: { amount: 0.5, currency: 'USD' } })
    send(user(1000))
    send(usageUpdate(10, 0.52))
    send(end(2000))
    expect(rows()[0]?.cost).toEqual({ amount: 0.02, currency: 'USD' })
  })

  it('changer de modèle en cours de conversation : deux lignes, deux modèles', () => {
    const { send, rows } = setup()
    send(user(1000, { model: { id: 'factice-rapide', name: 'Factice rapide' } }))
    send(end(2000))
    send(user(3000, { model: { id: 'factice-precis', name: 'Factice précis' } }))
    send(end(4000))
    expect(rows().map((r) => r.model?.id)).toEqual(['factice-rapide', 'factice-precis'])
  })

  it('passage à un autre agent : les lignes restent, le coût cumulé repart de zéro', () => {
    const { send, rows } = setup()
    send(user(1000))
    send(usageUpdate(10, 0.3))
    send(end(2000))
    send({
      type: 'handover',
      handover: { from: 'Agent factice', to: 'Autre' }
    } as unknown as AgentEvent)
    send(user(3000))
    send(usageUpdate(10, 0.05))
    send(end(4000))
    expect(rows().map((r) => r.cost)).toEqual([
      { amount: 0.3, currency: 'USD' },
      { amount: 0.05, currency: 'USD' }
    ])
  })

  it('agent arrêté pendant le tour, ou app quittée : tour écrit, interrompu', () => {
    const { send, rows, journal } = setup()
    send(user(1000))
    send(status('busy'))
    send(status('exited'))
    send(user(5000), 'c2')
    journal.close()
    expect(rows().map((r) => [r.id, r.stopReason])).toEqual([
      ['c1:1000', 'interrupted'],
      ['c2:5000', 'interrupted']
    ])
  })

  it('tour en échec : une ligne `error`', () => {
    const { send, rows } = setup()
    send(user(1000))
    send({ type: 'turn-error', message: 'boum' })
    expect(rows()[0]?.stopReason).toBe('error')
  })

  it('sous-agents : nombre et coût, même s’il finit après le tour', () => {
    const { send, rows } = setup()
    send(user(1000))
    send({ type: 'subagent-run', toolCallId: 's1', run: { startedAt: 1100 } })
    send({
      type: 'subagent-run',
      toolCallId: 's2',
      run: { cost: { amount: 0.001, currency: 'bobcoins' } }
    })
    send(end(2000))
    send({
      type: 'subagent-run',
      toolCallId: 's1',
      run: { cost: { amount: 0.002, currency: 'bobcoins' } }
    })
    expect(rows()[0]).toMatchObject({
      subagents: 2,
      subagentCost: { amount: 0.003, currency: 'bobcoins' }
    })
  })

  it('conversation inconnue : aucune ligne', () => {
    const { send, rows } = setup({ describe: false })
    send(user(1000))
    send(end(2000))
    expect(rows()).toEqual([])
  })

  it('coût entre deux unités différentes : aucun coût plutôt qu’un faux', () => {
    expect(costBetween({ amount: 1, currency: 'USD' }, { amount: 2, currency: 'bobcoins' })).toBe(
      undefined
    )
    expect(costBetween(undefined, { amount: 2, currency: 'bobcoins' })).toEqual({
      amount: 2,
      currency: 'bobcoins'
    })
    expect(costBetween({ amount: 3, currency: 'USD' }, { amount: 2, currency: 'USD' })).toBe(
      undefined
    )
  })
})

// ===== Avec l'agent factice =====

function mockProfile(scenario: string, extra: string[] = []): AgentProfile {
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', ...extra],
    env: {}
  }
}

/** Hôte d'agent réel dont les évènements vont au journal, comme dans l'app. */
async function liveJournal(profile: AgentProfile) {
  const db: UsageDb = openUsageDb(join(tempDir('journal-live-'), 'usage.sqlite'))
  const journal = new UsageJournal({
    db,
    describe: () => ({ profileId: profile.id, profileLabel: profile.label })
  })
  const events: AgentEvent[] = []
  const host: AgentHost = new AgentHost({
    profile,
    workspace: process.cwd(),
    emit: (event) => {
      events.push(event)
      journal.onEvent({ conversationId: 'conv', event })
      if (event.type === 'permission-request') {
        const allow = event.options.find((o) => o.kind.startsWith('allow'))
        if (allow) host.respondPermission(event.requestId, allow.optionId)
      }
    }
  })
  await host.start()
  return { db, host, events, rows: (): TurnRow[] => db.select() }
}

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

describe('journal de consommation avec l’agent factice (fiche 130)', () => {
  it('scénario demo, « Factice rapide » puis « Factice précis » : deux lignes, deux modèles', async () => {
    const { host, rows, db } = await liveJournal(mockProfile('demo'))
    await host.prompt('Premier')
    await host.setControl('model', 'factice-precis')
    await host.prompt('Second')
    host.stop()
    const [first, second] = rows()
    expect(first?.model).toEqual({ id: 'factice-rapide', name: 'Factice rapide' })
    expect(second?.model).toEqual({ id: 'factice-precis', name: 'Factice précis' })
    expect(first?.stopReason).toBe('end_turn')
    expect(first?.tools).toMatchObject({ read: 1, edit: 1 })
    expect(first?.tokens.total).toBeGreaterThan(0)
    expect(first?.cost?.currency).toBe('USD')
    const report = aggregateTurns(rows())
    expect(report.byModel.map((g) => g.label).sort()).toEqual(['Factice précis', 'Factice rapide'])
    db.close()
  }, 15_000)

  it('--sans-usage : une ligne par tour, sans jetons ni coût', async () => {
    const { host, rows, db } = await liveJournal(mockProfile('streaming-texte', ['--sans-usage']))
    await host.prompt('Un')
    await host.prompt('Deux')
    host.stop()
    expect(rows()).toHaveLength(2)
    for (const row of rows()) {
      expect(row.tokens).toEqual({})
      expect(row.cost).toBeUndefined()
      expect(row.endedAt).toBeGreaterThanOrEqual(row.startedAt)
    }
    db.close()
  }, 15_000)

  it('--devise bobcoins : le coût garde son unité', async () => {
    const { host, rows, db } = await liveJournal(
      mockProfile('streaming-texte', ['--devise', 'bobcoins'])
    )
    await host.prompt('Un')
    host.stop()
    expect(rows()[0]?.cost?.currency).toBe('bobcoins')
    db.close()
  }, 15_000)

  it('--cout-bob : rien par ACP, coût relu après la fin du tour sur la ligne du même tour', async () => {
    const bobDb = join(tempDir('bob-db-'), 'bob.db')
    const profile = mockProfile('streaming-texte', ['--bob-db', bobDb, '--cout-bob'])
    const { host, rows, events, db } = await liveJournal({
      ...profile,
      costSource: bobDbCosts(bobDb)
    })
    for (const text of ['Un', 'Deux']) {
      await host.prompt(text)
      // Bob écrit son coût après sa réponse : relu 1,5 s après la fin du tour.
      await waitFor(() => events.at(-1)?.type === 'usage-report', 3000)
    }
    host.stop()
    expect(rows().map((r) => r.cost)).toEqual([
      { amount: 0.0125, currency: 'bobcoins' },
      { amount: 0.0125, currency: 'bobcoins' }
    ])
    expect(rows().every((r) => Object.keys(r.tokens).length === 0)).toBe(true)
    db.close()
  }, 15_000)
})
