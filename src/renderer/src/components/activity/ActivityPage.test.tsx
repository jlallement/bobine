import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentQuota } from '@shared/usage'
import { addDays } from '@shared/usage-periods'
import type { UsageHeatmap, UsageHeatQuery, UsageQuery, UsageStats } from '@shared/usage-stats'
import { OTHER_SERIES } from '@shared/usage-stats'
import { settingsIndex } from '../../settings-search'
import { ActivityPage } from './ActivityPage'

/** Statistiques d'un journal d'essai : Bob (Bobcoins, sans jetons), OpenCode (dollars), un autre. */
const STATS: UsageStats = {
  query: { scope: 'week', date: '2026-10-24' },
  range: { first: '2026-10-19', last: '2026-10-25' },
  current: true,
  bucket: 'day',
  buckets: [
    { key: '2026-10-19', byAgent: {}, byModel: {} },
    { key: '2026-10-20', byAgent: {}, byModel: {} },
    {
      key: '2026-10-21',
      byAgent: { bob: { turns: 2, tokens: 0, costs: { bobcoins: 0.75 }, durationMs: 240_000 } },
      byModel: { 'bob:': { turns: 2, tokens: 0, costs: { bobcoins: 0.75 }, durationMs: 240_000 } }
    },
    {
      key: '2026-10-22',
      byAgent: { opencode: { turns: 1, tokens: 1100, costs: { USD: 0.02 }, durationMs: 90_000 } },
      byModel: {
        'opencode:gpt': { turns: 1, tokens: 1100, costs: { USD: 0.02 }, durationMs: 90_000 }
      }
    },
    { key: '2026-10-23', byAgent: {}, byModel: {} },
    {
      key: '2026-10-24',
      byAgent: {
        opencode: { turns: 1, tokens: 440, costs: {}, durationMs: 0 },
        [OTHER_SERIES]: { turns: 1, tokens: 15, costs: {}, durationMs: 0 }
      },
      byModel: {
        'opencode:mistral': { turns: 1, tokens: 440, costs: {}, durationMs: 0 },
        [OTHER_SERIES]: { turns: 1, tokens: 15, costs: {}, durationMs: 0 }
      }
    },
    { key: '2026-10-25', byAgent: {}, byModel: {} }
  ],
  agentSeries: [
    { key: 'bob', label: 'IBM Bob', slot: 1 },
    { key: 'opencode', label: 'OpenCode', slot: 2 },
    { key: OTHER_SERIES, label: '', slot: null }
  ],
  modelSeries: [
    { key: 'bob:', label: 'IBM Bob', slot: 0, agentLabel: 'IBM Bob' },
    { key: 'opencode:gpt', label: 'GPT-6.1 Sol', slot: 1, agentLabel: 'OpenCode' },
    { key: 'opencode:mistral', label: 'Mistral interne', slot: 2, agentLabel: 'OpenCode' },
    { key: OTHER_SERIES, label: '', slot: null }
  ],
  totals: {
    turns: 5,
    conversations: 3,
    durationMs: 330_000,
    finishedTurns: 4,
    input: 1410,
    output: 145,
    costs: { bobcoins: 0.75, USD: 0.02 },
    turnsWithoutTokens: 2,
    turnsWithoutCost: 2
  },
  comparison: {
    kind: 'previous',
    sameDate: true,
    days: 1,
    totals: { turns: 4, tokens: 1000, durationMs: 330_000, costs: { bobcoins: 0.5 } }
  },
  byModel: [
    {
      key: 'bob:',
      profileId: 'bob',
      agentLabel: 'IBM Bob',
      turns: 2,
      input: 0,
      output: 0,
      turnsWithoutTokens: 2,
      costs: { bobcoins: 0.75 },
      costTurns: { bobcoins: 2 }
    },
    {
      key: 'opencode:gpt',
      model: 'GPT-6.1 Sol',
      profileId: 'opencode',
      agentLabel: 'OpenCode',
      turns: 1,
      input: 1000,
      output: 100,
      turnsWithoutTokens: 0,
      costs: { USD: 0.02 },
      costTurns: { USD: 1 }
    },
    {
      key: 'opencode:mistral',
      model: 'Mistral interne',
      profileId: 'opencode',
      agentLabel: 'OpenCode',
      turns: 1,
      input: 400,
      output: 40,
      turnsWithoutTokens: 0,
      costs: {},
      costTurns: {}
    }
  ],
  byProject: [
    { key: '/p/bobine', name: 'bobine', turns: 2, tokens: 1540 },
    { key: '/p/carnet', name: 'carnet', turns: 2, tokens: 0 }
  ],
  conversations: [
    {
      id: 'oc1',
      title: 'Explique-moi ce projet',
      agentLabel: 'OpenCode',
      turns: 2,
      tokens: 1540,
      costs: { USD: 0.02 }
    },
    { id: 'gone', agentLabel: 'Gemini', turns: 1, tokens: 15, costs: {} }
  ],
  agents: [
    { profileId: 'bob', label: 'IBM Bob' },
    { profileId: 'opencode', label: 'OpenCode' }
  ],
  journalEmpty: false
}

/** Grille : deux semaines, jusqu'au samedi 24 octobre 2026 (aujourd'hui). */
const HEAT: UsageHeatmap = {
  query: { range: 'last12' },
  days: Array.from({ length: 14 }, (_, i) => {
    const day = addDays('2026-10-11', i)
    const byAgent: Record<string, number> =
      day === '2026-10-21' ? { bob: 2 } : day === '2026-10-22' ? { opencode: 1 } : {}
    return { day, turns: Object.values(byAgent).reduce((a, b) => a + b, 0), byAgent }
  }),
  total: 3,
  today: '2026-10-24',
  years: [2025],
  labels: { bob: 'IBM Bob', opencode: 'OpenCode' }
}

const QUOTA: AgentQuota = {
  profileId: 'bob',
  profileLabel: 'IBM Bob',
  currency: 'bobcoins',
  limit: 20,
  used: 6.4,
  readAt: 0
}

let api: Record<string, ReturnType<typeof vi.fn>>
let changed: () => void = () => {}
const original = window.api

beforeEach(() => {
  api = {
    stats: vi.fn(async (query: UsageQuery) => ({ ...STATS, query })),
    heatmap: vi.fn(async (query: UsageHeatQuery) => ({ ...HEAT, query })),
    exportCsv: vi.fn(async () => '/Users/moi/Documents/bobine-turns.csv'),
    reset: vi.fn(async () => undefined),
    hasAny: vi.fn(async () => true),
    spends: vi.fn(async () => [
      {
        profileId: 'bob',
        profileLabel: 'IBM Bob',
        currency: 'bobcoins',
        today: 0.35,
        week: 0.85,
        month: 1.2
      }
    ]),
    quotas: vi.fn(async () => [QUOTA]),
    onQuotasChanged: vi.fn(() => () => {}),
    onChanged: vi.fn((listener: () => void) => {
      changed = listener
      return () => {}
    })
  }
  window.api = { ...original, usage: api } as unknown as Window['api']
  // Samedi 24 octobre 2026 : la page s'ouvre sur la semaine du 19 au 25.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24, 15))
})
afterEach(() => {
  vi.useRealTimers()
  window.api = original
})

const WEEK = { scope: 'week', date: '2026-10-24' }

const text = (testId: string) =>
  (screen.getByTestId(testId).textContent ?? '').replace(/[  ]/g, ' ')

async function shown(onOpen = vi.fn()) {
  render(<ActivityPage onOpenConversation={onOpen} />)
  await screen.findByTestId('usage-kpis')
  await screen.findByTestId('usage-quota')
  return onOpen
}

describe('Mon activité (fiches 137 et 144)', () => {
  it('quatre chiffres clés, et l’écart à la semaine d’avant à date égale, en texte discret', async () => {
    await shown()
    expect(api['stats']).toHaveBeenCalledWith(WEEK)
    expect(text('usage-kpi-turns')).toBe(
      'Échanges5dans 3 conversations25 % vs semaine précédente à date égale'
    )
    // Bob ne communique pas ses jetons : le chiffre dit qui il couvre (fiche 147).
    expect(text('usage-kpi-tokens')).toBe(
      'Jetons traités · OpenCode1,6kentrée 1,4k · sortie 145' + '56 %'
    )
    // Les mesures comparables d'abord : échanges, temps, puis jetons et coût.
    expect(
      [...screen.getByTestId('usage-kpis').children].map((k) => k.getAttribute('data-testid'))
    ).toEqual(['usage-kpi-turns', 'usage-kpi-time', 'usage-kpi-tokens', 'usage-kpi-cost'])
    expect(text('usage-kpi-time')).toBe('Temps de travail5 min 30 s1 min 22 s par échangestable')
    expect(text('usage-kpi-cost')).toBe('Coût0,75 Bobcoinset 0,02 $US (OpenCode)50 %')
    const deltas = screen.getAllByTestId('activity-delta')
    expect(deltas.map((d) => d.dataset['direction'])).toEqual(['up', 'flat', 'up', 'up'])
    expect(deltas[0]?.getAttribute('title')?.replace(/[\u00a0\u202f]/g, ' ')).toBe('Avant : 4')
  })

  it('un jour se compare à la moyenne de son jour de la semaine ; l’année, à rien', async () => {
    api['stats']?.mockImplementation(async (query: UsageQuery) => ({
      ...STATS,
      query,
      bucket: query.scope === 'day' ? 'hour' : 'month',
      comparison:
        query.scope === 'day'
          ? {
              kind: 'weekday',
              sameDate: false,
              days: 3,
              totals: { ...STATS.totals, turns: 2, tokens: 0, durationMs: 0, costs: {} }
            }
          : undefined
    }))
    await shown()
    fireEvent.click(screen.getAllByTestId('activity-heat-day')[10] as Element)
    await waitFor(() =>
      expect(api['stats']).toHaveBeenLastCalledWith({ scope: 'day', date: '2026-10-21' })
    )
    await waitFor(() =>
      expect(text('usage-kpi-turns')).toBe(
        'Échanges5dans 3 conversations2,5 × la moyenne d’un mercredi'
      )
    )
    expect(screen.getAllByTestId('activity-delta')).toHaveLength(1)
    expect(text('usage-chart-title')).toBe('Échanges par heure')
    fireEvent.click(screen.getByTestId('activity-scope-year'))
    await waitFor(() => expect(screen.queryAllByTestId('activity-delta')).toHaveLength(0))
    expect(text('usage-chart-title')).toBe('Échanges par mois')
  })

  it('graphique : une colonne par jour, segments empilés, légende, infobulle au survol', async () => {
    await shown()
    expect(screen.getAllByTestId('usage-bar')).toHaveLength(7)
    const day24 = screen.getAllByTestId('usage-bar')[5] as Element
    expect([...day24.querySelectorAll('path')].map((p) => p.getAttribute('fill'))).toEqual([
      'var(--chart-3)',
      'var(--chart-other)'
    ])
    expect(text('usage-legend')).toBe('IBM BobOpenCodeAutres')
    expect(text('usage-chart-title')).toBe('Échanges par jour')
    fireEvent.mouseEnter(screen.getAllByTestId('usage-day')[2] as Element)
    expect(text('usage-chart-tip')).toContain('IBM Bob · 2')
    // Par modèle, puis le coût en Bobcoins.
    fireEvent.click(screen.getByTestId('usage-grouping-model'))
    expect(text('usage-legend')).toBe('IBM BobGPT-6.1 SolMistral interneAutres')
    fireEvent.click(screen.getByTestId('usage-metric-cost:bobcoins'))
    expect(screen.getByText('Coût par jour (Bobcoins)')).toBeTruthy()
    expect(screen.getAllByTestId('usage-bar')[5]?.querySelectorAll('path')).toHaveLength(0)
    expect(text('usage-coverage')).toBe('Coût (Bobcoins) : IBM Bob seulement.')
  })

  it('mesures comparables et partielles (fiche 147) : temps empilé, note de couverture', async () => {
    await shown()
    expect(
      screen.getAllByRole('radio', { name: /Échanges|Temps|Jetons|Coût/ }).map((b) => b.textContent)
    ).toEqual(['Échanges', 'Temps', 'Jetons', 'Coût (Bobcoins)', 'Coût ($)'])
    // Échanges et temps couvrent tout le monde : pas de note.
    expect(screen.queryByTestId('usage-coverage')).toBeNull()
    fireEvent.click(screen.getByTestId('usage-metric-time'))
    expect(text('usage-chart-title')).toBe('Temps de travail par jour')
    expect(screen.queryByTestId('usage-coverage')).toBeNull()
    fireEvent.mouseEnter(screen.getAllByTestId('usage-day')[2] as Element)
    expect(text('usage-chart-tip')).toContain('IBM Bob · 4 min 00 s')
    expect(screen.getByText('4 min')).toBeTruthy()
    fireEvent.click(screen.getByTestId('usage-metric-tokens'))
    expect(text('usage-coverage')).toBe(
      'Jetons : OpenCode seulement. IBM Bob ne communique pas ses jetons.'
    )
  })

  it('filtres : semaine en cours (suivante grisée), précédente, mois, agent', async () => {
    await shown()
    expect(text('activity-period')).toBe('19–25 oct. 2026')
    expect((screen.getByTestId('activity-next') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('activity-previous'))
    await waitFor(() =>
      expect(api['stats']).toHaveBeenLastCalledWith({ scope: 'week', date: '2026-10-17' })
    )
    expect(text('activity-period')).toBe('12–18 oct. 2026')
    expect((screen.getByTestId('activity-next') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('activity-scope-month'))
    await waitFor(() =>
      expect(api['stats']).toHaveBeenLastCalledWith({ scope: 'month', date: '2026-10-17' })
    )
    expect(text('activity-period')).toBe('octobre 2026')
    fireEvent.change(screen.getByTestId('usage-agent'), { target: { value: 'bob' } })
    await waitFor(() =>
      expect(api['stats']).toHaveBeenLastCalledWith({
        scope: 'month',
        date: '2026-10-17',
        profileId: 'bob'
      })
    )
    expect(api['heatmap']).toHaveBeenLastCalledWith({ range: 'last12', profileId: 'bob' })
  })

  it('grille : niveaux, aujourd’hui cerclé, jours hors période pâlis, infobulle, clic sur un jour', async () => {
    await shown()
    const cells = screen.getAllByTestId('activity-heat-day')
    expect(cells).toHaveLength(14)
    expect(text('activity-heat-total')).toBe('3 échanges')
    expect(cells.filter((c) => c.classList.contains('dim')).map((c) => c.dataset['day'])).toEqual(
      Array.from({ length: 8 }, (_, i) => addDays('2026-10-11', i))
    )
    expect(cells[10]?.getAttribute('class')).toContain('heat-level-4')
    expect(cells[11]?.getAttribute('class')).toContain('heat-level-1')
    expect(cells[12]?.getAttribute('class')).toContain('heat-level-0')
    expect(screen.getByTestId('activity-heat-today')).toBeTruthy()
    fireEvent.mouseEnter(cells[10] as Element)
    expect(text('activity-heat-tip')).toBe('2 échanges · mercredi 21 oct.IBM Bob 2')
    fireEvent.click(cells[10] as Element)
    await waitFor(() => expect(text('activity-period')).toBe('mercredi 21 octobre 2026'))
    // Aucun segment de période actif ; restent la mesure, puis le regroupement (fiche 147).
    expect(screen.getAllByRole('radio', { checked: true }).map((r) => r.textContent)).toEqual([
      'Échanges',
      'Agents'
    ])
    expect(screen.getByTestId('activity-heat-picked')).toBeTruthy()
    fireEvent.click(screen.getByTestId('activity-day-close'))
    await waitFor(() =>
      expect(api['stats']).toHaveBeenLastCalledWith({ scope: 'week', date: '2026-10-21' })
    )
  })

  it('grille : « 12 derniers mois » propose aussi les années passées', async () => {
    await shown()
    fireEvent.pointerDown(screen.getByTestId('activity-heat-range'), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByTestId('activity-heat-range-2025'))
    await waitFor(() => expect(api['heatmap']).toHaveBeenLastCalledWith({ range: 2025 }))
    await waitFor(() => expect(screen.getByText('en 2025')).toBeTruthy())
  })

  it('tableaux : par modèle (non communiqué), par projet, conversations (un clic l’ouvre)', async () => {
    const onOpen = await shown()
    const models = screen.getAllByTestId('usage-model-row').map((r) => r.textContent)
    expect(models[0]).toBe(
      'IBM Bob · modèle non communiqué2non communiqué0,75 Bobcoins0,375 Bobcoins'
    )
    expect(models[2]).toContain('non communiqué—')
    expect(screen.getAllByTestId('usage-project-row')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('usage-conversation-open'))
    expect(onOpen).toHaveBeenCalledWith('oc1')
    expect(screen.getByText('Conversation supprimée')).toBeTruthy()
  })

  it('IBM Bob sur ce Mac : quota du mois et dépense, venus des canaux génériques', async () => {
    await shown()
    expect(text('usage-quota')).toBe('6,4 sur 20 Bobcoins · 32 %')
    expect(text('usage-spend-today')).toBe('0,35 Bobcoins')
    expect(screen.getByText('IBM Bob sur ce Mac')).toBeTruthy()
    // Filtre sur un autre agent : plus de carte de Bob (fiche 147) ; sur Bob : elle revient.
    fireEvent.change(screen.getByTestId('usage-agent'), { target: { value: 'opencode' } })
    await waitFor(() => expect(screen.queryByText('IBM Bob sur ce Mac')).toBeNull())
    fireEvent.change(screen.getByTestId('usage-agent'), { target: { value: 'bob' } })
    await waitFor(() => expect(screen.getByText('IBM Bob sur ce Mac')).toBeTruthy())
  })

  it('export : par tour ou par jour pour la période, ou tout l’historique', async () => {
    await shown()
    fireEvent.pointerDown(screen.getByTestId('usage-export'), { button: 0, ctrlKey: false })
    fireEvent.click(await screen.findByTestId('usage-export-days'))
    await waitFor(() => expect(api['exportCsv']).toHaveBeenCalledWith(WEEK, 'days'))
    expect(await screen.findByTestId('usage-export-note')).toBeTruthy()
    fireEvent.pointerDown(screen.getByTestId('usage-export'), { button: 0, ctrlKey: false })
    await act(async () => {
      fireEvent.click(await screen.findByTestId('usage-export-all'))
    })
    expect(api['exportCsv']).toHaveBeenLastCalledWith({ ...WEEK, scope: 'all' }, 'turns')
  })

  it('chaque libellé affiché est dans l’index de la recherche (sauf le nom de l’agent)', async () => {
    await shown()
    const indexed = settingsIndex()
      .filter((e) => e.section === 'activity')
      .map((e) => e.label)
    const labels = [...document.querySelectorAll('.settings-row-label, h3')]
      .map((el) => el.textContent?.trim() ?? '')
      .filter((label) => label !== 'IBM Bob sur ce Mac')
    expect(labels.filter((label) => !indexed.includes(label))).toEqual([])
  })

  it('journal changé (un tour, une remise à zéro) : la page et la grille se relisent', async () => {
    await shown()
    const [stats, heat, any] = [
      api['stats']?.mock.calls.length,
      api['heatmap']?.mock.calls.length,
      api['hasAny']?.mock.calls.length
    ]
    act(() => changed())
    await waitFor(() => expect(api['stats']?.mock.calls.length).toBe((stats ?? 0) + 1))
    // Le journal est-il vide ? (fiche 185, F9).
    await waitFor(() => expect(api['hasAny']?.mock.calls.length).toBe((any ?? 0) + 1))
    await waitFor(() => expect(api['heatmap']?.mock.calls.length).toBe((heat ?? 0) + 1))
  })

  it('journal vide : un état vide qui propose de commencer, ni grille ni chiffres (fiche 185)', async () => {
    api['stats']?.mockResolvedValue(EMPTY_STATS)
    api['hasAny']?.mockResolvedValue(false)
    render(<ActivityPage onOpenConversation={() => {}} onNewConversation={() => {}} />)
    expect(await screen.findByTestId('activity-empty')).toBeTruthy()
    expect(screen.queryByTestId('usage-kpis')).toBeNull()
    expect(screen.getByTestId('activity-empty').textContent).toContain('Nouvelle conversation')
  })

  it('période vide, journal non vide : chiffres à zéro, « — » plutôt que « non communiqué »', async () => {
    api['stats']?.mockImplementation(async (query: UsageQuery) => ({ ...EMPTY_STATS, query }))
    await shown()
    expect(screen.getByTestId('usage-chart-empty')).toBeTruthy()
    expect(text('usage-kpi-cost')).toBe('Coût—')
  })
})

/** Journal vide : aucun échange, aucune ligne. */
const EMPTY_STATS = {
  ...STATS,
  buckets: [],
  agentSeries: [],
  comparison: undefined,
  byModel: [],
  byProject: [],
  conversations: [],
  totals: {
    ...STATS.totals,
    turns: 0,
    conversations: 0,
    durationMs: 0,
    finishedTurns: 0,
    input: 0,
    output: 0,
    costs: {},
    turnsWithoutTokens: 0,
    turnsWithoutCost: 0
  }
}
