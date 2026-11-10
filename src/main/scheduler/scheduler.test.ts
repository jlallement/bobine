import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentEvent, ConversationEvent, ConversationSummary } from '@shared/agent'
import type { ConversationListeners } from '../conversations/manager'
import type { DetachedRequest } from '../conversations/helpers'
import { parseLocalDateTime, type ScheduledTask, type ScheduledTaskInput } from '@shared/schedule'
import { Scheduler } from './scheduler'

/** Gestionnaire factice : ce que le planificateur en utilise, rien d'autre. */
function fakeManager() {
  const listeners = new Set<ConversationListeners>()
  const created: DetachedRequest[] = []
  const prompts: { id: string; text: string }[] = []
  const posts: { id: string; event: AgentEvent }[] = []
  const usage = new Map<string, ConversationSummary['usage']>()
  const transcripts = new Map<string, { usage?: unknown; costCap?: unknown }>()
  let n = 0
  const emit = (payload: ConversationEvent) => listeners.forEach((l) => l.event?.(payload))
  const manager = {
    createDetached: vi.fn(async (request: DetachedRequest) => {
      created.push(request)
      const id = `c${++n}`
      transcripts.set(id, {})
      return { id } as ConversationSummary
    }),
    prompt: vi.fn(async (id: string, text: string) => {
      prompts.push({ id, text })
    }),
    subscribe: (l: ConversationListeners) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    state: () => ({
      activeId: '',
      conversations: [...usage].map(([id, u]) => ({ id, usage: u }) as ConversationSummary)
    }),
    view: (id: string) => ({ transcript: transcripts.get(id) ?? {} }) as never,
    post: (id: string, event: AgentEvent) => {
      posts.push({ id, event })
      const transcript = transcripts.get(id)
      if (event.type === 'cost-cap-set' && transcript) transcript.costCap = event.cap
      emit({ conversationId: id, event })
    }
  }
  return { manager, created, prompts, posts, usage, transcripts, emit, listeners }
}

const at = (s: string) => parseLocalDateTime(s) as Date
const firstId = (s: Scheduler) => s.list()[0]?.id ?? ''
const transcriptOf = (env: ReturnType<typeof fakeManager>, id: string) => {
  const transcript = env.transcripts.get(id)
  if (!transcript) throw new Error(id)
  return transcript
}

const input = (over: Partial<ScheduledTaskInput> = {}): ScheduledTaskInput => ({
  name: 'Revue',
  instruction: 'Relis les PR ouvertes',
  folder: '/projet',
  profileId: 'mock',
  schedule: { kind: 'interval', hours: 1 },
  worktree: false,
  catchUp: true,
  ...over
})

describe('Scheduler (fiche 178)', () => {
  let saved: ScheduledTask[][]
  let failures: string[]
  let env: ReturnType<typeof fakeManager>

  const start = (stored: ScheduledTask[] = [], isDirectory = () => true) => {
    const scheduler = new Scheduler({
      manager: env.manager as never,
      storage: {
        load: () => structuredClone(stored),
        save: (t) => saved.push(structuredClone([...t]))
      },
      isDirectory,
      notifyFailure: (task, reason) => failures.push(`${task.name}: ${reason}`),
      emit: () => {}
    })
    scheduler.start()
    return scheduler
  }
  const last = () => saved.at(-1)?.[0] as ScheduledTask
  const flush = () => vi.advanceTimersByTimeAsync(0)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(at('2026-11-06T08:00'))
    saved = []
    failures = []
    env = fakeManager()
  })
  afterEach(() => vi.useRealTimers())

  it('à l’échéance : une conversation marquée « planifiée », hors de l’active, puis la consigne', async () => {
    const scheduler = start()
    scheduler.create(input({ worktree: true }))
    expect(env.created).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(env.created).toHaveLength(1)
    expect(env.created[0]).toMatchObject({
      from: { workspace: '/projet', profileId: 'mock' },
      worktree: true,
      title: 'Revue',
      record: { scheduled: { name: 'Revue' } }
    })
    expect(env.prompts).toEqual([{ id: 'c1', text: 'Relis les PR ouvertes' }])
    expect(last().runs[0]).toMatchObject({ outcome: 'running', conversationId: 'c1' })
  })

  it('fin du tour : issue et coût réel notés', async () => {
    const scheduler = start()
    scheduler.create(input())
    await scheduler.runNow(firstId(scheduler))
    env.usage.set('c1', { total: 1200, cost: { amount: 1.5, currency: 'bobcoins' } })
    env.emit({ conversationId: 'c1', event: { type: 'turn-end' } as AgentEvent })
    expect(last().runs[0]).toMatchObject({
      outcome: 'done',
      manual: true,
      cost: { amount: 1.5, currency: 'bobcoins' },
      tokens: 1200
    })
  })

  it('échéance passée, nouveau worktree à préparer non autorisé : l’exécution part, l’historique le dit (fiche 175)', async () => {
    const task: ScheduledTask = {
      ...input({ worktree: true }),
      id: 't1',
      paused: false,
      createdAt: '2026-11-06T06:00:00.000Z',
      nextRunAt: new Date(at('2026-11-06T08:00').getTime() - 60_000).toISOString(),
      runs: []
    }
    start([task])
    await flush()
    expect(env.prompts).toEqual([{ id: 'c1', text: 'Relis les PR ouvertes' }])
    env.emit({
      conversationId: 'c1',
      event: {
        type: 'worktree-setup',
        setup: { command: 'pnpm i', state: 'skipped', unattended: true }
      }
    })
    env.emit({ conversationId: 'c1', event: { type: 'turn-end' } as AgentEvent })
    expect(last().runs[0]).toMatchObject({ outcome: 'done', setupNotApproved: true })
  })

  it('jamais deux exécutions à la fois : l’échéance est sautée', async () => {
    const scheduler = start()
    scheduler.create(input())
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(env.created).toHaveLength(1)
    expect(last().runs.map((r) => r.outcome)).toEqual(['skipped', 'running'])
    await expect(scheduler.runNow(last().id)).rejects.toThrow()
  })

  it('au réveil après une nuit : un seul rattrapage, la suivante repart de maintenant', async () => {
    const scheduler = start()
    scheduler.create(input())
    // Le Mac dort : l'horloge saute de dix heures sans que les minuteries tournent.
    vi.setSystemTime(at('2026-11-06T18:30'))
    scheduler.check()
    await flush()
    expect(env.created).toHaveLength(1)
    expect(last().runs[0]).toMatchObject({ outcome: 'running', catchUp: true, missed: 10 })
    expect(new Date(String(last().nextRunAt)).getTime()).toBe(at('2026-11-06T19:00').getTime())
  })

  it('sans rattrapage : notée manquée, rien ne part', async () => {
    const scheduler = start()
    scheduler.create(input({ catchUp: false }))
    vi.setSystemTime(at('2026-11-06T18:30'))
    scheduler.check()
    await flush()
    expect(env.created).toHaveLength(0)
    expect(last().runs[0]).toMatchObject({ outcome: 'missed', missed: 10 })
  })

  it('en pause : rien ne part ; à la reprise, rien n’est rattrapé', async () => {
    const scheduler = start()
    scheduler.create(input())
    const id = firstId(scheduler)
    scheduler.setPaused(id, true)
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000)
    expect(env.created).toHaveLength(0)
    scheduler.setPaused(id, false)
    await flush()
    expect(env.created).toHaveLength(0)
    expect(new Date(String(last().nextRunAt)).getTime()).toBe(at('2026-11-06T12:00').getTime())
  })

  it('dossier introuvable : lancement impossible, notification', async () => {
    const scheduler = start([], () => false)
    scheduler.create(input())
    await scheduler.runNow(firstId(scheduler))
    expect(env.created).toHaveLength(0)
    expect(last().runs[0]?.outcome).toBe('failed')
    expect(failures).toHaveLength(1)
  })

  it('plafond de la tâche : posé à la première consommation, dans l’unité de l’agent', async () => {
    const scheduler = start()
    scheduler.create(input({ cap: { amount: 2, tokens: 50_000 } }))
    await scheduler.runNow(firstId(scheduler))
    expect(env.posts).toHaveLength(0)
    transcriptOf(env, 'c1').usage = {
      sessions: [],
      cost: { amount: 0.1, currency: 'bobcoins' }
    }
    env.emit({ conversationId: 'c1', event: { type: 'usage-report' } as AgentEvent })
    expect(env.posts.map((p) => p.event)).toEqual([
      { type: 'cost-cap-set', cap: { limit: 2, unit: 'bobcoins' } }
    ])
    // Plafond atteint : l'exécution est notée arrêtée au plafond.
    env.emit({ conversationId: 'c1', event: { type: 'cost-cap-reached' } as AgentEvent })
    env.emit({ conversationId: 'c1', event: { type: 'turn-end' } as AgentEvent })
    expect(last().runs[0]?.outcome).toBe('capped')
  })

  it('plafond posé avant le premier message quand l’unité est connue d’une exécution précédente', async () => {
    const scheduler = start()
    scheduler.create(input({ cap: { amount: 3 } }))
    const id = firstId(scheduler)
    await scheduler.runNow(id)
    env.usage.set('c1', { cost: { amount: 1, currency: 'USD' } })
    env.emit({ conversationId: 'c1', event: { type: 'turn-end' } as AgentEvent })
    await scheduler.runNow(id)
    expect(env.posts.at(-1)).toEqual({
      id: 'c2',
      event: { type: 'cost-cap-set', cap: { limit: 3, unit: 'USD' } }
    })
  })

  it('au démarrage : une exécution restée « en cours » est notée interrompue', () => {
    const stored: ScheduledTask = {
      ...input(),
      id: 't',
      paused: false,
      createdAt: '',
      runs: [{ id: 'r', at: '', outcome: 'running', conversationId: 'x' }]
    }
    const scheduler = start([stored])
    expect(scheduler.list()[0]?.runs[0]?.outcome).toBe('stopped')
  })
})
