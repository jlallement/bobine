import { describe, expect, it } from 'vitest'
import { daysCsv, localIso, turnsCsv } from './csv'
import { localDay } from './report'
import type { TurnRow } from './usage-db'

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime()

const rows: TurnRow[] = [
  {
    id: 'c1:1',
    conversationId: 'c1',
    startedAt: at(23, 10),
    endedAt: at(23, 10) + 12_340,
    profileId: 'opencode',
    profileLabel: 'OpenCode',
    model: { id: 'openai/gpt', name: 'GPT, "Sol"' },
    workspace: '/p/app/.wt/x',
    repoRoot: '/p/app',
    stopReason: 'end_turn',
    tokens: { input: 100, output: 10, total: 110 },
    cost: { amount: 0.0125, currency: 'USD' },
    tools: { read: 2, edit: 1 },
    subagents: 0
  },
  {
    id: 'c2:2',
    conversationId: 'c2',
    parentId: 'c1',
    startedAt: at(23, 11),
    profileId: 'bob',
    profileLabel: '=HYPERLINK("x")',
    tokens: {},
    cost: { amount: 0.5, currency: 'bobcoins' },
    tools: {},
    subagents: 1
  },
  {
    id: 'c1:3',
    conversationId: 'c1',
    startedAt: at(24, 9),
    endedAt: at(24, 9) + 1000,
    profileId: 'opencode',
    tokens: { input: 5, output: 1 },
    cost: { amount: 0.001, currency: 'USD' },
    tools: {},
    subagents: 0
  }
]

const lines = (csv: string) => csv.trimEnd().split('\r\n')

describe('export CSV de la consommation (fiche 137)', () => {
  it('une ligne par tour : guillemets doublés, formules désarmées, valeurs absentes vides', () => {
    const [header, first, second] = lines(turnsCsv(rows))
    expect(header?.split(',').slice(0, 6)).toEqual([
      'id',
      'conversation_id',
      'parent_id',
      'started_at',
      'ended_at',
      'duration_s'
    ])
    expect(first).toBe(
      `c1:1,c1,,${localIso(at(23, 10))},${localIso(at(23, 10) + 12_340)},12.3,opencode,OpenCode,openai/gpt,"GPT, ""Sol""",,/p/app,/p/app/.wt/x,end_turn,100,10,,,,110,0.0125,USD,3,0`
    )
    expect(second).toContain(`,bob,"'=HYPERLINK(""x"")",`)
    expect(second?.endsWith(',0.5,bobcoins,0,1')).toBe(true)
    expect(lines(turnsCsv(rows))).toHaveLength(4)
  })

  it('une ligne par jour, jours vides compris, une colonne par unité jamais additionnées', () => {
    const days = ['2026-10-22', '2026-10-23', '2026-10-24']
    expect(lines(daysCsv(days, rows, localDay))).toEqual([
      'day,turns,conversations,duration_s,input_tokens,output_tokens,cost_USD,cost_bobcoins',
      '2026-10-22,0,0,0,0,0,0,0',
      '2026-10-23,2,2,12.3,100,10,0.0125,0.5',
      '2026-10-24,1,1,1,5,1,0.001,0'
    ])
  })

  it('heure locale avec son décalage', () => {
    expect(localIso(at(24, 9))).toMatch(/^2026-10-24T09:00:00[+-]\d\d:\d\d$/)
  })
})
