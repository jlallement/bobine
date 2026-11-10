import { describe, expect, it } from 'vitest'
import { parseOnboardingMark, type OnboardingMark } from '@shared/onboarding'
import { closingMark, onboardingDecision, type OnboardingFacts } from './onboarding-state'

const now = new Date('2026-11-07T08:00:00.000Z')

const fresh: OnboardingFacts = {
  mark: undefined,
  settingsExisted: false,
  hasConversations: false,
  recentWorkspaces: 0,
  profileChosen: false,
  testRun: false,
  env: {}
}

const mark = (outcome: OnboardingMark['outcome']): OnboardingMark => ({
  outcome,
  at: '2026-11-06T08:00:00.000Z',
  version: '0.10.0'
})

describe('accueil du premier lancement : quand le montrer (fiche 188)', () => {
  it('toute première fois : montré, marque « en cours » à poser tout de suite', () => {
    expect(onboardingDecision(fresh, now, '0.10.0')).toEqual({
      due: true,
      write: { outcome: 'pending', at: now.toISOString(), version: '0.10.0' }
    })
  })

  it('quitté en cours de route : il reprend, sans réécrire la marque', () => {
    expect(
      onboardingDecision({ ...fresh, mark: mark('pending'), settingsExisted: true }, now, '0.10.0')
    ).toEqual({ due: true })
  })

  it.each(['finished', 'skipped'] as const)('marque « %s » : plus jamais', (outcome) => {
    expect(onboardingDecision({ ...fresh, mark: mark(outcome) }, now, '0.10.0')).toEqual({
      due: false
    })
  })

  it.each([
    ['réglages déjà là (0.9 → 0.10, ou fichier abîmé mis de côté)', { settingsExisted: true }],
    ['conversations dans l’historique', { hasConversations: true }],
    ['dossier récent', { recentWorkspaces: 1 }],
    ['agent déjà choisi', { profileChosen: true }]
  ])('sans marque mais déjà utilisée (%s) : pas d’accueil', (_label, facts) => {
    expect(onboardingDecision({ ...fresh, ...facts }, now, '0.10.0')).toEqual({ due: false })
  })

  it('profil en lecture seule (fiche 196) : jamais, et aucune marque à écrire', () => {
    for (const facts of [{}, { mark: mark('pending') }, { env: { BOBINE_ONBOARDING: '1' } }]) {
      expect(onboardingDecision({ ...fresh, ...facts, readOnly: true }, now, '0.10.0')).toEqual({
        due: false
      })
    }
  })

  it('essais (dossier de données imposé) : jamais, sauf BOBINE_ONBOARDING=1', () => {
    expect(onboardingDecision({ ...fresh, testRun: true }, now, '0.10.0')).toEqual({ due: false })
    expect(
      onboardingDecision(
        { ...fresh, testRun: true, env: { BOBINE_ONBOARDING: '1' } },
        now,
        '0.10.0'
      ).due
    ).toBe(true)
  })
})

describe('marque de fin', () => {
  it('fini ou passé : posé une fois, jamais défait', () => {
    expect(closingMark(mark('pending'), 'finished', now, '0.10.1')).toEqual({
      outcome: 'finished',
      at: now.toISOString(),
      version: '0.10.1'
    })
    expect(closingMark(undefined, 'skipped', now, '0.10.1').outcome).toBe('skipped')
    expect(closingMark(mark('skipped'), 'finished', now, '0.10.1')).toEqual(mark('skipped'))
  })
})

describe('marque lue dans settings.json', () => {
  it('bien formée, ou rien', () => {
    expect(parseOnboardingMark(mark('finished'))).toEqual(mark('finished'))
    expect(parseOnboardingMark({ outcome: 'skipped' })).toEqual({
      outcome: 'skipped',
      at: '',
      version: ''
    })
    for (const raw of [undefined, null, true, 'finished', [], { outcome: 'done' }]) {
      expect(parseOnboardingMark(raw)).toBeUndefined()
    }
  })
})
