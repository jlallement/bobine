/**
 * Plan partagé des cartes d'une conversation (fiche 264) : le temps qu'un état soit lu, la carte
 * montre le dernier plan lu. Relevé en CI macOS (`travaux-groupe`, fiche 250) : les lectures
 * tournent en parallèle et finissent dans le désordre ; une lecture lancée pendant qu'un travail
 * résolvait son conflit (« en cours ») finissait après une plus récente, et la carte repassait sur
 * cet état ancien.
 */
import { describe, expect, it } from 'vitest'
import type { ChildrenMergePlan } from '@shared/children-merge'
import { loadPlan, readPlan } from './merge-plan-store'

const plan = (state: 'running' | 'conflict'): ChildrenMergePlan => ({
  base: 'main',
  children: [
    { id: 'b', title: 'Notes', branch: 'bobine/b', base: 'main', state, files: [], dirty: 0 }
  ],
  overlaps: [],
  running: false
})

/** Une lecture tenue en suspens : l'essai dit quand elle aboutit. */
function held() {
  let resolve: (plan: ChildrenMergePlan) => void = () => undefined
  const promise = new Promise<ChildrenMergePlan>((r) => (resolve = r))
  return { read: () => promise, resolve }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('plan montré le temps d’une lecture', () => {
  it('une lecture plus ancienne qui finit après une plus récente ne la remplace pas', async () => {
    const older = held()
    const newer = held()
    loadPlan('mere', 'resolving', older.read)
    loadPlan('mere', 'conflict', newer.read)
    newer.resolve(plan('conflict'))
    await flush()
    older.resolve(plan('running'))
    await flush()
    // Un nouvel état, pas encore lu : le plan de l'état le plus récent lu, pas le dernier arrivé.
    loadPlan('mere', 'next', () => new Promise(() => undefined))
    expect(readPlan('mere', 'next')).toEqual({ plan: plan('conflict'), exact: false })
    // Chaque état garde bien sa propre lecture.
    expect(readPlan('mere', 'resolving')?.plan.children[0]?.state).toBe('running')
  })

  it('dans l’ordre : le dernier lu est montré', async () => {
    const first = held()
    const second = held()
    loadPlan('mere', 'one', first.read)
    first.resolve(plan('running'))
    await flush()
    loadPlan('mere', 'two', second.read)
    expect(readPlan('mere', 'two')).toEqual({ plan: plan('running'), exact: false })
    second.resolve(plan('conflict'))
    await flush()
    expect(readPlan('mere', 'two')).toEqual({ plan: plan('conflict'), exact: true })
  })
})
