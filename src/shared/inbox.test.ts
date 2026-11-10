import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from './agent'
import type { AttentionDetail } from './attention'
import { heldInbox, inboxAgo, inboxCount, inboxEntries, inboxReason } from './inbox'

const conversation = (id: string, change: Partial<ConversationSummary> = {}) =>
  ({
    id,
    title: `Conversation ${id}`,
    profileId: 'mock',
    profileLabel: 'Agent factice',
    workspace: '/projet',
    updatedAt: '2026-10-22T10:00:00.000Z',
    status: 'ready',
    draft: false,
    ...change
  }) satisfies ConversationSummary

const MIN = 60_000

describe('inboxEntries (fiche 119)', () => {
  const a = conversation('a')
  const b = conversation('b')
  const c = conversation('c')
  const d = conversation('d')
  const e = conversation('e')

  it('ce qui bloque, puis les erreurs, puis ce qui est à lire ; le plus ancien d’abord', () => {
    const entries = inboxEntries(
      [a, b, c, d, e],
      { a: 'done', b: 'request', c: 'error', d: 'request', e: 'done' },
      {
        a: { reason: 'done', since: 5 * MIN },
        b: { reason: 'question', detail: 'OAuth ?', since: 9 * MIN },
        c: { reason: 'error', since: 1 * MIN },
        d: { reason: 'permission', detail: 'Écrire app.ts', since: 3 * MIN },
        e: { reason: 'done', since: 2 * MIN }
      }
    )
    expect(entries.map((entry) => entry.conversation.id)).toEqual(['d', 'b', 'c', 'e', 'a'])
    expect(entries[0]).toMatchObject({
      kind: 'request',
      reason: 'permission',
      detail: 'Écrire app.ts'
    })
  })

  it('ni les brouillons, ni les conversations qui n’attendent rien', () => {
    const draft = conversation('x', { draft: true })
    expect(inboxCount([a, b, draft], { a: 'done', x: 'request' })).toBe(1)
    expect(inboxEntries([a], {})).toEqual([])
  })

  it('sans détail (ou un détail qui ne correspond plus) : la raison générique', () => {
    const [entry] = inboxEntries([a], { a: 'request' }, { a: { reason: 'done', since: 1 } })
    expect(entry).toMatchObject({ reason: 'request', since: Date.parse(a.updatedAt) })
    expect(entry && inboxReason(entry)).toBe('Attend votre réponse')
  })

  it('les filles sont à plat, avec leur mère', () => {
    const child = conversation('f', { startedFrom: { id: 'a', title: 'Lots d’octobre' } })
    const entries = inboxEntries([a, child], { a: 'done', f: 'done' })
    expect(entries.map((entry) => entry.conversation.id).sort()).toEqual(['a', 'f'])
  })
})

describe('libellés', () => {
  const now = 100 * MIN
  const line = (change: Partial<ConversationSummary>, detail: AttentionDetail) => {
    const [entry] = inboxEntries(
      [conversation('a', change)],
      { a: detail.reason === 'done' || detail.reason === 'error' ? detail.reason : 'request' },
      { a: detail }
    )
    // Raison (seconde ligne) et temps écoulé (à droite du titre, fiche 125).
    return entry ? `${inboxReason(entry)} · ${inboxAgo(now - entry.since)}` : ''
  }

  it('raison, détail et temps écoulé', () => {
    expect(
      line(
        {},
        { reason: 'permission', detail: 'écrire src/main/app-windows.ts', since: now - 2 * MIN }
      )
    ).toBe('Autorisation\u00a0: écrire src/main/app-windows.ts · 2 min')
    expect(
      line(
        {},
        { reason: 'question', detail: 'OAuth\n ou mot de passe\u00a0?', since: now - 14 * MIN }
      )
    ).toBe('Question\u00a0: OAuth ou mot de passe\u00a0? · 14 min')
    expect(line({}, { reason: 'done', since: now - 5 * MIN })).toBe('Réponse à lire · 5 min')
    expect(line({}, { reason: 'error', since: now - MIN })).toBe('Erreur de l’agent · 1 min')
    expect(line({}, { reason: 'auth', since: now })).toBe('Connexion à faire · à l’instant')
    expect(line({}, { reason: 'permission', since: now })).toBe('Autorisation · à l’instant')
  })

  it('une fille : son compte rendu (sa mère est dans l’infobulle, fiche 125)', () => {
    expect(
      line(
        { startedFrom: { id: 'm', title: 'Lots d’octobre' } },
        { reason: 'done', since: now - 3 * MIN }
      )
    ).toBe('Compte rendu à lire · 3 min')
  })

  it('temps écoulé : minutes, heures, jours', () => {
    expect(inboxAgo(30_000)).toBe('à l’instant')
    expect(inboxAgo(59 * MIN)).toBe('59 min')
    expect(inboxAgo(3 * 60 * MIN)).toBe('3 h')
    expect(inboxAgo(50 * 60 * MIN)).toBe('2 j')
    expect(inboxAgo(-5)).toBe('à l’instant')
  })

  it('un détail très long est coupé', () => {
    const text = line({}, { reason: 'question', detail: 'x'.repeat(300), since: now })
    expect(text.length).toBeLessThan(160)
    expect(text).toContain('…')
  })
})

describe('heldInbox : section figée sous le pointeur (fiche 095)', () => {
  const a = conversation('a')
  const b = conversation('b')
  const c = conversation('c')
  const listed = (...items: ConversationSummary[]) => new Map(items.map((item) => [item.id, item]))

  it('mêmes lignes, même ordre ; une ligne traitée reste, une nouvelle attend sa place', () => {
    const before = inboxEntries([a, b], { a: 'request', b: 'done' })
    const after = inboxEntries([a, b, c], { b: 'request', c: 'request' })
    const held = heldInbox(after, before, listed(a, b, c))
    expect(held.map((entry) => `${entry.conversation.id}:${entry.kind}`)).toEqual([
      'a:request',
      'b:request'
    ])
  })

  it('une conversation supprimée disparaît ; renommée, son titre suit', () => {
    const before = inboxEntries([a, b], { a: 'request', b: 'done' })
    const renamed = { ...b, title: 'Nouveau titre' }
    const held = heldInbox([], before, listed(renamed))
    expect(held.map((entry) => entry.conversation.title)).toEqual(['Nouveau titre'])
  })

  it('rien ne la retient : la liste du moment', () => {
    const now = inboxEntries([a], { a: 'done' })
    expect(heldInbox(now, null, listed(a))).toEqual(now)
  })
})
