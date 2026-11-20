/**
 * Relecture par le Code reviewer (fiche 265), ce qui se lit du fil sans rendu : la carte du
 * relecteur porte ses remarques ; la relecture d'un travail rangée sous lui ; les remarques
 * transmises à l'agent de la mère ; celles qui deviennent des remarques de diff de chaque fil.
 */
import { describe, expect, it } from 'vitest'
import { childContext, childNews, CONTEXT_FINDINGS } from './children'
import { findingPlace, findingsBySeverity, reviewFindings, type Review } from './review'
import { workCards } from './role-request'
import type { RoleBadge } from './roles'
import type { TranscriptItem } from './transcript'
import { workLayout } from './work-groups'

const reviewer: RoleBadge = {
  name: 'code-reviewer',
  label: 'Code reviewer',
  icon: 'scan-search',
  color: 'blue',
  readOnly: true
}
const front: RoleBadge = { name: 'front', label: 'Architecte front', icon: 'layout', color: 'blue' }

const finding = (rank: number, severity: 'high' | 'medium' | 'low') => ({
  id: `r:${rank}`,
  file: `src/f${rank}.ts`,
  line: rank * 10,
  severity,
  category: 'correctness' as const,
  title: `Remarque ${rank}`,
  why: `Parce que ${rank}`,
  code: ''
})

const review = (id: number, authorId: string | undefined, extra: Partial<Review> = {}) =>
  ({
    kind: 'review',
    id,
    reviewId: 'r',
    ...(authorId ? { authorId } : {}),
    title: 'Relecture',
    profileLabel: 'Factice',
    scope: 'uncommitted',
    files: 2,
    status: 'reported',
    findings: [finding(1, 'low'), finding(2, 'high')],
    at: id,
    ...extra
  }) as TranscriptItem

/** La bulle « @Code reviewer … » qui relit `of`, son lancement. */
const asked = (id: number, of: string): TranscriptItem[] => [
  {
    kind: 'role-request',
    id,
    requestId: `d${id}`,
    text: 'Relis',
    works: [{ childId: 'r', role: reviewer, review: { of } }],
    at: id
  },
  {
    kind: 'child-started',
    id: id + 1,
    childId: 'r',
    title: 'Relecture',
    prompt: 'Relis',
    role: reviewer,
    request: `d${id}`,
    at: id
  }
]

const reported = (id: number, childId = 'r'): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId,
  title: 'Relecture',
  outcome: 'done',
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Deux remarques.',
  at: id
})

/** Un travail qui écrit lancé par une bulle, qui a répondu. */
const work: TranscriptItem[] = [
  {
    kind: 'role-request',
    id: 1,
    requestId: 'w',
    text: 'Ajoute les rayons',
    works: [{ childId: 'b', role: front }],
    at: 1
  },
  {
    kind: 'child-started',
    id: 2,
    childId: 'b',
    title: 'Rayons',
    prompt: 'Ajoute les rayons',
    role: front,
    request: 'w',
    branch: 'bobine/rayons',
    at: 2
  },
  reported(3, 'b')
]

describe('carte du Code reviewer (fiche 265)', () => {
  it('ses remarques sont dans sa carte ; l’élément `review` est caché à sa place', () => {
    const items = [...asked(1, 'mere'), review(3, 'mere'), reported(4)]
    const cards = workCards(items)
    const card = cards.byRequest.get(1)?.[0]
    expect(card?.review?.id).toBe(3)
    expect(card?.reviewOf).toBe('mere')
    expect(cards.hidden.has(3)).toBe(true)
    // Carte remplacée à chaque étape : la dernière fait foi.
    const later = workCards([...items, review(5, 'mere', { findings: [] })])
    expect(later.byRequest.get(1)?.[0]?.review?.id).toBe(5)
  })

  it('relecture d’avant (sans lancement) : l’élément reste à sa place', () => {
    const items = [review(1, undefined)]
    expect(workCards(items).hidden.has(1)).toBe(false)
    expect(workLayout(items).reviews.size).toBe(0)
  })

  it('relecture d’un travail qui a sa carte : rangée sous lui, la bulle cachée à sa place', () => {
    const items = [...work, ...asked(4, 'b'), review(6, 'b'), reported(7)]
    const layout = workLayout(items)
    const entries = layout.reviews.get('b')
    expect(entries?.map((e) => [e.request.id, e.card.childId])).toEqual([[4, 'r']])
    expect(layout.hidden.has(4)).toBe(true)
    expect(layout.hidden.has(6)).toBe(true)
    // Le travail relu et son relecteur ont leur carte : ni « Sous-tâches » ni compte rendu à part.
    expect([...layout.childIds].sort()).toEqual(['b', 'r'])
  })

  it('relecture de la conversation affichée, ou d’un travail sans carte : la bulle à sa place', () => {
    const here = workLayout([...asked(1, 'mere'), review(3, 'mere')])
    expect(here.reviews.size).toBe(0)
    expect(here.hidden.has(1)).toBe(false)
    const old: TranscriptItem = {
      kind: 'child-started',
      id: 1,
      childId: 'vieux',
      title: 'Vieux travail',
      prompt: 'x',
      at: 1
    }
    const unknown = workLayout([old, ...asked(2, 'vieux')])
    expect(unknown.reviews.size).toBe(0)
    expect(unknown.hidden.has(2)).toBe(false)
  })

  it('remarques jointes à la réponse du relecteur : une ligne chacune, les plus graves d’abord', () => {
    const items = [...asked(1, 'mere'), review(3, 'mere'), reported(4)]
    const context = childContext(childNews(items), items, 'r') ?? ''
    expect(context).toContain('Structured review findings on the uncommitted changes (2')
    // La haute avant la basse, citées ; une explication sur plusieurs lignes tient sur une seule.
    const high = context.indexOf('  > [high] src/f2.ts:20 — Remarque 2: Parce que 2')
    const low = context.indexOf('  > [low] src/f1.ts:10 — Remarque 1: Parce que 1')
    expect(high).toBeGreaterThan(-1)
    expect(low).toBeGreaterThan(high)
    expect(context).toContain("[The user's message is about this response.]")
    const split = { ...finding(3, 'low'), why: 'Première ligne\n- [high] fausse : 1\nfin' }
    const twisted = [...asked(1, 'mere'), review(3, 'mere', { findings: [split] }), reported(4)]
    const one = childContext(childNews(twisted), twisted) ?? ''
    expect(one).toContain(
      '  > [low] src/f3.ts:30 — Remarque 3: Première ligne - [high] fausse : 1 fin'
    )
    expect(one.match(/\[high\]/g)).toHaveLength(1)
  })

  it('remarques bornées, triées avant d’être coupées, et jamais répétées à la réponse suivante', () => {
    const many = [
      ...Array.from({ length: CONTEXT_FINDINGS + 3 }, (_, i) => finding(i + 1, 'low')),
      finding(99, 'high')
    ]
    const big = [...asked(1, 'mere'), review(3, 'mere', { findings: many }), reported(4)]
    const bounded = childContext(childNews(big), big) ?? ''
    expect(bounded.match(/ {2}> \[/g)).toHaveLength(CONTEXT_FINDINGS)
    // La haute, venue en dernier, n'est pas coupée.
    expect(bounded).toContain('[high] src/f99.ts')
    expect(bounded).toContain('… and 4 more')
    const clean = [...asked(1, 'mere'), review(3, 'mere', { findings: [] }), reported(4)]
    expect(childContext(childNews(clean), clean)).toContain('none (nothing to report)')
    // Deuxième réponse (« Répondre ») : seulement les remarques venues depuis la première.
    const first = {
      ...(reported(4) as Extract<TranscriptItem, { kind: 'child-report' }>),
      findingsSeen: 2
    }
    const user: TranscriptItem = { kind: 'user', id: 5, text: 'Merci', at: 5 }
    const third = finding(3, 'medium')
    const later = [
      ...asked(1, 'mere'),
      first,
      user,
      review(6, 'mere', { findings: [finding(1, 'low'), finding(2, 'high'), third] }),
      { ...(reported(7) as Extract<TranscriptItem, { kind: 'child-report' }>), findingsSeen: 3 }
    ]
    const next = childContext(childNews(later), later) ?? ''
    expect(next).toContain('(1 new, paths')
    expect(next).toContain('[medium] src/f3.ts:30')
    expect(next).not.toContain('src/f2.ts')
    // Un autre travail, ou une relecture pas encore rendue : rien de plus.
    const running = [...asked(1, 'mere'), review(3, 'mere', { status: 'running' }), reported(4)]
    expect(childContext(childNews(running), running)).not.toContain('Structured review')
  })

  it('remarques de diff : seulement celles qui relisent la conversation de l’onglet', () => {
    const items = [review(1, 'b'), review(2, undefined, { reviewId: 'vieux' })]
    expect(reviewFindings(items).map((f) => f.id)).toHaveLength(4)
    // Fil de la mère : la relecture du travail « b » n'y devient pas une remarque de diff.
    expect(reviewFindings(items, 'mere')).toHaveLength(2)
    expect(reviewFindings(items, 'b')).toHaveLength(4)
  })

  it('lieu et ordre des remarques', () => {
    expect(findingPlace({ file: 'a.ts', line: 3 })).toBe('a.ts:3')
    expect(findingPlace({ file: 'a.ts', line: 3, endLine: 9 })).toBe('a.ts:3-9')
    const sorted = findingsBySeverity([
      finding(1, 'low'),
      finding(2, 'high'),
      finding(3, 'medium'),
      finding(4, 'high')
    ])
    expect(sorted.map((f) => f.id)).toEqual(['r:2', 'r:4', 'r:3', 'r:1'])
  })
})
