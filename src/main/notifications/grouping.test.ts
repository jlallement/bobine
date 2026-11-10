import { describe, expect, it } from 'vitest'
import type { AttentionNotice } from './grouping'
import { GROUP_WINDOW_MS, NoticeGroups, groupedNotice, type Schedule } from './grouping'

/** Horloge factice : les fins de fenêtre partent quand on avance le temps. */
function clock() {
  let now = 0
  const timers: { at: number; run: () => void; cancelled: boolean }[] = []
  const schedule: Schedule = (run, ms) => {
    const timer = { at: now + ms, run, cancelled: false }
    timers.push(timer)
    return () => (timer.cancelled = true)
  }
  const advance = (ms: number) => {
    now += ms
    for (const timer of timers.filter((t) => !t.cancelled && t.at <= now)) {
      timer.cancelled = true
      timer.run()
    }
  }
  return { schedule, advance }
}

const notice = (id: string, change: Partial<AttentionNotice> = {}): AttentionNotice => ({
  conversationId: id,
  kind: 'done',
  reason: 'done',
  conversationTitle: `Titre ${id}`,
  title: `Agent factice · Titre ${id}`,
  body: `Fin de ${id}`,
  ...change
})

describe('bannières groupées (fiche 119)', () => {
  const setup = () => {
    const { schedule, advance } = clock()
    const shown: AttentionNotice[] = []
    const groups = new NoticeGroups({ show: (n) => shown.push(n), schedule })
    /** Comme le suivi de l'attention : ouvre (son, rebond), puis met la bannière en attente. */
    const add = (n: AttentionNotice) => {
      const first = groups.open(n.kind)
      groups.push(n)
      return first
    }
    return { groups, shown, advance, add }
  }

  it('une seule conversation : la bannière d’aujourd’hui, inchangée, à la fin de la fenêtre', () => {
    const { shown, advance, add } = setup()
    expect(add(notice('a'))).toBe(true)
    advance(GROUP_WINDOW_MS - 1)
    expect(shown).toEqual([])
    advance(1)
    expect(shown).toEqual([notice('a')])
  })

  it('trois filles qui finissent ensemble : une bannière, un seul son ou rebond', () => {
    const { shown, advance, add } = setup()
    const firsts = ['a', 'b', 'c'].map((id) => add(notice(id, { child: true })))
    expect(firsts).toEqual([true, false, false])
    advance(GROUP_WINDOW_MS)
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({
      conversationId: 'a',
      conversationIds: ['a', 'b', 'c'],
      title: '3 conversations filles ont fini',
      body: 'Titre a, Titre b, Titre c'
    })
  })

  it('demandes et fins dans la même fenêtre : un groupe chacune', () => {
    const { shown, advance, add } = setup()
    expect(add(notice('a', { kind: 'request', reason: 'permission' }))).toBe(true)
    expect(add(notice('b'))).toBe(true)
    expect(add(notice('c', { kind: 'request', reason: 'permission' }))).toBe(false)
    expect(add(notice('d', { kind: 'error', reason: 'error' }))).toBe(false)
    advance(GROUP_WINDOW_MS)
    expect(shown.map((n) => [n.title, n.body])).toEqual([
      ['2 conversations attendent votre accord', 'Titre a, Titre c'],
      ['2 conversations ont fini', 'Titre b, Titre d (erreur)']
    ])
  })

  it('après la fenêtre, un nouveau groupe (et un nouveau son)', () => {
    const { shown, advance, add } = setup()
    add(notice('a'))
    advance(GROUP_WINDOW_MS)
    expect(add(notice('b'))).toBe(true)
    advance(GROUP_WINDOW_MS)
    expect(shown.map((n) => n.conversationId)).toEqual(['a', 'b'])
  })

  it('une conversation vue pendant la fenêtre sort du groupe ; deux demandes d’une même : une ligne', () => {
    const { groups, shown, advance, add } = setup()
    add(notice('a', { kind: 'request', reason: 'question' }))
    add(notice('a', { kind: 'request', reason: 'question', body: 'Deuxième question' }))
    add(notice('b', { kind: 'request', reason: 'permission' }))
    add(notice('c', { kind: 'request', reason: 'permission' }))
    groups.withdraw('c')
    advance(GROUP_WINDOW_MS)
    expect(shown[0]).toMatchObject({
      title: '2 conversations attendent votre réponse',
      conversationIds: ['a', 'b']
    })
  })

  it('tout vu avant la fin : aucune bannière ; arrêt de l’app : rien ne part', () => {
    const { groups, shown, advance, add } = setup()
    add(notice('a'))
    groups.withdraw('a')
    advance(GROUP_WINDOW_MS)
    add(notice('b'))
    groups.dispose()
    advance(GROUP_WINDOW_MS)
    expect(shown).toEqual([])
  })

  it('groupedNotice : seule, la bannière est rendue telle quelle', () => {
    expect(groupedNotice([notice('a')])).toEqual(notice('a'))
  })
})
