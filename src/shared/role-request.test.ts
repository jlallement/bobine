/**
 * Bulle « @Rôle … » et cartes-réponses (fiche 263) : réducteur, lecture du fil, et ce que la bulle
 * ne change pas (tours, nouvelles des filles, rejeu d'une session, anciennes conversations).
 */
import { describe, expect, it } from 'vitest'
import { parsePromptRequest, type AgentEvent } from './agent'
import {
  ABOUT_LINE,
  childContext,
  childNews,
  keptReply,
  REPLY_KEEP_CHARS,
  type ChildReport
} from './children'
import { replayTail } from './replay-tail'
import { workCards, type RoleRequest } from './role-request'
import type { RoleBadge } from './roles'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from './transcript'

const ux: RoleBadge = { name: 'ux', label: 'Expert UX/UI', icon: 'palette', color: 'pink' }
const sec: RoleBadge = { name: 'sec', label: 'Expert sécu', icon: 'shield', color: 'orange' }

const ask = (extra: Partial<RoleRequest> = {}): RoleRequest => ({
  requestId: 'd1',
  text: 'Propose une direction.',
  works: [{ childId: 'f1', role: ux }],
  at: 1000,
  ...extra
})

const report = (childId: string, extra: Partial<ChildReport> = {}): ChildReport => ({
  childId,
  title: 'Avis',
  outcome: 'done',
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Direction',
  at: 2000,
  ...extra
})

const started = (childId: string, request?: string): AgentEvent => ({
  type: 'child-started',
  child: {
    childId,
    title: 'Avis',
    prompt: 'Propose une direction.',
    role: ux,
    ...(request ? { request } : {}),
    at: 1000
  }
})

function fold(events: AgentEvent[]) {
  return events.reduce(reduceTranscript, emptyTranscript)
}

describe('bulle « @Rôle … » dans le fil (fiche 263)', () => {
  it('posée une fois, puis complétée à sa place quand un autre rôle part (même `requestId`)', () => {
    const state = fold([
      { type: 'user-message', text: 'Bonjour', at: 1 },
      { type: 'role-request', request: ask() },
      started('f1', 'd1'),
      {
        type: 'role-request',
        request: ask({
          works: [
            { childId: 'f1', role: ux },
            { childId: 'f2', role: sec }
          ]
        })
      },
      started('f2', 'd1')
    ])
    const kinds = state.items.map((i) => i.kind)
    expect(kinds).toEqual(['user', 'role-request', 'child-started', 'child-started'])
    const bubble = state.items[1]
    expect(bubble?.kind === 'role-request' && bubble.works.map((w) => w.childId)).toEqual([
      'f1',
      'f2'
    ])
    expect(bubble?.id).toBe(2)
  })

  it('n’est pas un message : les nouvelles des filles d’après le dernier message restent à transmettre', () => {
    const state = fold([
      { type: 'user-message', text: 'Bonjour', at: 1 },
      { type: 'role-request', request: ask() },
      started('f1', 'd1'),
      { type: 'child-report', report: report('f1') },
      // « Répondre à … » : bulle de suite ; la réponse d'avant n'est pas transmise pour autant.
      {
        type: 'role-request',
        request: ask({ requestId: 'd2', text: 'Et le contraste ?', followUp: true })
      },
      { type: 'child-report', report: report('f1', { at: 3000 }) }
    ])
    expect(childNews(state.items).map((i) => i.kind)).toEqual([
      'child-started',
      'child-report',
      'child-report'
    ])
  })

  it('ne compte pas pour le rejeu d’une session : aucun tour pris pour venu d’ailleurs', () => {
    const stored = fold([
      { type: 'user-message', text: 'Bonjour', at: 1 },
      { type: 'role-request', request: ask() },
      started('f1', 'd1')
    ]).items
    const replayed: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Bonjour' },
      { kind: 'agent', id: 2, text: 'Salut' }
    ]
    expect(replayTail(stored, replayed)).toEqual([])
  })
})

describe('cartes-réponses (fiche 263)', () => {
  it('une carte par travail sous sa bulle ; lancement, réponses et suites cachés à leur place', () => {
    const state = fold([
      { type: 'user-message', text: 'Bonjour', at: 1 },
      {
        type: 'role-request',
        request: ask({
          works: [
            { childId: 'f1', role: ux },
            { childId: 'f2', role: sec }
          ]
        })
      },
      started('f1', 'd1'),
      started('f2', 'd1'),
      { type: 'child-report', report: report('f2') },
      { type: 'child-report', report: report('f1') },
      {
        type: 'role-request',
        request: {
          requestId: 'd2',
          text: 'Et le contraste ?',
          works: [{ childId: 'f1', role: ux }],
          followUp: true,
          at: 4000
        }
      },
      { type: 'child-report', report: report('f1', { at: 5000 }) }
    ])
    const ids = (kind: TranscriptItem['kind']) =>
      state.items.filter((i) => i.kind === kind).map((i) => i.id)
    const cards = workCards(state.items)
    const bubble = ids('role-request')[0] ?? -1
    const [first, second] = cards.byRequest.get(bubble) ?? []
    expect(first?.childId).toBe('f1')
    expect(second?.childId).toBe('f2')
    // Ancre du repère : le lancement de chaque travail, unique.
    expect([first?.anchor, second?.anchor]).toEqual(ids('child-started'))
    expect(first?.steps.map((s) => s.kind)).toEqual(['report', 'ask', 'report'])
    expect(second?.steps.map((s) => s.kind)).toEqual(['report'])
    expect([...cards.childIds].sort()).toEqual(['f1', 'f2'])
    // Seule la bulle d'ouverture reste à sa place (avec le message de l'utilisateur).
    const shown = state.items.filter((i) => !cards.hidden.has(i.id)).map((i) => i.kind)
    expect(shown).toEqual(['user', 'role-request'])
  })

  it('ancienne conversation (sans bulle) : rien ne change, tout s’affiche comme avant', () => {
    const state = fold([
      started('f1'),
      { type: 'child-report', report: report('f1') },
      { type: 'child-started', child: { childId: 'f2', title: 'B', prompt: 'b', at: 1 } }
    ])
    const cards = workCards(state.items)
    expect(cards.hidden.size).toBe(0)
    expect(cards.childIds.size).toBe(0)
    expect(cards.byRequest.size).toBe(0)
  })

  it('lancement qui nomme une bulle absente (fil abîmé) : affiché comme avant', () => {
    const state = fold([
      { type: 'role-request', request: ask({ requestId: 'autre', works: [] }) },
      started('f1', 'd1'),
      { type: 'child-report', report: report('f1') }
    ])
    const cards = workCards(state.items)
    expect(cards.childIds.has('f1')).toBe(false)
    expect(state.items.filter((i) => cards.hidden.has(i.id))).toEqual([])
  })

  it('travail lancé par l’agent à côté d’une bulle : il garde sa ligne et son compte rendu', () => {
    const state = fold([
      { type: 'role-request', request: ask() },
      started('f1', 'd1'),
      {
        type: 'child-started',
        child: { childId: 'f9', title: 'Agent', prompt: 'p', by: 'agent', at: 1 }
      },
      { type: 'child-report', report: report('f9') }
    ])
    const cards = workCards(state.items)
    expect([...cards.childIds]).toEqual(['f1'])
    const shown = state.items.filter((i) => !cards.hidden.has(i.id)).map((i) => i.kind)
    expect(shown).toEqual(['role-request', 'child-started', 'child-report'])
  })
})

describe('réponse entière gardée pour la carte (fiche 263)', () => {
  const agent = (text: string): TranscriptItem[] => [
    { kind: 'user', id: 1, text: 'q' },
    { kind: 'agent', id: 2, text }
  ]
  it('entière jusqu’à la limite', () => {
    expect(keptReply(agent('  Direction calme.  '))).toEqual({ reply: 'Direction calme.' })
    expect(keptReply(agent('   '))).toEqual({})
  })
  it('au-delà : coupée, marquée, avec sa taille entière', () => {
    const long = 'mot '.repeat(REPLY_KEEP_CHARS)
    const kept = keptReply(agent(long))
    expect(kept.replyCut).toBe(true)
    expect(kept.replyChars).toBe(long.trim().length)
    expect(kept.reply?.length).toBeLessThanOrEqual(REPLY_KEEP_CHARS)
    expect(kept.reply?.endsWith('…')).toBe(true)
  })
})

describe('fil abîmé et agent de la mère (revue QA, fiche 263)', () => {
  it('bulle sans `works` : le fil ne tombe pas ; `requestId` répété : la première bulle seule', () => {
    const broken = {
      kind: 'role-request',
      id: 1,
      requestId: 'd1',
      text: 'x',
      at: 1
    } as unknown as TranscriptItem
    expect(() => workCards([broken])).not.toThrow()
    const state = fold([{ type: 'role-request', request: ask() }, started('f1', 'd1')])
    const twice: TranscriptItem = { ...(state.items[0] as TranscriptItem), id: 9 }
    const cards = workCards([...state.items, twice])
    expect(cards.byRequest.get(1)?.map((c) => c.childId)).toEqual(['f1'])
    expect(cards.hidden.has(9)).toBe(true)
    expect(cards.byRequest.has(9)).toBe(false)
  })

  it('chaque travail a une ancre unique (son lancement) ; sans lancement, aucune', () => {
    const state = fold([
      {
        type: 'role-request',
        request: ask({
          works: [
            { childId: 'f1', role: ux },
            { childId: 'f2', role: sec }
          ]
        })
      },
      started('f1', 'd1')
    ])
    const [first, second] = workCards(state.items).byRequest.get(1) ?? []
    expect(first?.anchor).toBe(2)
    expect(second?.anchor).toBeUndefined()
  })

  it('l’agent de la mère sait quel rôle a fait chaque travail (lancement et réponse)', () => {
    const items = fold([
      { type: 'user-message', text: 'Bonjour', at: 1 },
      { type: 'role-request', request: ask() },
      started('f1', 'd1'),
      { type: 'child-report', report: report('f1') }
    ]).items
    const context = childContext(childNews(items), items) ?? ''
    expect(context).toContain('the child conversation "Avis" (id: f1, role: Expert UX/UI)')
    expect(context).toContain('The child conversation "Avis" (id: f1, role: Expert UX/UI)')
  })
})

describe('« Appliquer » : le travail visé, dans le contexte joint seulement (fiche 263)', () => {
  it('deux travaux du même rôle en attente : seule la réponse visée est marquée', () => {
    const items = fold([
      { type: 'user-message', text: 'Bonjour', at: 1 },
      {
        type: 'role-request',
        request: ask({
          works: [
            { childId: 'f1', role: ux },
            { childId: 'f2', role: ux }
          ]
        })
      },
      started('f1', 'd1'),
      started('f2', 'd1'),
      { type: 'child-report', report: report('f1') },
      { type: 'child-report', report: report('f2') }
    ]).items
    const context = childContext(childNews(items), items, 'f2') ?? ''
    expect(context.split(ABOUT_LINE)).toHaveLength(2)
    const marked = context.indexOf(ABOUT_LINE)
    // La marque suit la réponse de f2, pas celle de f1.
    expect(context.lastIndexOf('(id: f2', marked)).toBeGreaterThan(
      context.lastIndexOf('(id: f1', marked)
    )
    expect(childContext(childNews(items), items) ?? '').not.toContain(ABOUT_LINE)
  })

  it('l’option du renderer est vérifiée : un id seulement', () => {
    expect(parsePromptRequest({ about: 'f-1_2' })).toEqual({ about: 'f-1_2' })
    expect(parsePromptRequest({ about: 'a b' })).toEqual({})
    expect(parsePromptRequest({ about: 42 })).toEqual({})
    expect(parsePromptRequest({ askChildren: true, about: 'x'.repeat(101) })).toEqual({
      askChildren: true
    })
  })
})
