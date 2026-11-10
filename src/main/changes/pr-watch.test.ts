import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKGROUND_STOP_MS,
  CHECKS_GRACE_MS,
  FAST_WINDOW_MS,
  POLL_FAST_MS,
  POLL_MIN_MS,
  POLL_PENDING_MS,
  type PrTrack
} from '@shared/pr-tracking'
import { t } from 'i18next'
import type { Run } from '../simulator/run'
import { AUTO_FIX_MAX, MERGEABILITY_GRACE_MS, PrWatcher, RULES_RETRY_MS } from './pr-watch'

type Check = { name: string; status: string; conclusion?: string; detailsUrl?: string }

/** Faux `gh` : une PR dont l'essai change l'état, et le compte de chaque appel. */
function fakeGh() {
  const state = {
    pr: null as null | Record<string, unknown>,
    viewError: '',
    mergeError: '',
    /** Méthodes de fusion permises par le dépôt (`gh repo view`). */
    repo: { mergeCommitAllowed: true, squashMergeAllowed: true, rebaseMergeAllowed: true },
    /** Règles de la base (`gh api …/branches/main`, `…/rules/branches/main`) ; `error` : refus. */
    branch: { name: 'main', protected: false } as Record<string, unknown> | { error: string },
    rules: [] as unknown[] | { error: string },
    calls: [] as string[][]
  }
  const pr = (checks: Check[], over: Record<string, unknown> = {}) => {
    state.pr = {
      number: 7,
      url: 'https://github.com/o/r/pull/7',
      title: 'Démo',
      state: 'OPEN',
      isDraft: false,
      headRefOid: 'h1',
      mergeable: 'MERGEABLE',
      reviewDecision: '',
      mergeStateStatus: 'CLEAN',
      baseRefName: 'main',
      comments: [],
      reviews: [],
      statusCheckRollup: checks,
      ...over
    }
  }
  const ok = (stdout: string) =>
    Promise.resolve({ code: 0, stdout: Buffer.from(stdout), stderr: '' })
  const fail = (stderr: string) => Promise.resolve({ code: 1, stdout: Buffer.alloc(0), stderr })
  const run: Run = (file, args) => {
    expect(file).toBe('/fake/gh')
    state.calls.push(args)
    if (args[0] === 'pr' && args[1] === 'view') {
      if (state.viewError) return fail(state.viewError)
      return state.pr ? ok(JSON.stringify(state.pr)) : fail('no pull requests found for branch "b"')
    }
    if (args[0] === 'repo' && args[1] === 'view') return ok(JSON.stringify(state.repo))
    if (args[0] === 'api') {
      const answer: unknown = args[1]?.includes('/rules/') ? state.rules : state.branch
      const error = (answer as { error?: unknown }).error
      return typeof error === 'string' ? fail(error) : ok(JSON.stringify(answer))
    }
    if (args[0] === 'run') return ok(`test\tRun\t2026-11-06T10:00:00Z FAIL job ${args[3]}\n`)
    if (args[0] === 'pr' && args[1] === 'merge') {
      if (state.mergeError) return fail(state.mergeError)
      if (state.pr) state.pr = { ...state.pr, state: 'MERGED' }
      return ok('')
    }
    return fail('unexpected')
  }
  return { state, pr, run, views: () => state.calls.filter((c) => c[1] === 'view').length }
}

const failing: Check[] = [
  {
    name: 'test',
    status: 'COMPLETED',
    conclusion: 'FAILURE',
    detailsUrl: 'https://github.com/o/r/actions/runs/1/job/42'
  },
  { name: 'ext', status: 'COMPLETED', conclusion: 'FAILURE' }
]
const pending: Check[] = [{ name: 'test', status: 'IN_PROGRESS' }]
const green: Check[] = [{ name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }]

function setup(
  options: {
    gh?: boolean
    worktree?: boolean
    promptError?: string
    ci?: boolean
    /** Date des commits (ms) ; absente : `commitDate` n'est pas fourni. */
    commitDate?: number
  } = {}
) {
  const gh = fakeGh()
  const emitted: PrTrack[] = []
  const prompt = vi.fn(async (_id: string, _text: string) => {
    if (options.promptError) throw new Error(options.promptError)
  })
  const watcher = new PrWatcher({
    run: gh.run,
    targetOf: (id) =>
      options.worktree === false ? undefined : { id, cwd: '/repo/.worktrees/x', branch: 'b' },
    ghFor: async () => (options.gh === false ? undefined : '/fake/gh'),
    emit: (_id, track) => emitted.push(track),
    prompt,
    workflows: async () => options.ci !== false,
    ...(options.commitDate !== undefined ? { commitDate: async () => options.commitDate } : {})
  })
  return { gh, watcher, emitted, prompt }
}

/** Laisse passer un minuteur et les promesses qu'il lance. */
const elapse = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('suivi de la PR (fiche 176)', () => {
  it('sans gh, sans dépôt distant ou sans worktree : rien, aucun appel', async () => {
    for (const options of [{ gh: false }, { worktree: false }]) {
      const { gh, watcher, emitted } = setup(options)
      expect(await watcher.status('c1')).toEqual({ status: 'unavailable' })
      await elapse(60 * 60_000)
      expect(gh.state.calls).toEqual([])
      expect(emitted).toEqual([])
    }
  })

  it('pas de PR : pas de relève ; relu par status après une minute', async () => {
    const { gh, watcher } = setup()
    expect((await watcher.status('c1')).status).toBe('none')
    expect(gh.state.calls[0]).toEqual([
      'pr',
      'view',
      'b',
      '--json',
      expect.stringContaining('statusCheckRollup')
    ])
    await elapse(30 * 60_000)
    expect(gh.views()).toBe(1)
    // Moins d'une minute après : ce qui est su.
    gh.pr(pending)
    vi.setSystemTime(Date.now() - 30 * 60_000 + 10_000)
    expect((await watcher.status('c1')).status).toBe('none')
    vi.setSystemTime(Date.now() + 30 * 60_000)
    expect((await watcher.status('c1')).status).toBe('found')
    expect(gh.views()).toBe(2)
  })

  it('cadence : 30 s tant que ça tourne, puis espacée, remise à 30 s au changement, arrêt à la fusion', async () => {
    const { gh, watcher, emitted } = setup()
    gh.pr(pending)
    const first = await watcher.status('c1')
    expect(first.status === 'found' && first.pr.summary).toBe('pending')
    await elapse(POLL_PENDING_MS)
    expect(gh.views()).toBe(2)
    gh.pr(green)
    await elapse(POLL_PENDING_MS)
    expect(gh.views()).toBe(3)
    // Changement (vert) : encore 30 s, puis 1 min, 2 min…
    await elapse(POLL_PENDING_MS)
    expect(gh.views()).toBe(4)
    await elapse(POLL_MIN_MS - 1)
    expect(gh.views()).toBe(4)
    await elapse(1)
    expect(gh.views()).toBe(5)
    await elapse(2 * POLL_MIN_MS)
    expect(gh.views()).toBe(6)
    // `status` rend ce qui est su, sans appel.
    await watcher.status('c1')
    expect(gh.views()).toBe(6)
    gh.pr(green, { state: 'MERGED' })
    await elapse(4 * POLL_MIN_MS)
    expect(gh.views()).toBe(7)
    const last = emitted.at(-1)
    expect(last?.status === 'found' && last.pr.state).toBe('merged')
    await elapse(60 * 60_000)
    expect(gh.views()).toBe(7)
  })

  it('arrière-plan : 10 min au plus, veille après 30 min, reprise au premier plan', async () => {
    const { gh, watcher } = setup()
    gh.pr(pending)
    await watcher.status('c1')
    watcher.setFocused(false)
    await elapse(POLL_PENDING_MS)
    // Le minuteur posé avant le passage en arrière-plan part encore une fois.
    expect(gh.views()).toBe(2)
    await elapse(5 * 60_000)
    expect(gh.views()).toBe(2)
    await elapse(5 * 60_000)
    expect(gh.views()).toBe(3)
    await elapse(BACKGROUND_STOP_MS)
    const asleep = gh.views()
    expect(asleep).toBeLessThanOrEqual(5)
    await elapse(2 * 60 * 60_000)
    expect(gh.views()).toBe(asleep)
    watcher.setFocused(true)
    await elapse(0)
    expect(gh.views()).toBe(asleep + 1)
    await elapse(POLL_PENDING_MS)
    expect(gh.views()).toBe(asleep + 2)
  })

  it('erreur de gh : dite, relève espacée, rien ne casse', async () => {
    const { gh, watcher } = setup()
    gh.state.viewError = 'HTTP 502: Bad Gateway'
    const track = await watcher.status('c1')
    expect(track).toMatchObject({ status: 'error', message: 'HTTP 502: Bad Gateway' })
    gh.state.viewError = ''
    gh.pr(green)
    await elapse(POLL_MIN_MS)
    expect((await watcher.status('c1')).status).toBe('found')
  })

  it('« Corriger les contrôles en échec » : consigne avec extraits, sur clic seulement', async () => {
    const { gh, watcher, prompt, emitted } = setup()
    gh.pr(failing)
    await watcher.status('c1')
    await elapse(10 * 60_000)
    expect(prompt).not.toHaveBeenCalled()
    const after = await watcher.fixChecks('c1')
    expect(prompt).toHaveBeenCalledTimes(1)
    const text = prompt.mock.calls[0]?.[1] ?? ''
    expect(text).toContain('pull request #7')
    expect(text).toContain('### test — https://github.com/o/r/actions/runs/1/job/42')
    expect(text).toContain('FAIL job 42')
    expect(text).toContain('### ext\n\n(no log available')
    // Un seul journal lu : celui qui a un job.
    expect(gh.state.calls.filter((c) => c[0] === 'run')).toEqual([
      ['run', 'view', '--job', '42', '--log-failed']
    ])
    expect(after).toMatchObject({ event: { kind: 'fix-sent', auto: false, count: 2 } })
    expect(emitted.at(-1)).toMatchObject({ event: { kind: 'fix-sent' } })
    gh.pr(green)
    await expect(
      (async () => {
        await watcher.refresh('c1')
        return watcher.fixChecks('c1')
      })()
    ).rejects.toThrow()
  })

  it('« Corriger d’office » : une fois par commit en tête, au plus 3 fois', async () => {
    const { gh, watcher, prompt } = setup()
    gh.pr(failing)
    await watcher.status('c1')
    expect(prompt).not.toHaveBeenCalled()
    const track = await watcher.setOptions('c1', { autoFix: true })
    expect(track).toMatchObject({ options: { autoFix: true, autoMerge: false } })
    expect(prompt).toHaveBeenCalledTimes(1)
    await watcher.refresh('c1')
    expect(prompt).toHaveBeenCalledTimes(1)
    for (let i = 2; i <= AUTO_FIX_MAX + 2; i++) {
      gh.pr(failing, { headRefOid: `h${i}` })
      await watcher.refresh('c1')
    }
    expect(prompt).toHaveBeenCalledTimes(AUTO_FIX_MAX)
    // La dernière note parlait d'un commit plus ancien : effacée (0.9.1, D17).
    expect(await watcher.status('c1')).not.toHaveProperty('event')
  })

  it('la note « envoyé à l’agent » s’efface quand les contrôles changent (0.9.1, D17)', async () => {
    const { gh, watcher } = setup()
    gh.pr(failing)
    await watcher.status('c1')
    await watcher.fixChecks('c1')
    // Relu sans changement : la note reste.
    expect(await watcher.refresh('c1')).toMatchObject({ event: { kind: 'fix-sent' } })
    // L'agent pousse : nouveau commit, contrôles en cours puis verts ; la note n'a plus lieu d'être.
    gh.pr(pending, { headRefOid: 'h2' })
    expect(await watcher.refresh('c1')).not.toHaveProperty('event')
    gh.pr(green, { headRefOid: 'h2' })
    expect(await watcher.refresh('c1')).not.toHaveProperty('event')
  })

  it('juste après un push : relève toutes les 10 s pendant 2 min, contrôles « attendus » (D16)', async () => {
    const { gh, watcher } = setup()
    gh.pr([])
    const first = await watcher.pushed('c1')
    expect(first).toMatchObject({ status: 'found', ci: 'awaited' })
    await elapse(POLL_FAST_MS)
    expect(gh.views()).toBe(2)
    gh.pr(pending)
    await elapse(POLL_FAST_MS)
    expect(gh.views()).toBe(3)
    expect(await watcher.status('c1')).not.toHaveProperty('ci')
    // Deux minutes à 10 s, puis la cadence ordinaire (30 s tant que ça tourne).
    await elapse(FAST_WINDOW_MS - 2 * POLL_FAST_MS)
    expect(gh.views()).toBe(FAST_WINDOW_MS / POLL_FAST_MS + 1)
    const before = gh.views()
    await elapse(2 * POLL_MIN_MS)
    expect(gh.views() - before).toBeLessThanOrEqual(5)
    expect(gh.views() - before).toBeGreaterThanOrEqual(3)
  })

  it('un nouveau commit en tête (poussé par l’agent) rapproche aussi la relève', async () => {
    const { gh, watcher } = setup()
    gh.pr(green)
    await watcher.status('c1')
    await elapse(POLL_MIN_MS)
    expect(gh.views()).toBe(2)
    gh.pr(green, { headRefOid: 'h2' })
    await elapse(2 * POLL_MIN_MS)
    const at = gh.views()
    await elapse(POLL_FAST_MS)
    expect(gh.views()).toBe(at + 1)
  })

  it('aucun contrôle : pas de CI, attendus, puis « rien » après 5 min (D16, D20)', async () => {
    const noCi = setup({ ci: false })
    noCi.gh.pr([])
    expect(await noCi.watcher.status('c1')).toMatchObject({ ci: 'none' })
    const withCi = setup()
    withCi.gh.pr([])
    expect(await withCi.watcher.status('c1')).toMatchObject({ ci: 'awaited' })
    await elapse(CHECKS_GRACE_MS)
    expect(await withCi.watcher.refresh('c1')).toMatchObject({ ci: 'silent' })
    // Jamais de fusion d'office sans contrôle, même cochée.
    await withCi.watcher.setOptions('c1', { autoMerge: true })
    await noCi.watcher.setOptions('c1', { autoMerge: true })
    for (const { gh } of [noCi, withCi]) {
      expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    }
  })

  it('« Aucune CI » seulement si GitHub ne dit rien d’autre : CI externe, règles, blocage (remarque 1)', async () => {
    // Pas de workflow, mais la protection de la base exige des contrôles (CI externe).
    const external = setup({ ci: false })
    external.gh.state.branch = {
      name: 'main',
      protected: true,
      protection: { required_status_checks: { contexts: ['ci/circleci'], checks: [] } }
    }
    external.gh.pr([])
    expect(await external.watcher.status('c1')).toMatchObject({ ci: 'awaited' })
    await expect(external.watcher.mergeNow('c1')).rejects.toThrow()
    // Un ruleset exige un contrôle.
    const ruleset = setup({ ci: false })
    ruleset.gh.state.rules = [
      {
        type: 'required_status_checks',
        parameters: { required_status_checks: [{ context: 'build' }] }
      }
    ]
    ruleset.gh.pr([])
    expect(await ruleset.watcher.status('c1')).toMatchObject({ ci: 'awaited' })
    // Règles illisibles : une CI est supposée.
    const unreadable = setup({ ci: false })
    unreadable.gh.state.rules = { error: 'HTTP 500' }
    unreadable.gh.pr([])
    expect(await unreadable.watcher.status('c1')).toMatchObject({ ci: 'awaited' })
    // Rulesets indisponibles (dépôt privé gratuit) : il n'y en a pas.
    const free = setup({ ci: false })
    free.gh.state.rules = {
      error: 'gh: Upgrade to GitHub Pro or make this repository public (HTTP 403)'
    }
    free.gh.pr([])
    expect(await free.watcher.status('c1')).toMatchObject({ ci: 'none' })
    // GitHub bloque la PR sans que la relecture l'explique : quelque chose est requis.
    const blocked = setup({ ci: false })
    blocked.gh.pr([], { mergeStateStatus: 'BLOCKED' })
    expect(await blocked.watcher.status('c1')).toMatchObject({ ci: 'awaited' })
    // Lus une fois par base, pas à chaque relève.
    const apiCalls = free.gh.state.calls.filter((c) => c[0] === 'api').length
    await free.watcher.refresh('c1')
    expect(free.gh.state.calls.filter((c) => c[0] === 'api').length).toBe(apiCalls)
    expect(free.gh.state.calls.filter((c) => c[0] === 'api').map((c) => c[1])).toEqual([
      'repos/{owner}/{repo}/branches/main',
      'repos/{owner}/{repo}/rules/branches/main'
    ])
  })

  it('« Fusionner maintenant » refusé, avec la raison, quand GitHub bloque (remarque 2)', async () => {
    const { gh, watcher } = setup({ ci: false })
    gh.pr([], { mergeStateStatus: 'BEHIND' })
    await watcher.status('c1')
    await expect(watcher.mergeNow('c1')).rejects.toThrow(t('prTrack.wait.behind', { base: 'main' }))
    gh.pr([], { isDraft: true })
    await watcher.refresh('c1')
    await expect(watcher.mergeNow('c1')).rejects.toThrow(t('prTrack.wait.draft'))
    gh.pr([], { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })
    await watcher.refresh('c1')
    await expect(watcher.mergeNow('c1')).rejects.toThrow(
      t('prTrack.wait.conflicting', { base: 'main' })
    )
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    // GitHub refuse quand même (règle que l'app n'a pas vue) : dit sur la carte.
    gh.pr([])
    gh.state.mergeError =
      'Pull request is not mergeable: the base branch policy prohibits the merge.'
    await watcher.refresh('c1')
    expect(await watcher.mergeNow('c1')).toMatchObject({
      event: { kind: 'merge-failed', message: expect.stringContaining('base branch policy') }
    })
  })

  it('relève rapprochée : par PR, et jamais fenêtre cachée (remarque 4)', async () => {
    const { gh, watcher } = setup()
    const byId = new Map<string, number>()
    const counted = new PrWatcher({
      run: gh.run,
      targetOf: (id) => ({ id, cwd: '/repo/.worktrees/x', branch: 'b' }),
      ghFor: async () => '/fake/gh',
      emit: () => {},
      prompt: async () => {},
      log: (id, line) => {
        if (id && line.startsWith('gh pr view')) byId.set(id, (byId.get(id) ?? 0) + 1)
      }
    })
    void watcher
    gh.pr(green)
    await counted.status('other')
    await counted.pushed('c1')
    await elapse(POLL_MIN_MS)
    // En une minute : c1, poussée, toutes les 10 s ; l'autre PR à sa cadence (1 min).
    expect(byId.get('c1')).toBe(1 + POLL_MIN_MS / POLL_FAST_MS)
    expect(byId.get('other')).toBe(2)
    // Fenêtre cachée : 10 min au plus, même juste après un push.
    counted.setFocused(false)
    await counted.pushed('c1')
    const hidden = byId.get('c1') ?? 0
    await elapse(FAST_WINDOW_MS)
    expect(byId.get('c1')).toBe(hidden)
  })

  it('« Fusionner maintenant » relit la PR d’abord, puis épingle le commit vu (remarque 1)', async () => {
    const { gh, watcher } = setup({ ci: false })
    gh.pr([])
    await watcher.status('c1')
    // L'agent a poussé depuis la dernière relève, et sa CI a démarré : refus, rien ne part.
    gh.pr([{ name: 'test', status: 'IN_PROGRESS' }], { headRefOid: 'h2' })
    await expect(watcher.mergeNow('c1')).rejects.toThrow(t('prTrack.wait.pending'))
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    // Un autre commit, toujours sans CI : la fusion vise ce commit-là, pas celui de la carte.
    gh.pr([], { headRefOid: 'h3' })
    await watcher.mergeNow('c1')
    expect(gh.state.calls.filter((c) => c[1] === 'merge')).toEqual([
      ['pr', 'merge', '7', '--merge', '--match-head-commit', 'h3']
    ])
  })

  it('règles de la base illisibles : CI supposée et dit, relues plus tard ou sur « Actualiser » (remarque 2)', async () => {
    const { gh, watcher } = setup({ ci: false })
    gh.state.rules = { error: 'HTTP 502: Bad Gateway' }
    gh.pr([])
    expect(await watcher.status('c1')).toMatchObject({ ci: 'awaited', rulesUnreadable: true })
    const apis = () => gh.state.calls.filter((c) => c[0] === 'api').length
    const read = apis()
    // Relève ordinaire peu après : pas de nouvelle lecture.
    await watcher.refresh('c1')
    expect(apis()).toBe(read)
    // « Actualiser » relit tout de suite ; GitHub répond : aucune CI détectée.
    gh.state.rules = []
    expect(await watcher.refreshNow('c1')).toMatchObject({ ci: 'none' })
    expect(await watcher.status('c1')).not.toHaveProperty('rulesUnreadable')
    expect(apis()).toBe(read + 2)
    // Une lecture réussie est gardée.
    await watcher.refreshNow('c1')
    expect(apis()).toBe(read + 2)
    // Sans « Actualiser », relue après 2 min.
    const again = setup({ ci: false })
    again.gh.state.rules = { error: 'timeout' }
    again.gh.pr([])
    await again.watcher.status('c1')
    again.gh.state.rules = []
    await elapse(RULES_RETRY_MS)
    expect(await again.watcher.refresh('c1')).toMatchObject({ ci: 'none' })
  })

  it('fusion d’office ratée : dite tant que le commit est le même, une seule relance si les contrôles changent (remarque 3)', async () => {
    const { gh, watcher } = setup()
    gh.pr(green)
    await watcher.status('c1')
    gh.state.mergeError = 'GraphQL: Base branch was modified. Review and try the merge again.'
    await watcher.setOptions('c1', { autoMerge: true })
    const merges = () => gh.state.calls.filter((c) => c[1] === 'merge').length
    expect(merges()).toBe(1)
    // Relu, même commit, mêmes contrôles : la raison reste, pas de nouvel essai.
    expect(await watcher.refresh('c1')).toMatchObject({ event: { kind: 'merge-failed' } })
    // Un contrôle relancé (contrôles changés, même commit) : la note reste, un seul nouvel essai.
    gh.pr([...green, { name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS' }])
    expect(await watcher.refresh('c1')).toMatchObject({ event: { kind: 'merge-failed' } })
    expect(merges()).toBe(2)
    gh.pr([...green, { name: 'docs', status: 'COMPLETED', conclusion: 'SUCCESS' }])
    expect(await watcher.refresh('c1')).toMatchObject({ event: { kind: 'merge-failed' } })
    expect(merges()).toBe(2)
    // Nouveau commit : nouvel essai, qui passe.
    gh.state.mergeError = ''
    gh.pr(green, { headRefOid: 'h2' })
    await watcher.refresh('c1')
    expect(merges()).toBe(3)
  })

  it('suivi oublié pendant une lecture : ni évènement, ni minuteur (remarque 6)', async () => {
    const { gh, watcher, emitted } = setup()
    gh.pr(pending)
    const reading = watcher.status('c1')
    watcher.forget('c1')
    expect(await reading).toEqual({ status: 'unavailable' })
    expect(emitted).toEqual([])
    await elapse(60 * 60_000)
    expect(gh.views()).toBe(1)
  })

  it('PR ancienne sans contrôle, vue au démarrage : pas « en attente » (remarque 6)', async () => {
    const old = setup({ commitDate: Date.now() - 60 * 60_000 })
    old.gh.pr([])
    expect(await old.watcher.status('c1')).toMatchObject({ ci: 'silent' })
    const recent = setup({ commitDate: Date.now() - 60_000 })
    recent.gh.pr([])
    expect(await recent.watcher.status('c1')).toMatchObject({ ci: 'awaited' })
    // Poussée par l'app : attendue, quelle que soit la date du commit.
    const pushed = setup({ commitDate: Date.now() - 60 * 60_000 })
    pushed.gh.pr([])
    expect(await pushed.watcher.pushed('c1')).toMatchObject({ ci: 'awaited' })
  })

  it('« Fusionner maintenant » : une relecture ratée dit son erreur, pas une raison inventée', async () => {
    const { gh, watcher } = setup({ ci: false })
    gh.pr([])
    await watcher.status('c1')
    gh.state.viewError = 'error connecting to api.github.com'
    await expect(watcher.mergeNow('c1')).rejects.toThrow('error connecting to api.github.com')
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
  })

  it('GitHub dit UNKNOWN sans fin : pas de fusion d’office, la carte finit par le dire', async () => {
    const { gh, watcher } = setup()
    gh.pr(green, { mergeStateStatus: 'UNKNOWN' })
    await watcher.setOptions('c1', { autoMerge: true })
    expect(await watcher.refresh('c1')).not.toHaveProperty('mergeabilityUnreported')
    await elapse(MERGEABILITY_GRACE_MS)
    expect(await watcher.refresh('c1')).toMatchObject({ mergeabilityUnreported: true })
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    // GitHub répond enfin : la fusion part, la mention disparaît.
    gh.pr(green)
    expect(await watcher.refresh('c1')).not.toHaveProperty('mergeabilityUnreported')
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(true)
  })

  it('« Fusionner maintenant » : sans CI seulement, sur clic', async () => {
    const withCi = setup()
    withCi.gh.pr([])
    await withCi.watcher.status('c1')
    await expect(withCi.watcher.mergeNow('c1')).rejects.toThrow()
    const noCi = setup({ ci: false })
    noCi.gh.pr([], { isDraft: true })
    await noCi.watcher.status('c1')
    await expect(noCi.watcher.mergeNow('c1')).rejects.toThrow()
    noCi.gh.pr([])
    await noCi.watcher.refresh('c1')
    // Rien n'était vert : la note le dit autrement que la fusion d'office (0.9.1, D23).
    expect(await noCi.watcher.mergeNow('c1')).toMatchObject({
      event: { kind: 'merged', method: 'merge', noCi: true }
    })
    expect(noCi.gh.state.calls).toContainEqual([
      'pr',
      'merge',
      '7',
      '--merge',
      '--match-head-commit',
      'h1'
    ])
    await elapse(0)
    expect(noCi.watcher.mergedHead('c1')).toBe('h1')
  })

  it('« Fusionner quand tout est vert » : décochée, rien ; cochée, fusion une fois quand c’est prêt', async () => {
    const { gh, watcher, emitted } = setup()
    gh.pr(green)
    await watcher.status('c1')
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    gh.pr(pending)
    await watcher.refresh('c1')
    await watcher.setOptions('c1', { autoMerge: true })
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    gh.pr(green, { mergeable: 'CONFLICTING' })
    await watcher.refresh('c1')
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
    gh.pr(green)
    await watcher.refresh('c1')
    expect(gh.state.calls.filter((c) => c[1] === 'merge')).toEqual([
      ['pr', 'merge', '7', '--merge', '--match-head-commit', 'h1']
    ])
    expect(emitted).toContainEqual(
      expect.objectContaining({ event: { kind: 'merged', method: 'merge' } })
    )
    await elapse(0)
    const last = await watcher.status('c1')
    expect(last.status === 'found' && last.pr.state).toBe('merged')
  })

  it('méthode de fusion : celle que le dépôt permet, dite d’avance sur la carte', async () => {
    const cases = [
      [{ mergeCommitAllowed: false, squashMergeAllowed: true, rebaseMergeAllowed: true }, 'squash'],
      [
        { mergeCommitAllowed: false, squashMergeAllowed: false, rebaseMergeAllowed: true },
        'rebase'
      ],
      [{ mergeCommitAllowed: true, squashMergeAllowed: false, rebaseMergeAllowed: false }, 'merge']
    ] as const
    for (const [repo, method] of cases) {
      const { gh, watcher } = setup()
      gh.state.repo = { ...repo }
      gh.pr(pending)
      await watcher.status('c1')
      expect(await watcher.setOptions('c1', { autoMerge: true })).toMatchObject({
        mergeMethod: method
      })
      gh.pr(green)
      const merged = await watcher.refresh('c1')
      expect(gh.state.calls.filter((c) => c[1] === 'merge')).toEqual([
        ['pr', 'merge', '7', `--${method}`, '--match-head-commit', 'h1']
      ])
      expect(merged).toMatchObject({ event: { kind: 'merged', method } })
      // Lue une seule fois.
      expect(gh.state.calls.filter((c) => c[0] === 'repo')).toHaveLength(1)
    }
  })

  it('aucune méthode de fusion permise : rien ne part, la carte le dit', async () => {
    const { gh, watcher } = setup()
    gh.state.repo = {
      mergeCommitAllowed: false,
      squashMergeAllowed: false,
      rebaseMergeAllowed: false
    }
    gh.pr(green)
    await watcher.status('c1')
    const track = await watcher.setOptions('c1', { autoMerge: true })
    expect(track).toMatchObject({ event: { kind: 'merge-failed' } })
    expect(track.status === 'found' && track.mergeMethod).toBeFalsy()
    expect(gh.state.calls.some((c) => c[1] === 'merge')).toBe(false)
  })

  it('« Corriger » : un envoi raté est dit sur la carte', async () => {
    const { gh, watcher, emitted } = setup({ promptError: 'agent stopped' })
    gh.pr(failing)
    await watcher.status('c1')
    await watcher.fixChecks('c1')
    await elapse(0)
    expect(emitted.at(-1)).toMatchObject({
      event: { kind: 'fix-failed', message: 'agent stopped' }
    })
    expect((await watcher.status('c1')).status === 'found').toBe(true)
  })

  it('fusion refusée par GitHub : dite, pas retentée pour le même commit', async () => {
    const { gh, watcher } = setup()
    gh.pr(green)
    gh.state.mergeError = 'Pull request is not mergeable: base branch policy'
    await watcher.status('c1')
    const track = await watcher.setOptions('c1', { autoMerge: true })
    expect(track).toMatchObject({
      event: { kind: 'merge-failed', message: 'Pull request is not mergeable: base branch policy' }
    })
    await watcher.refresh('c1')
    expect(gh.state.calls.filter((c) => c[1] === 'merge')).toHaveLength(1)
  })

  it('forget : plus de relève', async () => {
    const { gh, watcher } = setup()
    gh.pr(pending)
    await watcher.status('c1')
    watcher.forget('c1')
    await elapse(60 * 60_000)
    expect(gh.views()).toBe(1)
  })
})
