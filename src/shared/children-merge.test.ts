import { describe, expect, it } from 'vitest'
import {
  lastChildrenMerge,
  mergeBlockReasons,
  mergeOverlaps,
  mergeSummary,
  planWithout,
  settledMerge,
  type ChildrenMerge,
  type ChildrenMergePlan,
  type MergeCandidate
} from './children-merge'
import { translate } from './i18n/message'
import { emptyTranscript, reduceTranscript } from './transcript'

const child = (
  id: string,
  state: MergeCandidate['state'],
  files: string[] = []
): MergeCandidate => ({
  id,
  title: id,
  branch: `bobine/${id}`,
  base: 'main',
  state,
  files,
  dirty: state === 'dirty' ? 2 : 0
})

const plan = (children: MergeCandidate[], extra: Partial<ChildrenMergePlan> = {}) => {
  const ready = children.filter((c) => c.state === 'ready' || c.state === 'conflict')
  return { base: 'main', children, overlaps: mergeOverlaps(ready), running: false, ...extra }
}

/** Liste de titres comme l'interface française : « A » et « B ». */
const titles = (list: readonly string[]) =>
  new Intl.ListFormat('fr', { type: 'conjunction' }).format(list.map((x) => `« ${x} »`))
const text = (p: ChildrenMergePlan) => mergeSummary(p, titles).map(translate).join(' ')

const merge = (status: ChildrenMerge['status'], states: ChildrenMerge['rows'][number]['state'][]) =>
  ({
    runId: 'r1',
    base: 'main',
    cleanup: false,
    status,
    rows: states.map((state, i) => ({ childId: `f${i}`, title: `F${i}`, state })),
    startedAt: 1
  }) satisfies ChildrenMerge

describe('fusion des filles : ce qui se calcule sans processus (fiche 120)', () => {
  it('recouvrements : fichiers modifiés par deux filles, dans l’ordre de lancement', () => {
    expect(
      mergeOverlaps([
        child('A', 'ready', ['src/x.ts', 'a.md']),
        child('B', 'ready', ['b.md']),
        child('C', 'ready', ['src/x.ts', 'b.md'])
      ])
    ).toEqual([
      { first: 'A', second: 'C', files: ['src/x.ts'] },
      { first: 'B', second: 'C', files: ['b.md'] }
    ])
  })

  it('phrase d’état : toutes prêtes, certaines au travail, recouvrement, non commitées, refus', () => {
    expect(
      text(plan([child('A', 'ready', ['a']), child('B', 'ready', ['b']), child('C', 'ready')]))
    ).toBe('Les 3 travaux à fusionner ont répondu et ne touchent pas les mêmes fichiers.')
    expect(text(plan([child('A', 'ready')]))).toBe('Le travail à fusionner a répondu.')
    expect(
      text(plan([child('A', 'ready'), child('B', 'merged'), child('E2E plus courts', 'running')]))
    ).toBe('1 travail à fusionner a répondu\u00a0; «\u00a0E2E plus courts\u00a0» travaille encore.')
    expect(
      text(
        plan([
          child('A', 'ready'),
          child('B', 'ready'),
          child('C', 'running'),
          child('D', 'waiting')
        ])
      )
    ).toBe(
      '2 travaux à fusionner ont répondu\u00a0; «\u00a0C\u00a0» travaille encore, «\u00a0D\u00a0» attend un accord.'
    )
    expect(text(plan([child('A', 'ready', ['src/x.ts']), child('B', 'ready', ['src/x.ts'])]))).toBe(
      'Les 2 travaux à fusionner ont répondu. Les branches «\u00a0A\u00a0» et «\u00a0B\u00a0» touchent src/x.ts toutes les deux\u00a0: la seconde pourra entrer en conflit.'
    )
    expect(text(plan([child('A', 'ready'), child('B', 'dirty')]))).toBe(
      'Le travail à fusionner a répondu. «\u00a0B\u00a0» a des modifications non commitées\u00a0: à committer depuis sa vue Git.'
    )
    expect(text(plan([child('A', 'dirty'), child('B', 'dirty')]))).toBe(
      '«\u00a0A\u00a0» et «\u00a0B\u00a0» ont des modifications non commitées\u00a0: à committer depuis leur vue Git.'
    )
    expect(
      text(plan([child('A', 'ready')], { blocked: { reason: 'base-elsewhere', path: '/x' } }))
    ).toBe(
      'Le travail à fusionner a répondu. La branche main est extraite dans un autre worktree (/x)\u00a0: fusionnez-la de là.'
    )
    // Rien de fini à fusionner : pas de pied.
    expect(mergeSummary(plan([child('A', 'running'), child('B', 'merged')]), titles)).toEqual([])
    // Une fille arrêtée sur un conflit compte avec les prêtes.
    expect(text(plan([child('A', 'conflict')]))).toBe('Le travail à fusionner a répondu.')
    // Au-delà de trois fichiers en commun, la liste s'arrête.
    const many = ['a', 'b', 'c', 'd']
    expect(text(plan([child('A', 'ready', many), child('B', 'ready', many)]))).toContain(
      'touchent a, b, c… toutes'
    )
  })

  it('fusion interrompue par la fermeture de l’app : dite arrêtée, lignes en cours remises en attente', () => {
    const running = merge('running', ['merged', 'resolving', 'pending'])
    expect(settledMerge(running, true)).toBe(running)
    expect(settledMerge(running, false)).toMatchObject({
      status: 'stopped',
      interrupted: true,
      rows: [{ state: 'merged' }, { state: 'pending' }, { state: 'pending' }]
    })
    const done = merge('done', ['merged'])
    expect(settledMerge(done, false)).toBe(done)
  })

  it('fil de la mère : un élément par fusion, remplacé à chaque étape ; la dernière est lue', () => {
    let state = reduceTranscript(emptyTranscript, { type: 'notice', level: 'info', message: 'x' })
    state = reduceTranscript(state, {
      type: 'children-merge',
      merge: merge('running', ['pending'])
    })
    state = reduceTranscript(state, { type: 'children-merge', merge: merge('done', ['merged']) })
    expect(state.items.map((i) => i.kind)).toEqual(['notice', 'children-merge'])
    expect(state.items[1]?.id).toBe(2)
    expect(lastChildrenMerge(state.items)).toMatchObject({
      status: 'done',
      rows: [{ state: 'merged' }]
    })
    state = reduceTranscript(state, {
      type: 'children-merge',
      merge: { ...merge('running', ['pending']), runId: 'r2' }
    })
    expect(state.items).toHaveLength(3)
    expect(lastChildrenMerge(state.items)?.runId).toBe('r2')
    expect(lastChildrenMerge(emptyTranscript.items)).toBeUndefined()
  })
})

describe('plan sans les travaux d’une bulle (fiche 263)', () => {
  const plan: ChildrenMergePlan = {
    base: 'main',
    children: ['a', 'b', 'c'].map((id) => ({
      id,
      title: id,
      branch: `bobine/${id}`,
      base: 'main',
      state: 'ready' as const,
      files: [],
      dirty: 0
    })) as MergeCandidate[],
    overlaps: [
      { first: 'a', second: 'b', files: ['y.ts'] },
      { first: 'a', second: 'c', files: ['x.ts'] }
    ],
    running: false
  }
  it('retire ces filles et leurs recouvrements ; rien à retirer : le même plan', () => {
    const kept = planWithout(plan, new Set(['c']))
    expect(kept.children.map((c) => c.id)).toEqual(['a', 'b'])
    expect(kept.overlaps).toEqual([{ first: 'a', second: 'b', files: ['y.ts'] }])
    expect(planWithout(plan, new Set())).toBe(plan)
    expect(planWithout(plan, undefined)).toBe(plan)
  })
})

describe('pourquoi « Fusionner » ne part pas (fiche 287)', () => {
  const why = (p: ChildrenMergePlan, chosen: string[]) =>
    mergeBlockReasons(p, chosen, titles)
      .map(translate)
      .join(' ')
      .replace(/\u00a0/g, ' ')

  it('rien ne l’empêche : aucune raison', () => {
    expect(mergeBlockReasons(plan([child('a', 'ready')]), ['a'], titles)).toEqual([])
  })

  it('une fusion en cours, la base extraite ailleurs : dit, même avec des travaux prêts', () => {
    expect(why(plan([child('a', 'ready')], { running: true }), ['a'])).toBe(
      'Une fusion est déjà en cours ici : celle-ci attend sa fin.'
    )
    expect(
      why(plan([child('a', 'ready')], { blocked: { reason: 'base-elsewhere', path: '/x' } }), ['a'])
    ).toBe('main est extraite dans un autre worktree (/x) : fusionnez de là.')
  })

  it('rien de prêt : une phrase par cause réelle, avec les titres (recette Bricole, 21:13)', () => {
    expect(why(plan([child('a', 'dirty'), child('b', 'running'), child('c', 'waiting')]), [])).toBe(
      '« b » répond encore : la fusion attend la fin de son tour. ' +
        '« c » attend votre accord : la fusion attend sa réponse. ' +
        '« a » a des modifications non commitées : à committer depuis sa vue Git.'
    )
    expect(why(plan([child('a', 'dirty'), child('b', 'dirty')]), [])).toBe(
      '« a » et « b » ont des modifications non commitées : à committer depuis leur vue Git.'
    )
    expect(why(plan([child('a', 'merged')]), [])).toBe(
      'Rien à fusionner : aucune branche n’a de commit que main n’a pas.'
    )
  })
})
