import { describe, expect, it } from 'vitest'
import type { AgentEvent, ConversationSummary, ConversationView } from '@shared/agent'
import type { ChildReport } from '@shared/children'
import type { TranscriptItem } from '@shared/transcript'
import { ChildWake } from './children-wake'

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

const summary = (
  id: string,
  status: ConversationSummary['status'],
  motherId?: string
): ConversationSummary => ({
  id,
  title: id,
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: `/depot/${id}`,
  updatedAt: '2026-10-21T00:00:00Z',
  status,
  draft: false,
  ...(motherId ? { startedFrom: { id: motherId, title: motherId } } : {})
})

const report = (childId: string, id: number): TranscriptItem =>
  ({
    kind: 'child-report',
    id,
    childId,
    title: childId,
    outcome: 'done',
    files: [],
    fileCount: 0,
    added: 0,
    removed: 0,
    excerpt: 'Fini.',
    at: id
  }) satisfies ChildReport & { kind: 'child-report'; id: number }

/** Une mère `m` et ses filles `a` et `b`, dont on règle le statut et la file. */
function setup() {
  const conversations = new Map<string, ConversationSummary>([
    ['m', summary('m', 'busy')],
    ['a', summary('a', 'busy', 'm')],
    ['b', summary('b', 'busy', 'm')]
  ])
  const queued = new Map<string, number>()
  const motherItems: TranscriptItem[] = [{ kind: 'user', id: 1, text: 'Découpe' }]
  const woken: string[] = []
  const wake = new ChildWake({
    state: () => ({ conversations: [...conversations.values()], activeId: 'm' }),
    view: (id) =>
      ({
        snapshot: {
          queued: Array.from({ length: queued.get(id) ?? 0 }, (_, i) => ({
            id: `q${i}`,
            text: 'x',
            attachments: []
          }))
        },
        transcript: { items: id === 'm' ? motherItems : [] }
      }) as unknown as Pick<ConversationView, 'snapshot' | 'transcript'>,
    attention: () => ({}),
    wake: (id) => woken.push(id)
  })
  const set = (id: string, status: ConversationSummary['status']) => {
    const current = conversations.get(id)
    if (current) conversations.set(id, { ...current, status })
  }
  const event = (id: string, e: AgentEvent) =>
    wake.onEvent({ conversationId: id, event: e, seq: 0 })
  /** Fin de tour d'une fille : statut prêt, compte rendu chez la mère. */
  const finish = (id: string) => {
    set(id, 'ready')
    motherItems.push(report(id, motherItems.length + 1))
    event(id, { type: 'turn-end', stopReason: 'end_turn' })
  }
  const motherIdle = () => {
    set('m', 'ready')
    event('m', { type: 'status', snapshot: { status: 'ready' } as never })
  }
  return { wake, conversations, queued, motherItems, woken, set, event, finish, motherIdle }
}

describe('réveil groupé de la mère (fiche 097, étape 2)', () => {
  it('une seule fois, quand toutes les filles attendues ont fini et la mère est au repos', async () => {
    const t = setup()
    t.wake.await('m', 'a')
    t.wake.await('m', 'b')
    expect(t.wake.holds('m')).toBe(true)
    t.finish('a')
    await tick()
    expect(t.woken).toEqual([])
    // Toutes finies, mais la mère travaille encore.
    t.finish('b')
    await tick()
    expect(t.woken).toEqual([])
    t.motherIdle()
    await tick()
    expect(t.woken).toEqual(['m'])
    expect(t.wake.holds('m')).toBe(false)
    t.motherIdle()
    await tick()
    expect(t.woken).toEqual(['m'])
  })

  it('une fille qui a encore un message en file n’a pas fini', async () => {
    const t = setup()
    t.set('m', 'ready')
    t.wake.await('m', 'a')
    t.queued.set('a', 1)
    t.finish('a')
    await tick()
    expect(t.woken).toEqual([])
    // Son tour suivant (le message de la mère) se termine : réveil.
    t.queued.set('a', 0)
    t.set('a', 'busy')
    t.event('a', { type: 'user-message', text: 'De la mère' })
    t.finish('a')
    await tick()
    expect(t.woken).toEqual(['m'])
  })

  it('mère pas au repos : file d’attente, ou demande en cours', async () => {
    const t = setup()
    t.wake.await('m', 'a')
    t.queued.set('m', 1)
    t.finish('a')
    t.motherIdle()
    await tick()
    expect(t.woken).toEqual([])
    t.queued.set('m', 0)
    t.motherIdle()
    await tick()
    expect(t.woken).toEqual(['m'])
  })

  it('un message de la mère emporte les comptes rendus : pas de réveil pour eux', async () => {
    const t = setup()
    t.wake.await('m', 'a')
    t.wake.await('m', 'b')
    t.finish('a')
    // L'utilisateur écrit à la mère : le compte rendu de `a` part avec lui.
    t.motherItems.push({ kind: 'user', id: 99, text: 'Et alors ?' })
    t.event('m', { type: 'user-message', text: 'Et alors ?' })
    t.motherIdle()
    await tick()
    expect(t.woken).toEqual([])
    t.finish('b')
    await tick()
    expect(t.woken).toEqual(['m'])
  })

  it('rien de neuf (déjà transmis) : pas de réveil, et la mère n’attend plus', async () => {
    const t = setup()
    t.set('m', 'ready')
    t.wake.await('m', 'a')
    t.set('a', 'ready')
    t.event('a', { type: 'turn-end', stopReason: 'end_turn' })
    await tick()
    expect(t.woken).toEqual([])
    expect(t.wake.holds('m')).toBe(false)
  })

  it('fille supprimée, archivée ou sans tour : elle ne bloque pas le réveil', async () => {
    const t = setup()
    t.set('m', 'ready')
    t.wake.await('m', 'a')
    t.wake.await('m', 'b')
    t.finish('a')
    t.conversations.delete('b')
    t.wake.forget('b')
    await tick()
    expect(t.woken).toEqual(['m'])

    const u = setup()
    u.set('m', 'ready')
    u.wake.await('m', 'a')
    u.wake.await('m', 'b')
    u.finish('a')
    u.conversations.set('b', { ...summary('b', 'stopped', 'm'), archived: true })
    u.wake.listChanged()
    await tick()
    expect(u.woken).toEqual(['m'])

    const v = setup()
    v.set('m', 'ready')
    v.wake.await('m', 'a')
    // Son agent n'a pas démarré : compte rendu en erreur posé par `launch`.
    v.set('a', 'error')
    v.motherItems.push(report('a', 50))
    v.wake.finished('a')
    await tick()
    expect(v.woken).toEqual(['m'])
  })

  it('fille qui finit pendant que la mère traite son message : pas de second bilan', async () => {
    const t = setup()
    t.wake.await('m', 'a')
    t.wake.await('m', 'b')
    t.finish('b')
    // `a` écrit à la mère (au repos) : la mère traite son message, `b` part avec lui.
    t.motherItems.push({ kind: 'user', id: 90, text: 'Fini.' })
    t.event('m', {
      type: 'user-message',
      text: 'Fini.',
      from: { kind: 'child', id: 'a', title: 'a' }
    })
    // `a` finit pendant ce tour de la mère.
    t.finish('a')
    t.motherIdle()
    await tick()
    expect(t.woken).toEqual([])
    expect(t.wake.holds('m')).toBe(false)

    // Une autre fille finit pendant ce tour : son compte rendu, lui, réveille la mère.
    const u = setup()
    u.wake.await('m', 'a')
    u.wake.await('m', 'b')
    u.motherItems.push({ kind: 'user', id: 90, text: 'Fini.' })
    u.event('m', {
      type: 'user-message',
      text: 'Fini.',
      from: { kind: 'child', id: 'a', title: 'a' }
    })
    u.finish('a')
    u.finish('b')
    u.motherIdle()
    await tick()
    expect(u.woken).toEqual(['m'])
  })

  it('mère supprimée ou archivée : oubliée', async () => {
    const t = setup()
    t.wake.await('m', 'a')
    t.wake.forget('m')
    expect(t.wake.holds('m')).toBe(false)
    const u = setup()
    u.wake.await('m', 'a')
    u.conversations.set('m', { ...summary('m', 'stopped'), archived: true })
    u.finish('a')
    await tick()
    expect(u.woken).toEqual([])
    expect(u.wake.holds('m')).toBe(false)
  })
})
