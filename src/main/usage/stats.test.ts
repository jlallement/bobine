import { describe, expect, it } from 'vitest'
import { OTHER_SERIES } from '@shared/usage-stats'
import type { UsageScope } from '@shared/usage-periods'
import {
  bucketKeys,
  compareRows,
  comparisonPlan,
  heatmapOf,
  pastYears,
  queryRange,
  seriesOf,
  TOP_CONVERSATIONS,
  usageStats
} from './stats'
import type { JournalSeries, TurnRow } from './usage-db'

/** Heure locale (le découpage par jour se fait à l'heure de l'utilisateur). */
const at = (day: number, hour = 10, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const NOW = new Date(2026, 9, 24, 15)

const row = (id: string, over: Partial<TurnRow> = {}): TurnRow => ({
  id,
  conversationId: id.split(':')[0] ?? id,
  startedAt: at(24),
  endedAt: at(24) + 60_000,
  profileId: 'opencode',
  profileLabel: 'OpenCode',
  tokens: {},
  tools: {},
  subagents: 0,
  ...over
})

/**
 * Journal d'essai fixe : Bob (bobcoins, sans jetons ni modèle), OpenCode avec deux modèles
 * (dollars, puis sans coût), un agent sans couleur déclarée, un worktree, une conversation
 * supprimée, un tour juste avant minuit et un tour pas fini.
 */
const ROWS: TurnRow[] = [
  row('bob1:1', {
    profileId: 'bob',
    profileLabel: 'IBM Bob',
    startedAt: at(21, 9),
    endedAt: at(21, 9, 2),
    workspace: '/p/carnet',
    repoRoot: '/p/carnet',
    cost: { amount: 0.5, currency: 'bobcoins' }
  }),
  row('bob1:2', {
    profileId: 'bob',
    profileLabel: 'IBM Bob',
    startedAt: at(21, 23, 59),
    endedAt: at(22, 0, 1),
    workspace: '/p/carnet/.worktrees/a',
    repoRoot: '/p/carnet',
    cost: { amount: 0.25, currency: 'bobcoins' }
  }),
  row('oc1:1', {
    startedAt: at(22, 14),
    endedAt: at(22, 14, 1),
    model: { id: 'gpt', name: 'GPT-6.1 Sol' },
    workspace: '/p/bobine',
    repoRoot: '/p/bobine',
    tokens: { input: 1000, output: 100, total: 1100, cachedRead: 500 },
    cost: { amount: 0.02, currency: 'USD' }
  }),
  row('oc1:2', {
    startedAt: at(24, 8),
    endedAt: undefined,
    model: { id: 'mistral', name: 'Mistral interne' },
    workspace: '/p/bobine',
    repoRoot: '/p/bobine',
    tokens: { input: 400, output: 40 }
  }),
  row('gone:1', {
    profileId: 'gemini',
    profileLabel: 'Gemini',
    startedAt: at(24, 9),
    endedAt: at(24, 9, 0) + 30_000,
    workspace: '/p/notes',
    tokens: { input: 10, output: 5 }
  })
]

const JOURNAL: JournalSeries[] = [
  { profileId: 'bob', profileLabel: 'IBM Bob' },
  { profileId: 'gemini', profileLabel: 'Gemini' },
  { profileId: 'opencode', profileLabel: 'OpenCode', model: { id: 'gpt', name: 'GPT-6.1 Sol' } },
  {
    profileId: 'opencode',
    profileLabel: 'OpenCode',
    model: { id: 'mistral', name: 'Mistral interne' }
  }
]

const SLOTS: Record<string, number> = { bob: 0, opencode: 1, mock: 2 }
const TITLES: Record<string, string> = { bob1: 'Plan de migration', oc1: 'Explique-moi ce projet' }
const context = {
  now: NOW,
  agentSlot: (id: string) => SLOTS[id],
  title: (id: string) => TITLES[id]
}

const stats = (rows = ROWS, scope: UsageScope = 'week', date = '2026-10-24') =>
  usageStats(rows, JOURNAL, { scope, date }, context)

describe('périodes et seaux de « Mon activité » (fiche 144)', () => {
  it('bornes : semaine du lundi au dimanche, mois, douze mois glissants, jour ; « all » du premier tour', () => {
    const range = (scope: UsageScope) => queryRange({ scope, date: '2026-10-24' }, NOW, at(3))
    expect(range('week')).toEqual({
      from: new Date(2026, 9, 19).getTime(),
      to: new Date(2026, 9, 26).getTime()
    })
    expect(range('month')).toEqual({
      from: new Date(2026, 9, 1).getTime(),
      to: new Date(2026, 10, 1).getTime()
    })
    expect(range('year')?.from).toBe(new Date(2025, 10, 1).getTime())
    expect(range('day')?.to).toBe(new Date(2026, 9, 25).getTime())
    expect(range('all')).toEqual({
      from: new Date(2026, 9, 3).getTime(),
      to: new Date(2026, 9, 25).getTime()
    })
    expect(queryRange({ scope: 'all', date: '2026-10-24' }, NOW, undefined)).toBeUndefined()
  })

  it('seaux : 24 heures d’un jour (changement d’heure compris), jours, douze mois', () => {
    const day = (d: number) => new Date(2026, 9, d).getTime()
    const hours = bucketKeys('hour', day(25), day(26))
    expect([hours.length, hours[0], hours.at(-1)]).toEqual([24, '2026-10-25T00', '2026-10-25T23'])
    expect(bucketKeys('day', day(23), day(28))).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27'
    ])
    const months = bucketKeys(
      'month',
      new Date(2025, 10, 1).getTime(),
      new Date(2026, 10, 1).getTime()
    )
    expect([months.length, months[0], months.at(-1)]).toEqual([12, '2025-11', '2026-10'])
  })

  it('un jour se range par heure, l’année par mois', () => {
    const today = stats(ROWS, 'day')
    expect(today.bucket).toBe('hour')
    expect(today.buckets.find((b) => b.key === '2026-10-24T08')?.byAgent['opencode']?.turns).toBe(1)
    const year = stats(ROWS, 'year')
    expect(year.buckets.map((b) => b.key).at(-1)).toBe('2026-10')
    expect(year.buckets.at(-1)?.byAgent['bob']?.turns).toBe(2)
    expect([year.range, year.current]).toEqual([{ first: '2025-11-01', last: '2026-10-31' }, true])
    expect(stats(ROWS, 'week', '2026-10-01').current).toBe(false)
  })

  it('comparaison : période précédente à date égale si en cours ; rien pour l’année', () => {
    const first = at(1)
    const week = comparisonPlan({ scope: 'week', date: '2026-10-24' }, NOW, first)
    // Samedi 15 h : du lundi 12 au samedi 17 à 15 h.
    expect(week).toEqual({
      kind: 'previous',
      sameDate: true,
      from: new Date(2026, 9, 12).getTime(),
      to: new Date(2026, 9, 17, 15).getTime()
    })
    const past = comparisonPlan(
      { scope: 'month', date: '2026-09-10' },
      NOW,
      at(1) - 40 * 86_400_000
    )
    expect(past).toMatchObject({
      sameDate: false,
      from: new Date(2026, 7, 1).getTime(),
      to: new Date(2026, 8, 1).getTime()
    })
    expect(comparisonPlan({ scope: 'year', date: '2026-10-24' }, NOW, first)).toBeUndefined()
    // Journal commencé après la période précédente : rien à comparer.
    expect(comparisonPlan({ scope: 'week', date: '2026-10-24' }, NOW, at(20))).toBeUndefined()
  })

  it('un jour se compare à la moyenne de son jour de la semaine, depuis le début du journal', () => {
    const plan = comparisonPlan({ scope: 'day', date: '2026-10-24' }, NOW, at(3))
    expect(plan?.days).toEqual(['2026-10-17', '2026-10-10', '2026-10-03'])
    const rows = [
      row('a:1', { startedAt: at(17, 9), endedAt: at(17, 9, 1), tokens: { input: 30, output: 3 } }),
      row('a:2', {
        startedAt: at(17, 10),
        endedAt: at(17, 10, 1),
        cost: { amount: 0.3, currency: 'USD' }
      }),
      row('a:3', { startedAt: at(16, 10) }),
      row('a:4', { startedAt: at(10, 10), endedAt: at(10, 10, 1) })
    ]
    expect(compareRows(rows, plan ?? { kind: 'weekday', sameDate: false, from: 0, to: 0 })).toEqual(
      {
        kind: 'weekday',
        sameDate: false,
        days: 3,
        totals: { turns: 1, tokens: 11, durationMs: 60_000, costs: { USD: 0.1 } }
      }
    )
  })

  it('grille d’activité : échanges par jour et par agent, années passées', () => {
    const days = ['2026-10-21', '2026-10-22', '2026-10-23']
    const heat = heatmapOf(ROWS, days)
    expect(heat.total).toBe(3)
    expect(heat.days).toEqual([
      { day: '2026-10-21', turns: 2, byAgent: { bob: 2 } },
      { day: '2026-10-22', turns: 1, byAgent: { opencode: 1 } },
      { day: '2026-10-23', turns: 0, byAgent: {} }
    ])
    expect(pastYears(new Date(2024, 5, 1).getTime(), NOW)).toEqual([2025, 2024])
    expect(pastYears(at(1), NOW)).toEqual([])
    expect(pastYears(undefined, NOW)).toEqual([])
  })
})

describe('statistiques sur un journal fixe (fiche 137)', () => {
  it('chiffres clés : échanges, conversations, temps des tours finis, jetons, coûts par unité', () => {
    const { totals } = stats()
    expect(totals).toEqual({
      turns: 5,
      conversations: 3,
      durationMs: 120_000 + 120_000 + 60_000 + 30_000,
      finishedTurns: 4,
      input: 1410,
      output: 145,
      costs: { bobcoins: 0.75, USD: 0.02 },
      turnsWithoutTokens: 2,
      turnsWithoutCost: 2
    })
  })

  it('jours de la période, vides compris ; un tour compte le jour local où il commence', () => {
    const days = stats().buckets
    expect(days.map((d) => d.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25'
    ])
    const day21 = days.find((d) => d.key === '2026-10-21')
    expect(day21?.byAgent['bob']).toEqual({
      turns: 2,
      tokens: 0,
      costs: { bobcoins: 0.75 },
      durationMs: 240000
    })
    const day24 = days.find((d) => d.key === '2026-10-24')
    // Le tour d'OpenCode n'est pas fini : pas de temps pour lui.
    expect(day24?.byAgent).toEqual({
      opencode: { turns: 1, tokens: 440, costs: {}, durationMs: 0 },
      [OTHER_SERIES]: { turns: 1, tokens: 15, costs: {}, durationMs: 30000 }
    })
    expect(day24?.byModel['opencode:mistral']).toEqual({
      turns: 1,
      tokens: 440,
      costs: {},
      durationMs: 0
    })
  })

  it('« all » part du premier tour ; une période vide n’a pas de série', () => {
    expect(stats(ROWS, 'all').buckets[0]?.key).toBe('2026-10-21')
    const empty = stats([], 'day')
    expect(empty.buckets).toHaveLength(24)
    expect(empty.agentSeries).toEqual([])
    expect(stats([], 'all').buckets).toEqual([])
  })

  it('couleurs fixes : l’agent garde celle de son profil, quel que soit son rang ; sinon « Autres »', () => {
    expect(stats().agentSeries).toEqual([
      { key: 'bob', label: 'IBM Bob', slot: 0 },
      { key: 'opencode', label: 'OpenCode', slot: 1 },
      { key: OTHER_SERIES, label: '', slot: null }
    ])
    // OpenCode seul sur la période : il garde sa couleur (2e), Bob ne la lui prend pas.
    expect(stats(ROWS.filter((r) => r.profileId === 'opencode')).agentSeries).toEqual([
      { key: 'opencode', label: 'OpenCode', slot: 1 }
    ])
  })

  it('modèles : rang dans tout le journal (agents dans leur ordre), pas dans la période', () => {
    const { models } = seriesOf(JOURNAL, context.agentSlot)
    expect(models.map((m) => [m.key, m.label, m.slot])).toEqual([
      ['bob:', 'IBM Bob', 0],
      ['opencode:gpt', 'GPT-6.1 Sol', 1],
      ['opencode:mistral', 'Mistral interne', 2],
      ['gemini:', 'Gemini', null]
    ])
    const today = stats(ROWS, 'day')
    expect(today.modelSeries.map((m) => [m.key, m.slot])).toEqual([
      ['opencode:mistral', 2],
      [OTHER_SERIES, null]
    ])
  })

  it('par modèle : jetons, coûts par unité et tours qui en ont ; Bob sans modèle ni jetons', () => {
    const { byModel } = stats()
    expect(byModel.map((m) => [m.key, m.model, m.agentLabel, m.turns])).toEqual([
      ['bob:', undefined, 'IBM Bob', 2],
      ['gemini:', undefined, 'Gemini', 1],
      ['opencode:gpt', 'GPT-6.1 Sol', 'OpenCode', 1],
      ['opencode:mistral', 'Mistral interne', 'OpenCode', 1]
    ])
    expect(byModel[0]).toMatchObject({
      turnsWithoutTokens: 2,
      costs: { bobcoins: 0.75 },
      costTurns: { bobcoins: 2 }
    })
    expect(byModel[2]).toMatchObject({ input: 1000, output: 100, costs: { USD: 0.02 } })
  })

  it('par projet : worktrees sur leur dépôt ; conversations : titre, ou supprimée', () => {
    const { byProject, conversations } = stats()
    expect(byProject.map((p) => [p.name, p.turns, p.tokens])).toEqual([
      ['bobine', 2, 1540],
      ['carnet', 2, 0],
      ['notes', 1, 15]
    ])
    expect(conversations.map((c) => [c.id, c.title, c.turns])).toEqual([
      ['oc1', 'Explique-moi ce projet', 2],
      ['bob1', 'Plan de migration', 2],
      ['gone', undefined, 1]
    ])
  })

  it('dix conversations au plus, les plus longues d’abord', () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      Array.from({ length: i + 1 }, (_, k) => row(`c${i}:${k}`, { startedAt: at(24, 1, k) }))
    ).flat()
    const top = stats(many).conversations
    expect(top).toHaveLength(TOP_CONVERSATIONS)
    expect(top[0]).toMatchObject({ id: 'c13', turns: 14 })
  })

  it('agents du filtre : tout le journal ; journal vide signalé', () => {
    const result = stats([])
    expect(result.agents.map((a) => a.profileId)).toEqual(['bob', 'opencode', 'gemini'])
    expect(result.journalEmpty).toBe(false)
    expect(usageStats([], [], { scope: 'all', date: '2026-10-24' }, context).journalEmpty).toBe(
      true
    )
  })
})
