import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackgroundWork } from './background-work'

/** Travail après le tour (fiche 255) : sous-agents en arrière-plan, parole hors tour, silence. */

/** `changes` : chaque `background-work` émis ; `done` : les heures données à la fin. */
function setup(busy = { now: false }) {
  const changes: boolean[] = []
  const done: number[] = []
  const work = new BackgroundWork({
    emit: (event) => {
      if (event.type !== 'background-work') return
      changes.push(event.active)
      if (event.at !== undefined) done.push(event.at)
    },
    busy: () => busy.now,
    quietMs: 5000
  })
  return { work, changes, done, busy }
}

describe('BackgroundWork (fiche 255)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })
  afterEach(() => vi.useRealTimers())

  it('séquence observée : sous-agent lancé, tour fini, réponse hors tour, fin du sous-agent, silence', () => {
    const { work, changes, done, busy } = setup({ now: true })
    // Pendant le tour : l'outil rend la main, le sous-agent travaille en arrière-plan.
    work.run('call_explore', { startedAt: 1, sessionId: 'ses', background: true })
    expect(work.active).toBe(true)
    busy.now = false // end_turn
    vi.advanceTimersByTime(77_000)
    expect(work.active).toBe(true)
    // Le parent répond hors tour (avant que le suivi ne voie la fin du sous-agent).
    work.spoke()
    const answeredAt = Date.now()
    vi.advanceTimersByTime(1000)
    work.spoke()
    const lastWords = Date.now()
    vi.advanceTimersByTime(3000)
    work.run('call_explore', { endedAt: Date.now(), answer: 'fini' })
    expect(work.active).toBe(true)
    // 5 s de silence après la dernière activité (la fin du sous-agent) : fini.
    vi.advanceTimersByTime(4999)
    expect(work.active).toBe(true)
    vi.advanceTimersByTime(1)
    expect(work.active).toBe(false)
    expect(done).toEqual([lastWords])
    expect(lastWords).toBeGreaterThan(answeredAt)
    expect(changes).toEqual([true, false])
  })

  it('fin du sous-agent avant la réponse : la réponse arrivée dans les 5 s compte encore', () => {
    const { work, done } = setup()
    work.run('a', { background: true })
    vi.advanceTimersByTime(10_000)
    work.run('a', { endedAt: Date.now() })
    vi.advanceTimersByTime(3000)
    expect(work.active).toBe(true)
    work.spoke()
    const at = Date.now()
    vi.advanceTimersByTime(5000)
    expect(work.active).toBe(false)
    expect(done).toEqual([at])
  })

  it('aucune réponse après la fin du sous-agent : fini 5 s après, sans date (pas d’attente sans borne)', () => {
    const { work, done, changes } = setup()
    work.run('a', { background: true })
    work.run('a', { endedAt: Date.now() })
    vi.advanceTimersByTime(5000)
    expect(work.active).toBe(false)
    expect(done).toEqual([])
    expect(changes).toEqual([true, false])
  })

  it('deux sous-agents : chaque lancement annoncé ; en cours tant que le second travaille', () => {
    const { work, changes } = setup()
    work.run('a', { background: true })
    work.run('b', { background: true })
    // Un fil qui aurait oublié le travail (agent relancé après un plantage) le revoit.
    expect(changes).toEqual([true, true])
    work.run('a', { endedAt: Date.now() })
    work.spoke()
    vi.advanceTimersByTime(60_000)
    expect(work.active).toBe(true)
    work.run('b', { lost: true })
    vi.advanceTimersByTime(5000)
    expect(work.active).toBe(false)
  })

  it('sous-agent fini pendant le tour : pas de fenêtre de silence, le tour dira la fin', () => {
    const { work, done, busy } = setup({ now: true })
    work.run('a', { background: true })
    work.run('a', { endedAt: Date.now() })
    expect(work.active).toBe(false)
    busy.now = false
    vi.advanceTimersByTime(10_000)
    expect(done).toEqual([])
  })

  it('retombé pendant un autre tour : aucune date (sa fin datera ses réponses)', () => {
    const { work, done, busy } = setup()
    work.run('a', { background: true })
    work.spoke()
    busy.now = true // l'utilisateur a envoyé un autre message
    work.run('a', { endedAt: Date.now() })
    vi.advanceTimersByTime(5000)
    expect(work.active).toBe(false)
    expect(done).toEqual([])
  })

  it('parole hors tour sans sous-agent : « en cours » le temps qu’elle s’écrive', () => {
    const { work, done } = setup()
    work.spoke()
    expect(work.active).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(work.active).toBe(false)
    expect(done).toHaveLength(1)
  })

  it('reset : plus rien en cours, rien d’annoncé, minuterie arrêtée', () => {
    const { work, done, changes } = setup()
    work.run('a', { background: true })
    work.spoke()
    work.reset()
    expect(work.active).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(done).toEqual([])
    expect(changes).toEqual([true])
    // Une fin tardive d'un sous-agent oublié ne relance rien.
    work.run('a', { endedAt: Date.now() })
    expect(work.active).toBe(false)
  })

  it('mises à jour du suivi sans rapport (coût, session) : rien ne change', () => {
    const { work, changes } = setup()
    work.run('a', { startedAt: 1 })
    work.run('a', { cost: { amount: 1, currency: 'USD' } })
    expect(work.active).toBe(false)
    expect(changes).toEqual([])
  })
})
