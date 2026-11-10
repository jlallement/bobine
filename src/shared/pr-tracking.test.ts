import { describe, expect, it } from 'vitest'
import {
  POLL_FAST_MS,
  POLL_MAX_MS,
  POLL_MIN_MS,
  POLL_PENDING_MS,
  canMergeNow,
  checksKey,
  checksSummary,
  fixChecksPrompt,
  logExcerpt,
  mergeWait,
  nextDelay,
  parseCheck,
  parsePrView,
  pickMergeMethod,
  readyToMerge
} from './pr-tracking'

/** JSON de `gh pr view --json …` tel que GitHub le rend (formes réelles des deux contrôles). */
function ghPrJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    number: 7,
    url: 'https://github.com/o/r/pull/7',
    title: 'Page de démo',
    state: 'OPEN',
    isDraft: false,
    headRefOid: 'abc123',
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: '',
    comments: [{ body: 'Merci' }],
    reviews: [
      { state: 'COMMENTED', body: '' },
      { state: 'COMMENTED', body: 'Une remarque' },
      { state: 'APPROVED', body: '' }
    ],
    statusCheckRollup: [
      {
        __typename: 'CheckRun',
        name: 'test',
        workflowName: 'CI',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
        detailsUrl: 'https://github.com/o/r/actions/runs/11/job/22'
      },
      {
        __typename: 'CheckRun',
        name: 'lint',
        workflowName: 'CI',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: 'https://github.com/o/r/actions/runs/11/job/23'
      },
      {
        __typename: 'StatusContext',
        context: 'deploy/preview',
        state: 'PENDING',
        targetUrl: 'https://preview.example/7'
      }
    ],
    ...over
  })
}

describe('suivi de la PR (fiche 176)', () => {
  it('contrôles : CheckRun et StatusContext ramenés à quatre états', () => {
    expect(parseCheck({ name: 'a', status: 'IN_PROGRESS', conclusion: '' })?.state).toBe('pending')
    expect(parseCheck({ name: 'a', status: 'QUEUED' })?.state).toBe('pending')
    expect(parseCheck({ name: 'a', status: 'COMPLETED', conclusion: 'SUCCESS' })?.state).toBe(
      'passed'
    )
    for (const c of ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']) {
      expect(parseCheck({ name: 'a', status: 'COMPLETED', conclusion: c })?.state).toBe('failed')
    }
    expect(parseCheck({ name: 'a', status: 'COMPLETED', conclusion: 'SKIPPED' })?.state).toBe(
      'skipped'
    )
    expect(parseCheck({ context: 'ci/x', state: 'ERROR' })?.state).toBe('failed')
    expect(parseCheck({ context: 'ci/x', state: 'SUCCESS' })?.state).toBe('passed')
    expect(parseCheck({ context: 'ci/x', state: 'EXPECTED' })?.state).toBe('pending')
    expect(parseCheck({ status: 'COMPLETED' })).toBeUndefined()
    expect(parseCheck(null)).toBeUndefined()
    expect(
      parseCheck({
        name: 'test',
        workflowName: 'CI',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
        detailsUrl: 'https://github.com/o/r/actions/runs/11/job/22'
      })
    ).toEqual({
      name: 'CI / test',
      state: 'failed',
      url: 'https://github.com/o/r/actions/runs/11/job/22',
      jobId: '22'
    })
  })

  it('lit la PR : état, contrôles en échec d’abord, commentaires, relecture, conflits', () => {
    const pr = parsePrView(ghPrJson())
    expect(pr).toMatchObject({
      number: 7,
      state: 'open',
      draft: false,
      head: 'abc123',
      summary: 'failed',
      // 1 commentaire + 2 relectures (celle sans texte ni avis ne compte pas).
      comments: 3,
      mergeable: 'mergeable'
    })
    expect(pr.review).toBeUndefined()
    expect(pr.checks.map((c) => [c.name, c.state])).toEqual([
      ['CI / test', 'failed'],
      ['deploy/preview', 'pending'],
      ['CI / lint', 'passed']
    ])
    const merged = parsePrView(
      ghPrJson({
        state: 'MERGED',
        mergeable: 'UNKNOWN',
        reviewDecision: 'CHANGES_REQUESTED',
        statusCheckRollup: null,
        comments: null,
        reviews: null
      })
    )
    expect(merged).toMatchObject({
      state: 'merged',
      summary: 'none',
      comments: 0,
      review: 'changes-requested',
      mergeable: 'unknown'
    })
    expect(() => parsePrView('{}')).toThrow()
    expect(() => parsePrView('pas du json')).toThrow()
  })

  it('un contrôle relancé compte une fois : le dernier essai', () => {
    const pr = parsePrView(
      ghPrJson({
        statusCheckRollup: [
          { name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' },
          { name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }
        ]
      })
    )
    expect(pr.checks).toEqual([{ name: 'test', state: 'passed' }])
    expect(pr.summary).toBe('passed')
  })

  it('résumé des contrôles', () => {
    expect(checksSummary([])).toBe('none')
    expect(
      checksSummary([
        { name: 'a', state: 'passed' },
        { name: 'b', state: 'skipped' }
      ])
    ).toBe('passed')
    expect(
      checksSummary([
        { name: 'a', state: 'passed' },
        { name: 'b', state: 'pending' }
      ])
    ).toBe('pending')
    expect(
      checksSummary([
        { name: 'a', state: 'pending' },
        { name: 'b', state: 'failed' }
      ])
    ).toBe('failed')
  })

  it('« Fusionner quand tout est vert » : seulement ouverte, prête, verte, sans relecture en attente', () => {
    const green = parsePrView(
      ghPrJson({ statusCheckRollup: [{ name: 't', status: 'COMPLETED', conclusion: 'SUCCESS' }] })
    )
    expect(readyToMerge(green)).toBe(true)
    expect(readyToMerge({ ...green, draft: true })).toBe(false)
    expect(readyToMerge({ ...green, mergeable: 'conflicting' })).toBe(false)
    expect(readyToMerge({ ...green, mergeable: 'unknown' })).toBe(false)
    expect(readyToMerge({ ...green, summary: 'pending' })).toBe(false)
    expect(readyToMerge({ ...green, summary: 'none' })).toBe(false)
    expect(readyToMerge({ ...green, review: 'changes-requested' })).toBe(false)
    expect(readyToMerge({ ...green, review: 'review-required' })).toBe(false)
    expect(readyToMerge({ ...green, review: 'approved' })).toBe(true)
    expect(readyToMerge({ ...green, state: 'merged' })).toBe(false)
  })

  it('extrait du journal : dernières lignes, sans colonnes ni horodatage, borné', () => {
    const log = [
      'test\tSet up job\t2026-11-06T10:00:00.0000000Z Starting',
      'test\tRun tests\t2026-11-06T10:00:01.1234567Z FAIL src/a.test.ts',
      'test\tRun tests\t2026-11-06T10:00:01.2000000Z   expected 1 to be 2',
      ''
    ].join('\n')
    expect(logExcerpt(log)).toBe('Starting\nFAIL src/a.test.ts\n  expected 1 to be 2')
    const long = Array.from({ length: 200 }, (_, i) => `ligne ${i}`).join('\n')
    const tail = logExcerpt(long).split('\n')
    expect(tail).toHaveLength(60)
    expect(tail.at(-1)).toBe('ligne 199')
    expect(logExcerpt('x'.repeat(10_000)).length).toBeLessThanOrEqual(4001)
  })

  it('consigne en anglais : chaque contrôle, son lien, son extrait', () => {
    const text = fixChecksPrompt({ number: 7, url: 'https://github.com/o/r/pull/7' }, 'bobine/x', [
      { name: 'CI / test', state: 'failed', url: 'https://x/job/22', log: 'FAIL a.test.ts' },
      { name: 'ci/ext', state: 'failed' }
    ])
    expect(text).toContain('pull request #7 (https://github.com/o/r/pull/7)')
    expect(text).toContain('`bobine/x`')
    expect(text).toContain('### CI / test — https://x/job/22')
    expect(text).toContain('```\nFAIL a.test.ts\n```')
    expect(text).toContain('### ci/ext\n\n(no log available')
    expect(text).toContain('push to the same branch')
  })

  it('cadence : 30 s tant que ça tourne ou que ça change, sinon doublée jusqu’à 10 min', () => {
    expect(nextDelay(undefined, true, false)).toBe(POLL_PENDING_MS)
    expect(nextDelay(undefined, false, false)).toBe(POLL_MIN_MS)
    expect(nextDelay(POLL_MIN_MS, false, false)).toBe(2 * POLL_MIN_MS)
    expect(nextDelay(POLL_PENDING_MS, false, false)).toBe(POLL_MIN_MS)
    expect(nextDelay(8 * POLL_MIN_MS, false, false)).toBe(POLL_MAX_MS)
    expect(nextDelay(POLL_MAX_MS, false, false)).toBe(POLL_MAX_MS)
    expect(nextDelay(POLL_MAX_MS, false, true)).toBe(POLL_PENDING_MS)
    // Juste après un push : 10 s, quoi qu'il arrive (0.9.1, D16).
    expect(nextDelay(POLL_MAX_MS, false, false, true)).toBe(POLL_FAST_MS)
    expect(nextDelay(undefined, true, true, true)).toBe(POLL_FAST_MS)
  })

  it('extrait du journal : les couleurs en notation caret, pas le texte qui leur ressemble', () => {
    const log = [
      "test\tRun\t2026-11-06T10:00:01.1Z ^[[36;1mgrep -q '^[[:space:]]' a.txt^[[0m",
      'test\tRun\t2026-11-06T10:00:02.1Z Error: ^[[1;31mexpected^[[m [[x]]'
    ].join('\n')
    expect(logExcerpt(log)).toBe("grep -q '^[[:space:]]' a.txt\nError: expected [[x]]")
  })

  it('extrait du journal : sans les couleurs du terminal (0.9.1, D18)', () => {
    const log =
      'test\tRun\t2026-11-06T10:00:01.1Z \u001b[36;1mnpm test\u001b[0m\ntest\tRun\t2026-11-06T10:00:02.1Z \u001b[31mFAIL\u001b[0m a.test.ts'
    expect(logExcerpt(log)).toBe('npm test\nFAIL a.test.ts')
  })

  it('pourquoi la fusion d’office attend : la raison la plus bloquante d’abord (0.9.1, D20)', () => {
    const green = parsePrView(
      ghPrJson({ statusCheckRollup: [{ name: 't', status: 'COMPLETED', conclusion: 'SUCCESS' }] })
    )
    expect(mergeWait(green)).toBeUndefined()
    expect(mergeWait({ ...green, state: 'merged' })).toBeUndefined()
    expect(mergeWait({ ...green, draft: true, mergeable: 'conflicting' })).toBe('draft')
    expect(mergeWait({ ...green, mergeable: 'conflicting', review: 'review-required' })).toBe(
      'conflicting'
    )
    expect(mergeWait({ ...green, review: 'changes-requested', summary: 'failed' })).toBe(
      'changes-requested'
    )
    expect(mergeWait({ ...green, review: 'review-required', summary: 'failed' })).toBe(
      'review-required'
    )
    expect(mergeWait({ ...green, summary: 'failed' })).toBe('failed')
    expect(mergeWait({ ...green, summary: 'pending' })).toBe('pending')
    const none = { ...green, summary: 'none' as const, checks: [] }
    expect(mergeWait(none)).toBe('awaited')
    expect(mergeWait(none, 'awaited')).toBe('awaited')
    expect(mergeWait(none, 'silent')).toBe('silent')
    expect(mergeWait(none, 'none')).toBe('no-ci')
    expect(mergeWait({ ...green, mergeable: 'unknown' })).toBe('mergeability')
  })

  it('état de fusion de GitHub : lu, et pris en compte par la fusion d’office', () => {
    const green = parsePrView(
      ghPrJson({
        mergeStateStatus: 'CLEAN',
        baseRefName: 'trunk',
        statusCheckRollup: [{ name: 't', status: 'COMPLETED', conclusion: 'SUCCESS' }]
      })
    )
    expect(green).toMatchObject({ mergeState: 'clean', base: 'trunk' })
    expect(readyToMerge(green)).toBe(true)
    expect(parsePrView(ghPrJson({ mergeStateStatus: 'HAS_HOOKS' })).mergeState).toBe('clean')
    expect(parsePrView(ghPrJson({ mergeStateStatus: 'WHATEVER' })).mergeState).toBe('unknown')
    for (const state of ['blocked', 'behind', 'dirty'] as const) {
      expect(readyToMerge({ ...green, mergeState: state })).toBe(false)
    }
    expect(readyToMerge({ ...green, mergeState: 'unstable' })).toBe(true)
    // GitHub calcule encore : pas de fusion d'office (remarque 9).
    expect(readyToMerge({ ...green, mergeState: 'unknown' })).toBe(false)
    expect(mergeWait({ ...green, mergeState: 'blocked' })).toBe('blocked')
    expect(mergeWait({ ...green, mergeState: 'behind' })).toBe('behind')
    expect(mergeWait({ ...green, mergeState: 'dirty' })).toBe('conflicting')
    // Sans CI détectée, l'obstacle de GitHub passe avant « fusionnez quand vous voulez ».
    const none = { ...green, checks: [], summary: 'none' as const }
    expect(mergeWait({ ...none, mergeState: 'behind' }, 'none')).toBe('behind')
    expect(mergeWait(none, 'none')).toBe('no-ci')
  })

  it('« Fusionner maintenant » : seulement sans CI, et sans autre obstacle', () => {
    const none = {
      ...parsePrView(ghPrJson({ mergeStateStatus: 'CLEAN' })),
      checks: [],
      summary: 'none' as const
    }
    expect(canMergeNow(none, 'none')).toBe(true)
    expect(canMergeNow(none, 'awaited')).toBe(false)
    expect(canMergeNow(none, 'silent')).toBe(false)
    expect(canMergeNow(none)).toBe(false)
    expect(canMergeNow({ ...none, draft: true }, 'none')).toBe(false)
    expect(canMergeNow({ ...none, mergeable: 'conflicting' }, 'none')).toBe(false)
    expect(canMergeNow({ ...none, mergeable: 'unknown' }, 'none')).toBe(false)
    expect(canMergeNow({ ...none, review: 'review-required' }, 'none')).toBe(false)
    expect(canMergeNow({ ...none, state: 'merged' }, 'none')).toBe(false)
    for (const state of ['blocked', 'behind', 'dirty', 'unknown'] as const) {
      expect(canMergeNow({ ...none, mergeState: state }, 'none')).toBe(false)
    }
  })

  it('une note vaut pour un commit et un état des contrôles (0.9.1, D17)', () => {
    const pr = parsePrView(ghPrJson())
    expect(checksKey(pr)).toBe(checksKey({ ...pr, comments: 9 }))
    expect(checksKey(pr)).not.toBe(checksKey({ ...pr, head: 'other' }))
    expect(checksKey(pr)).not.toBe(
      checksKey({ ...pr, checks: pr.checks.map((c) => ({ ...c, state: 'passed' as const })) })
    )
  })

  it('méthode de fusion : commit de fusion, sinon squash, sinon rebase', () => {
    const repo = (merge: boolean, squash: boolean, rebase: boolean) =>
      JSON.stringify({
        mergeCommitAllowed: merge,
        squashMergeAllowed: squash,
        rebaseMergeAllowed: rebase
      })
    expect(pickMergeMethod(repo(true, true, true))).toBe('merge')
    expect(pickMergeMethod(repo(false, true, true))).toBe('squash')
    expect(pickMergeMethod(repo(false, false, true))).toBe('rebase')
    expect(pickMergeMethod(repo(false, false, false))).toBeUndefined()
    expect(pickMergeMethod('pas du json')).toBeUndefined()
  })
})
