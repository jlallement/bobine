import { describe, expect, it } from 'vitest'
import {
  lastChildrenMerge,
  mergeOverlaps,
  mergeSummary,
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
    ).toBe('Les 3 branches sont finies et ne touchent pas les mêmes fichiers.')
    expect(text(plan([child('A', 'ready')]))).toBe('La branche est finie.')
    expect(
      text(plan([child('A', 'ready'), child('B', 'merged'), child('E2E plus courts', 'running')]))
    ).toBe('1 branche finie\u00a0; «\u00a0E2E plus courts\u00a0» travaille encore.')
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
      '2 branches finies\u00a0; «\u00a0C\u00a0» travaille encore, «\u00a0D\u00a0» attend un accord.'
    )
    expect(text(plan([child('A', 'ready', ['src/x.ts']), child('B', 'ready', ['src/x.ts'])]))).toBe(
      'Les 2 branches sont finies. Les branches «\u00a0A\u00a0» et «\u00a0B\u00a0» touchent src/x.ts toutes les deux\u00a0: la seconde pourra entrer en conflit.'
    )
    expect(text(plan([child('A', 'ready'), child('B', 'dirty')]))).toBe(
      'La branche est finie. «\u00a0B\u00a0» a des modifications non commitées\u00a0: à committer depuis sa vue Git.'
    )
    expect(text(plan([child('A', 'dirty'), child('B', 'dirty')]))).toBe(
      '«\u00a0A\u00a0» et «\u00a0B\u00a0» ont des modifications non commitées\u00a0: à committer depuis leur vue Git.'
    )
    expect(
      text(plan([child('A', 'ready')], { blocked: { reason: 'base-elsewhere', path: '/x' } }))
    ).toBe(
      'La branche est finie. La branche main est extraite dans un autre worktree (/x)\u00a0: fusionnez-la de là.'
    )
    // Rien de fini à fusionner : pas de pied.
    expect(mergeSummary(plan([child('A', 'running'), child('B', 'merged')]), titles)).toEqual([])
    // Une fille arrêtée sur un conflit compte avec les prêtes.
    expect(text(plan([child('A', 'conflict')]))).toBe('La branche est finie.')
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
