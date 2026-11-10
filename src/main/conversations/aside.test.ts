import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { AsideView } from '@shared/aside'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentHostOptions } from '../agent/agent-host'
import type { AgentProfile } from '../agent/profiles'
import { asideExchanges, asideHostOptions, Asides, type AsideConversations } from './aside'

function mockProfile(...args: string[]): AgentProfile {
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', ...args],
    env: {}
  }
}

const ITEMS: TranscriptItem[] = [
  { kind: 'user', id: 1, text: 'Ajoute un test au parseur' },
  { kind: 'agent', id: 2, text: 'Test ajouté.' }
]

function setup(...args: string[]) {
  const posted: AgentEvent[] = []
  const noted: string[][] = []
  const views: AsideView[] = []
  const listeners: Parameters<AsideConversations['subscribe']>[0][] = []
  const conversations: AsideConversations = {
    asideHost: (_id, emit) => ({
      profile: mockProfile(...args),
      workspace: process.cwd(),
      emit,
      conversationId: 'c1',
      extraContext: () => 'ne doit pas partir'
    }),
    view: () => ({ transcript: { items: ITEMS } }),
    post: (_id, event) => posted.push(event),
    noteAsideSession: (...note) => noted.push(note),
    subscribe: (l) => {
      listeners.push(l)
      return () => {}
    }
  }
  const asides = new Asides({ conversations, emit: (v) => views.push(v), lateCostMs: 0 })
  const last = () => views.at(-1)
  return { asides, posted, noted, views, listeners, last }
}

function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('délai dépassé'))
      setTimeout(check, 20)
    }
    check()
  })
}

const answered = (view: AsideView | undefined, count = 1) =>
  view?.status === 'ready' && view.exchanges.length === count && !!view.exchanges.at(-1)?.answer

describe('Asides (fiche 180)', () => {
  it('question sans le fil : session à part en mode plan, consigne de lecture seule, coût compté, session supprimée', async () => {
    const { asides, posted, noted, last } = setup()
    await asides.ask('c1', { question: 'C’est quoi déjà ce flag ?', withContext: false })
    await waitFor(() => answered(last()))
    const exchange = last()?.exchanges[0]
    expect(exchange?.question).toBe('C’est quoi déjà ce flag ?')
    expect(exchange?.answer).toContain('Aparté reçu, en lecture seule.')
    expect(exchange?.answer).toContain('Rien du fil principal.')
    // Mode de départ : le mode plan de l'agent (générique, `isPlanMode`).
    expect(exchange?.answer).toMatch(/plan/i)
    // Rien du contexte de la conversation (nouvelles des filles…) ne part avec l'aparté.
    expect(exchange?.answer).not.toContain('ne doit pas partir')
    expect(last()?.cost?.currency).toBe('USD')

    await asides.close('c1')
    expect(last()?.status).toBe('closed')
    const costs = posted.filter((e) => e.type === 'aside-cost')
    expect(costs).toHaveLength(1)
    expect(costs[0]?.type === 'aside-cost' && costs[0].cost.amount).toBeGreaterThan(0)
    // L'agent factice sait supprimer : rien à retenir.
    expect(noted).toEqual([])
    expect(asides.view('c1')).toBeNull()
  })

  it('avec le fil : la fin de la conversation part avec la question ; une deuxième question dans la même session', async () => {
    const { asides, last } = setup()
    await asides.ask('c1', { question: 'Et ce test ?', withContext: true })
    await waitFor(() => answered(last()))
    expect(last()?.exchanges[0]?.answer).toContain('Fil principal joint : 1 message(s)')
    await asides.ask('c1', { question: 'Encore une', withContext: false })
    await waitFor(() => answered(last(), 2))
    expect(last()?.exchanges.map((e) => e.question)).toEqual(['Et ce test ?', 'Encore une'])
    await asides.close('c1')
  })

  it('lecture seule : une demande d’autorisation est refusée d’office', async () => {
    const { asides, last } = setup()
    await asides.ask('c1', { question: '/scenario permission', withContext: false })
    await waitFor(() => answered(last()))
    expect(last()?.exchanges[0]?.refused).toBe(1)
    await asides.close('c1')
  })

  it('pendant une réponse, une autre question est refusée', async () => {
    const { asides, last } = setup()
    const first = asides.ask('c1', { question: 'Une', withContext: false })
    await expect(asides.ask('c1', { question: 'Deux', withContext: false })).rejects.toThrow()
    await first
    await waitFor(() => answered(last()))
    await asides.close('c1')
  })

  it('agent qui ne sait ni supprimer ni fermer : la session est retenue (pas dans « Reprendre une session… »)', async () => {
    const { asides, noted, last } = setup('--sans-historique')
    await asides.ask('c1', { question: 'Une question', withContext: false })
    await waitFor(() => answered(last()))
    await asides.close('c1')
    expect(noted).toHaveLength(1)
    expect(noted[0]?.[0]).toBe('c1')
    expect(noted[0]?.[1]).toBe('mock')
  })

  it('conversation supprimée, sortie de l’app : l’aparté se ferme', async () => {
    const { asides, listeners, last } = setup()
    await asides.ask('c1', { question: 'Une question', withContext: false })
    await waitFor(() => answered(last()))
    listeners[0]?.deleted?.('c1')
    await waitFor(() => last()?.status === 'closed')
    await asides.ask('c1', { question: 'Une autre', withContext: false })
    await waitFor(() => answered(last()))
    listeners[0]?.stopped?.()
    expect(asides.view('c1')).toBeNull()
  })
})

describe('asideHostOptions', () => {
  it('garde agent, dossier, clés et réglages ; retire outils de l’app, contexte joint, session à rouvrir', () => {
    const emit = () => {}
    const base: AgentHostOptions = {
      profile: mockProfile(),
      workspace: '/projet',
      emit,
      conversationId: 'c1',
      toolServer: { register: () => undefined },
      extraContext: () => 'nouvelles',
      sessionContext: () => 'capacités',
      rememberedTools: { has: () => true, add: () => {} },
      reopen: { sessionId: 's1' },
      initialControls: { model: 'factice-rapide' },
      initialMode: 'execute'
    }
    const options = asideHostOptions(base, emit)
    expect(options).toMatchObject({
      workspace: '/projet',
      initialControls: { model: 'factice-rapide' },
      initialMode: 'plan'
    })
    for (const key of [
      'conversationId',
      'toolServer',
      'extraContext',
      'sessionContext',
      'rememberedTools',
      'reopen'
    ]) {
      expect(options).not.toHaveProperty(key)
    }
  })
})

describe('asideExchanges', () => {
  it('une question par message de l’utilisateur, réponses et outils à la suite', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Q1' },
      { kind: 'agent', id: 2, text: 'A' },
      { kind: 'agent', id: 3, text: 'B' },
      { kind: 'user', id: 4, text: 'Q2' }
    ]
    expect(asideExchanges(items, [0, 2])).toEqual([
      { question: 'Q1', answer: 'A\n\nB', refused: 0, tools: 0 },
      { question: 'Q2', answer: '', refused: 2, tools: 0 }
    ])
  })
})
