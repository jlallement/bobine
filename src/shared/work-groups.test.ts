/**
 * Cartes de groupe (fiche 264) : où le fil range chaque travail confié, lu du fil seul ; anciennes
 * conversations comme avant ; fil abîmé.
 */
import { describe, expect, it } from 'vitest'
import { childProposalSchema } from './children'
import type { ChildrenMerge } from './children-merge'
import type { RoleBadge } from './roles'
import type { TranscriptItem } from './transcript'
import { groupWorkIds, lastMergeFor, workLayout } from './work-groups'

const ux: RoleBadge = {
  name: 'ux',
  label: 'Expert UX/UI',
  icon: 'palette',
  color: 'pink',
  readOnly: true
}
const front: RoleBadge = { name: 'front', label: 'Architecte front', icon: 'layout', color: 'blue' }

const proposal = (id: number, title: string, key?: string, state = 'pending'): TranscriptItem =>
  ({
    kind: 'elicitation',
    id,
    requestId: `r${id}`,
    state,
    prompt: {
      mode: 'form',
      message: title,
      schema: childProposalSchema(),
      toolCallId: `t${id}`,
      child: { title, prompt: `Fais ${title}`, ...(key ? { key } : {}) }
    }
  }) as TranscriptItem

const started = (
  id: number,
  childId: string,
  extra: Partial<Extract<TranscriptItem, { kind: 'child-started' }>> = {}
): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Travail ${childId}`,
  prompt: `Consigne ${childId}`,
  at: id,
  ...extra
})

const report = (id: number, childId: string): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId,
  title: `Travail ${childId}`,
  outcome: 'done',
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Fait.',
  at: id
})

const merge = (id: number, runId: string, childIds: string[]): TranscriptItem => {
  const value: ChildrenMerge = {
    runId,
    base: 'main',
    cleanup: false,
    status: 'done',
    rows: childIds.map((childId) => ({ childId, title: childId, state: 'merged' })),
    startedAt: id
  }
  return { kind: 'children-merge', id, ...value }
}

describe('workLayout (fiche 264)', () => {
  it('propositions d’un tour : une carte à la place de la première, chaque travail sur sa ligne', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      proposal(2, 'API', 'k-api', 'accept'),
      proposal(3, 'Page', 'k-page', 'accept'),
      proposal(4, 'Doc', 'k-doc', 'decline'),
      started(5, 'a', { by: 'agent', card: 'k-api' }),
      started(6, 'b', { by: 'agent', card: 'k-page', role: front }),
      {
        kind: 'child-instruction',
        id: 7,
        childId: 'a',
        title: 'API',
        prompt: 'Ajoute un test',
        at: 7
      },
      report(8, 'a'),
      report(9, 'b'),
      {
        kind: 'child-recommendation',
        id: 10,
        childId: 'a',
        title: 'API',
        ready: true,
        note: 'ok',
        at: 10
      },
      { kind: 'user', id: 11, text: 'Merci', from: { kind: 'wake' } }
    ]
    const layout = workLayout(items)
    expect([...layout.groups.keys()]).toEqual([2])
    const group = layout.groups.get(2)
    expect(group?.rows.map((r) => [r.key, r.work?.childId])).toEqual([
      ['r2', 'a'],
      ['r3', 'b'],
      ['r4', undefined]
    ])
    expect(group && groupWorkIds(group)).toEqual(['a', 'b'])
    // Lancements, consigne, comptes rendus, recommandation, propositions suivantes : dans la carte.
    expect([...layout.hidden].sort((x, y) => x - y)).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
    expect([...layout.toolCallIds]).toEqual(['t2', 't3', 't4'])
    expect([...layout.childIds]).toEqual(['a', 'b'])
    expect(layout.solos.size).toBe(0)
    const api = group?.rows[0]?.work
    expect(api).toMatchObject({ byAgent: true, card: 'k-api', title: 'Travail a', anchor: 5 })
    expect(api?.role).toBeUndefined()
    // Le message de l'agent au travail (`message_child`) : une étape de sa carte, avant sa réponse.
    expect(api?.steps.map((s) => s.kind)).toEqual(['note', 'report'])
    expect(group?.rows[1]?.work?.role).toEqual(front)
  })

  it('bulle à plusieurs rôles : la même carte de groupe, sans propositions ; à un rôle, sa carte', () => {
    const items: TranscriptItem[] = [
      {
        kind: 'role-request',
        id: 1,
        requestId: 'd1',
        text: 'Regardez',
        works: [
          { childId: 'a', role: ux },
          { childId: 'b', role: front }
        ],
        at: 1
      },
      started(2, 'a', { role: ux, request: 'd1' }),
      started(3, 'b', { role: front, request: 'd1' }),
      {
        kind: 'role-request',
        id: 4,
        requestId: 'd4',
        text: 'Seul',
        works: [{ childId: 'c', role: ux }],
        at: 4
      },
      started(5, 'c', { role: ux, request: 'd4' })
    ]
    const layout = workLayout(items)
    expect([...layout.groups.keys()]).toEqual([1])
    const group = layout.groups.get(1)
    expect(group?.request?.id).toBe(1)
    expect(group?.rows.map((r) => [r.key, r.work?.childId, !!r.proposal])).toEqual([
      ['a', 'a', false],
      ['b', 'b', false]
    ])
    // La bulle à un rôle garde sa carte-réponse (fiche 263).
    expect(layout.cards.byRequest.get(4)?.map((c) => c.childId)).toEqual(['c'])
    expect(layout.groups.has(4)).toBe(false)
  })

  it('« Lancer en parallèle… » : une carte seule, à la place de son lancement', () => {
    const items = [started(1, 'a', { card: 'k-seul' }), report(2, 'a')]
    const layout = workLayout(items)
    expect(layout.solos.get(1)?.childId).toBe('a')
    // Le lancement reste à sa place (la carte s'y affiche), le compte rendu va dedans.
    expect(layout.hidden.has(1)).toBe(false)
    expect(layout.hidden.has(2)).toBe(true)
    expect([...layout.childIds]).toEqual(['a'])
  })

  it('ancienne conversation : ni clé ni bulle, rien ne bouge (« Sous-tâches », comptes rendus)', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      proposal(2, 'API', undefined, 'accept'),
      started(3, 'a', { by: 'agent' }),
      report(4, 'a'),
      { kind: 'child-instruction', id: 5, childId: 'a', title: 'API', prompt: 'Encore', at: 5 },
      {
        kind: 'child-recommendation',
        id: 6,
        childId: 'a',
        title: 'API',
        ready: true,
        note: 'ok',
        at: 6
      },
      started(7, 'b'),
      merge(8, 'run1', ['a', 'b'])
    ]
    const layout = workLayout(items)
    // La carte des propositions garde sa ligne (« Lancé »), sans travail dedans.
    expect(layout.groups.get(2)?.rows.map((r) => r.work)).toEqual([undefined])
    expect(layout.childIds.size).toBe(0)
    expect(layout.solos.size).toBe(0)
    expect([...layout.hidden]).toEqual([])
  })

  it('fil abîmé : deux lancements de la même clé, le premier seulement ; clé vide ignorée', () => {
    const items = [
      proposal(1, 'API', 'k', 'accept'),
      started(2, 'a', { card: 'k' }),
      started(3, 'b', { card: 'k' }),
      started(4, 'c', { card: '' })
    ]
    const layout = workLayout(items)
    expect(layout.groups.get(1)?.rows[0]?.work?.childId).toBe('a')
    expect([...layout.childIds]).toEqual(['a'])
    expect(layout.hidden.has(3)).toBe(false)
    expect(layout.hidden.has(4)).toBe(false)
  })
})

describe('workLayout : revues (fiche 264)', () => {
  it('clé de proposition en double (fil abîmé) : une seule ligne porte le travail', () => {
    const items = [
      proposal(1, 'API', 'k', 'accept'),
      proposal(2, 'API bis', 'k', 'accept'),
      started(3, 'a', { card: 'k' })
    ]
    expect(
      workLayout(items)
        .groups.get(1)
        ?.rows.map((r) => r.work?.childId)
    ).toEqual(['a', undefined])
  })

  it('un message de l’agent ouvre un échange : la réponse d’un tour commencé avant se range avant lui', () => {
    const items: TranscriptItem[] = [
      proposal(1, 'API', 'k', 'accept'),
      started(2, 'a', { card: 'k' }),
      { kind: 'child-instruction', id: 3, childId: 'a', title: 'API', prompt: 'Encore', at: 30 },
      { ...report(4, 'a'), askedAt: 10 } as TranscriptItem
    ]
    const work = workLayout(items).groups.get(1)?.rows[0]?.work
    expect(work?.steps.map((s) => s.kind)).toEqual(['report', 'note'])
  })

  it('recommandations et dernière fusion de chaque travail, lues une fois', () => {
    const items: TranscriptItem[] = [
      merge(1, 'r1', ['a']),
      merge(2, 'r2', ['b']),
      {
        kind: 'child-recommendation',
        id: 3,
        childId: 'a',
        title: 'A',
        ready: true,
        note: 'ok',
        at: 3
      }
    ]
    const layout = workLayout(items)
    expect(layout.merges.get('a')?.runId).toBe('r1')
    expect(layout.merges.get('b')?.runId).toBe('r2')
    expect(layout.verdicts.get('a')).toMatchObject({ ready: true, note: 'ok', stale: false })
  })
})

describe('ordre des lignes (fiche 264, revue UX)', () => {
  it('les travaux lancés dans l’ordre de leur lancement, les autres lignes à leur place', () => {
    const items = [
      proposal(1, 'A', 'ka', 'accept'),
      proposal(2, 'B', 'kb', 'decline'),
      proposal(3, 'C', 'kc', 'accept'),
      started(4, 'c', { card: 'kc' }),
      started(5, 'a', { card: 'ka' })
    ]
    const group = workLayout(items).groups.get(1)
    expect(group?.rows.map((r) => r.work?.childId ?? r.key)).toEqual(['c', 'r2', 'a'])
    expect(group && groupWorkIds(group)).toEqual(['c', 'a'])
  })
})

describe('lastMergeFor (fiche 264)', () => {
  const items = [merge(1, 'r1', ['a']), merge(2, 'r2', ['b', 'c']), merge(3, 'r3', ['x'])]

  it('la dernière fusion qui touche ces travaux, pas celle d’une autre carte', () => {
    expect(lastMergeFor(items, ['a'])?.runId).toBe('r1')
    expect(lastMergeFor(items, ['c', 'a'])?.runId).toBe('r2')
    expect(lastMergeFor(items, ['z'])).toBeUndefined()
  })

  it('sans liste : la dernière du fil, comme « Sous-tâches » (fiche 120)', () => {
    expect(lastMergeFor(items)?.runId).toBe('r3')
  })
})

describe('tour de table (fiche 285)', () => {
  const seats = (['A', 'B', 'C'] as const).map((letter) => ({
    profileId: 'agent-a',
    label: `Modèle ${letter}`,
    agentLabel: 'Agent A',
    letter,
    childId: `p${letter}`,
    state: 'working' as const
  }))
  const rt: TranscriptItem = {
    kind: 'roundtable',
    id: 1,
    roundtableId: 'rt1',
    question: 'Quelle file ?',
    synthesizer: { profileId: 'agent-a', label: 'Agent A' },
    seats,
    phase: 'collecting',
    at: 0
  }
  const launch = (id: number, childId: string): TranscriptItem => ({
    kind: 'child-started',
    id,
    childId,
    title: childId,
    prompt: 'consigne',
    card: 'rt1',
    at: 0
  })
  const answer = (id: number, childId: string): TranscriptItem => ({
    kind: 'child-report',
    id,
    childId,
    title: childId,
    outcome: 'done',
    files: [],
    fileCount: 0,
    added: 0,
    removed: 0,
    excerpt: 'avis',
    reply: `avis de ${childId}`,
    at: 1
  })

  it('chaque participant dans la carte du tour, même avec la clé de carte partagée', () => {
    const items = [
      rt,
      launch(2, 'pA'),
      launch(3, 'pB'),
      launch(4, 'pC'),
      answer(5, 'pB'),
      answer(6, 'pA'),
      { kind: 'child-started', id: 7, childId: 'other', title: 'autre', prompt: 'x', at: 0 }
    ] as TranscriptItem[]
    const layout = workLayout(items)
    const group = layout.roundtables.get(1)
    expect([...(group?.works.keys() ?? [])]).toEqual(['A', 'B', 'C'])
    expect(group?.works.get('B')?.steps).toHaveLength(1)
    // Ni carte seule, ni ligne dans « Sous-tâches », ni compte rendu à sa place.
    expect(layout.solos.size).toBe(0)
    for (const id of [2, 3, 4, 5, 6]) expect(layout.hidden.has(id)).toBe(true)
    expect([...layout.childIds].sort()).toEqual(['pA', 'pB', 'pC'])
    // Un travail ordinaire reste comme avant ; l'élément du tour reste à sa place.
    expect(layout.hidden.has(7)).toBe(false)
    expect(layout.hidden.has(1)).toBe(false)
  })

  it('participant sans lancement dans le fil : ses comptes rendus cachés quand même', () => {
    const layout = workLayout([rt, answer(2, 'pC')])
    expect(layout.roundtables.get(1)?.works.size).toBe(0)
    expect(layout.hidden.has(2)).toBe(true)
    expect(layout.childIds.has('pC')).toBe(true)
  })

  it('sans tour de table : rien de changé', () => {
    expect(workLayout([launch(1, 'pA')]).roundtables.size).toBe(0)
  })
})
