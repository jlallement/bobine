import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RULES_UNAVAILABLE,
  branchRequiredChecks,
  logExcerpt,
  mergeWait,
  noCiDetected,
  parsePrView,
  readyToMerge,
  rulesRequiredChecks
} from '@shared/pr-tracking'

/** Sorties réelles de `gh`, réduites et anonymisées (`fixtures/gh/README.md`, fiche 176). */
const real = (name: string) => readFileSync(join(__dirname, 'fixtures', 'gh', name), 'utf8')

describe('sorties réelles de gh (fiche 176)', () => {
  it('sorties réelles de gh pr view : chaque champ lu a la forme attendue', () => {
    const failed = parsePrView(real('pr-view-failed-draft.json'))
    expect(failed).toMatchObject({
      number: 14927,
      state: 'open',
      draft: true,
      summary: 'failed',
      review: 'review-required',
      mergeable: 'mergeable'
    })
    expect(failed.head).toMatch(/^[0-9a-f]{40}$/)
    expect(failed.checks[0]).toMatchObject({
      name: 'Unit and Integration Tests / build (windows-latest)',
      state: 'failed',
      jobId: '126212878432'
    })
    expect(failed.checks.map((c) => c.state)).toContain('skipped')
    expect(readyToMerge(failed)).toBe(false)

    const green = parsePrView(real('pr-view-passing-approved.json'))
    expect(green).toMatchObject({ summary: 'passed', review: 'approved', draft: false })
    expect(readyToMerge(green)).toBe(true)

    expect(parsePrView(real('pr-view-merged.json'))).toMatchObject({
      state: 'merged',
      mergeable: 'unknown'
    })

    const asked = parsePrView(real('pr-view-changes-requested.json'))
    // 3 commentaires du fil + 2 relectures avec un avis ou un texte (pas la troisième, vide).
    expect(asked).toMatchObject({ review: 'changes-requested', comments: 5 })
    expect(readyToMerge(asked)).toBe(false)

    const statuses = parsePrView(real('pr-view-status-contexts.json'))
    expect(statuses.checks.map((c) => [c.name, c.state])).toEqual([
      ['tide', 'pending'],
      ['EasyCLA', 'passed']
    ])
    expect(statuses.checks[0]?.jobId).toBeUndefined()
  })

  it('journal réel d’un job en échec : l’extrait garde les échecs, pas le nettoyage de fin', () => {
    const excerpt = logExcerpt(real('run-log-failed.txt'))
    expect(excerpt).toContain(
      '--- FAIL: TestResetExperimentDetachesIntegrationWithoutDeletingAccounts'
    )
    expect(excerpt).toContain('Error: unknown flag: --anything')
    expect(excerpt).toContain('##[error]Process completed with exit code 1.')
    expect(excerpt).not.toContain('Cleaning up orphan processes')
    expect(excerpt).not.toMatch(/\d{4}-\d\d-\d\dT/)
    expect(excerpt).not.toContain('build (windows-latest)\t')
  })

  it('vrai journal de gh : couleurs en notation caret ôtées (0.9.1, D18)', () => {
    const raw = real('run-log-failed-caret.txt')
    expect(raw).toContain('^[[36;1m')
    const excerpt = logExcerpt(raw)
    expect(excerpt).not.toContain('^[')
    expect(excerpt).not.toContain('[0m')
    expect(excerpt).toContain('sleep 20')
    expect(excerpt).toContain('if [ -f FAIL ]; then')
    expect(excerpt).toContain('Error: expected no FAIL file')
  })

  it('recette 0.9 : journal coloré, PR sans contrôle, PR en conflit (0.9.1)', () => {
    const excerpt = logExcerpt(real('run-log-failed-ansi.txt'))
    expect(excerpt).not.toContain('\u001b')
    expect(excerpt).toContain('sleep 20')
    expect(excerpt).toContain('Error: expected no FAIL file')
    expect(excerpt).toContain('##[error]Process completed with exit code 1.')

    const fresh = parsePrView(real('pr-view-fresh-no-checks.json'))
    expect(fresh).toMatchObject({ summary: 'none', mergeable: 'unknown', checks: [] })
    expect(readyToMerge(fresh)).toBe(false)
    expect(mergeWait(fresh, 'awaited')).toBe('awaited')
    expect(mergeWait(fresh, 'none')).toBe('no-ci')

    const conflicting = parsePrView(real('pr-view-conflicting.json'))
    expect(conflicting.mergeable).toBe('conflicting')
    expect(mergeWait(conflicting)).toBe('conflicting')
  })

  it('règles de la base : contrôles requis lus de la protection et des rulesets (remarque 1)', () => {
    expect(branchRequiredChecks(real('branch-protected.json'))).toEqual([
      'build (macos-latest)',
      'build (ubuntu-latest)',
      'build (windows-latest)'
    ])
    expect(branchRequiredChecks(real('branch-unprotected.json'))).toEqual([])
    expect(rulesRequiredChecks(real('rules-required-checks.json'))).toEqual([
      'thank you, next',
      'thank you, build',
      'Potentially publish release'
    ])
    expect(rulesRequiredChecks(real('rules-none.json'))).toEqual([])
    expect(RULES_UNAVAILABLE.test(real('rules-unavailable.txt'))).toBe(true)
    expect(branchRequiredChecks('<html>')).toBeUndefined()
    expect(rulesRequiredChecks('{"message":"x"}')).toBeUndefined()

    const fresh = parsePrView(real('pr-view-fresh-no-checks.json'))
    const none = { workflows: false, required: [] }
    expect(noCiDetected(fresh, none)).toBe(true)
    expect(noCiDetected(fresh, { ...none, workflows: true })).toBe(false)
    expect(noCiDetected(fresh, { ...none, required: undefined })).toBe(false)
    expect(noCiDetected(fresh, { ...none, required: ['ci/circleci'] })).toBe(false)
    expect(noCiDetected({ ...fresh, mergeState: 'blocked' }, none)).toBe(false)
    // Bloquée par une relecture demandée : ce n'est pas une CI.
    expect(noCiDetected({ ...fresh, mergeState: 'blocked', review: 'review-required' }, none)).toBe(
      true
    )
  })
})
