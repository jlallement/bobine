import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateTurns, localDay, usageReport } from './report'
import { openUsageDb, type TurnRow } from './usage-db'

const DAY = 86_400_000
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const row = (id: string, over: Partial<TurnRow> = {}): TurnRow => ({
  id,
  conversationId: id.split(':')[0] ?? id,
  startedAt: 0,
  endedAt: 1000,
  profileId: 'opencode',
  profileLabel: 'OpenCode',
  tokens: {},
  tools: {},
  subagents: 0,
  ...over
})

const rows: TurnRow[] = [
  row('a:1', {
    startedAt: 10 * DAY,
    endedAt: 10 * DAY + 4000,
    model: { id: 'gpt', name: 'GPT' },
    workspace: '/p/app',
    repoRoot: '/p/app',
    tokens: { input: 100, output: 10, total: 110 },
    cost: { amount: 0.01, currency: 'USD' }
  }),
  row('b:2', {
    startedAt: 10 * DAY + 5000,
    endedAt: 10 * DAY + 6000,
    model: { id: 'gpt', name: 'GPT' },
    workspace: '/p/app/.worktrees/x',
    repoRoot: '/p/app',
    tokens: { input: 50, output: 5, total: 55, cachedRead: 20, thought: 3 },
    cost: { amount: 0.02, currency: 'USD' }
  }),
  row('c:3', {
    startedAt: 11 * DAY,
    endedAt: undefined,
    profileId: 'bob',
    profileLabel: 'IBM Bob',
    workspace: '/p/autre',
    cost: { amount: 0.5, currency: 'bobcoins' }
  })
]

describe('lecture du journal de consommation (fiche 130)', () => {
  it('totaux : échanges, durée des tours finis, jetons, coût par unité sans les mélanger', () => {
    const { totals } = aggregateTurns(rows, utcDay)
    expect(totals).toEqual({
      turns: 3,
      durationMs: 5000,
      input: 150,
      output: 15,
      cachedRead: 20,
      cachedWrite: 0,
      thought: 3,
      total: 165,
      costs: { USD: 0.03, bobcoins: 0.5 },
      turnsWithoutTokens: 1
    })
  })

  it('par jour, par modèle (le profil sans modèle), par projet (worktrees sur leur dépôt), par agent', () => {
    const report = aggregateTurns(rows, utcDay)
    expect(report.byDay.map((g) => [g.key, g.turns])).toEqual([
      ['1970-01-11', 2],
      ['1970-01-12', 1]
    ])
    expect(report.byModel.map((g) => [g.key, g.label, g.turns])).toEqual([
      ['opencode:gpt', 'GPT', 2],
      ['bob', 'IBM Bob', 1]
    ])
    expect(report.byProject.map((g) => [g.key, g.turns, g.costs])).toEqual([
      ['/p/app', 2, { USD: 0.03 }],
      ['/p/autre', 1, { bobcoins: 0.5 }]
    ])
    expect(report.byAgent.map((g) => [g.key, g.label])).toEqual([
      ['opencode', 'OpenCode'],
      ['bob', 'IBM Bob']
    ])
  })

  it('jour local par défaut', () => {
    const noon = new Date(2026, 9, 23, 12).getTime()
    expect(localDay(noon)).toBe('2026-10-23')
  })

  it('requête : période, agent, modèle, puis regroupement', () => {
    const db = openUsageDb(join(mkdtempSync(join(tmpdir(), 'report-')), 'usage.sqlite'))
    for (const r of rows) db.upsert(r)
    const day10 = usageReport(db, { from: 10 * DAY, to: 11 * DAY }, utcDay)
    expect(day10.totals.turns).toBe(2)
    expect(usageReport(db, { profileId: 'bob' }, utcDay).totals.costs).toEqual({ bobcoins: 0.5 })
    expect(usageReport(db, { modelId: 'gpt' }, utcDay).totals.turns).toBe(2)
    expect(usageReport(db, { from: 20 * DAY }, utcDay).byDay).toEqual([])
    db.close()
  })
})
