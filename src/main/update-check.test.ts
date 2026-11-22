import { describe, expect, it, vi } from 'vitest'
import { releasePageUrl, type UpdateView } from '@shared/update-check'
import {
  createUpdateChecker,
  sanitizeState,
  type FetchOutcome,
  type UpdateCheckerDeps,
  type UpdateState
} from './update-check'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.parse('2026-11-22T09:00:00Z')

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: releasePageUrl(tag),
  draft: false,
  prerelease: tag.includes('-'),
  ...extra
})

/** Un vérificateur dont tout est en mémoire : fichier, heure, réponses, navigateur, journal. */
function harness(
  options: {
    version?: string
    state?: UpdateState
    outcomes?: FetchOutcome[]
    enabled?: boolean
    autoOff?: boolean
    readOnly?: boolean
  } = {}
) {
  let now = T0
  let enabled = options.enabled ?? true
  const outcomes = [...(options.outcomes ?? [])]
  const saved: UpdateState[] = []
  const opened: string[] = []
  const lines: string[] = []
  const views: UpdateView[] = []
  const fetchReleases = vi.fn(async (): Promise<FetchOutcome> => {
    const next = outcomes.shift()
    if (!next) throw new Error('aucune réponse prévue')
    return next
  })
  const deps: UpdateCheckerDeps = {
    version: options.version ?? '1.0.0',
    fetchReleases,
    load: () => options.state ?? {},
    save: (state) => saved.push(state),
    enabled: () => enabled,
    autoOff: options.autoOff ?? false,
    readOnly: () => options.readOnly ?? false,
    openExternal: (url) => opened.push(url),
    now: () => now,
    log: (line) => lines.push(line),
    changed: (view) => views.push(view)
  }
  return {
    checker: createUpdateChecker(deps),
    fetchReleases,
    saved,
    opened,
    lines,
    views,
    advance: (ms: number) => (now += ms),
    setEnabled: (value: boolean) => (enabled = value)
  }
}

const ok = (...tags: string[]): FetchOutcome => ({ ok: true, json: tags.map((t) => release(t)) })

describe('avis de nouvelle version — quand vérifier (fiche 274)', () => {
  it('au lancement : une requête, puis plus rien pendant 24 h, de nouveau ensuite', async () => {
    const h = harness({ outcomes: [ok('v1.0.0'), ok('v1.0.1')] })
    await h.checker.checkOnLaunch()
    expect(h.fetchReleases).toHaveBeenCalledTimes(1)
    expect(h.saved.at(-1)?.lastCheckedAt).toBe(new Date(T0).toISOString())
    expect(h.checker.view().available).toBeNull()

    h.advance(DAY - 1)
    await h.checker.checkOnLaunch()
    expect(h.fetchReleases).toHaveBeenCalledTimes(1)

    h.advance(1)
    await h.checker.checkOnLaunch()
    expect(h.fetchReleases).toHaveBeenCalledTimes(2)
    expect(h.checker.view().available?.version).toBe('1.0.1')
  })

  it('dernière vérification gardée dans le profil : rien avant 24 h après une relance', async () => {
    const h = harness({ state: { lastCheckedAt: new Date(T0 - DAY / 2).toISOString() } })
    await h.checker.checkOnLaunch()
    expect(h.fetchReleases).not.toHaveBeenCalled()
  })

  it('une date dans le futur (horloge changée) ne bloque pas la vérification', async () => {
    const h = harness({
      state: { lastCheckedAt: new Date(T0 + 10 * DAY).toISOString() },
      outcomes: [ok('v1.0.0')]
    })
    await h.checker.checkOnLaunch()
    expect(h.fetchReleases).toHaveBeenCalledTimes(1)
  })

  it('réglage coupé, coupure des essais ou lecture seule : aucune requête automatique', async () => {
    for (const options of [{ enabled: false }, { autoOff: true }, { readOnly: true }]) {
      const h = harness(options)
      await h.checker.checkOnLaunch()
      expect(h.fetchReleases, JSON.stringify(options)).not.toHaveBeenCalled()
    }
  })

  it('« Vérifier maintenant » : même réglage coupé, même avant 24 h', async () => {
    const h = harness({
      enabled: false,
      state: { lastCheckedAt: new Date(T0).toISOString() },
      outcomes: [ok('v1.0.0')]
    })
    const view = await h.checker.checkNow()
    expect(h.fetchReleases).toHaveBeenCalledTimes(1)
    expect(view.manual).toEqual({ result: 'up-to-date' })
    expect(view.enabled).toBe(false)
  })

  it('deux demandes à la fois : une seule requête', async () => {
    const h = harness({ outcomes: [ok('v1.0.1')] })
    const [a, b] = await Promise.all([h.checker.checkNow(), h.checker.checkNow()])
    expect(h.fetchReleases).toHaveBeenCalledTimes(1)
    expect(a.available?.version).toBe('1.0.1')
    expect(b.available?.version).toBe('1.0.1')
  })
})

describe('avis de nouvelle version — silence en cas d’échec (fiche 274)', () => {
  it('automatique : rien d’affiché, une ligne au journal, date inchangée, réessai au lancement suivant', async () => {
    for (const failure of ['offline', 'limit', 'unreadable'] as const) {
      const h = harness({ outcomes: [{ ok: false, failure }, ok('v1.0.1')] })
      await h.checker.checkOnLaunch()
      const view = h.checker.view()
      expect(view.available).toBeNull()
      expect(view.manual).toBeNull()
      expect(view.lastCheckedAt).toBeNull()
      expect(h.saved).toEqual([])
      expect(h.lines).toEqual([`[update-check] échec : ${failure}`])
      await h.checker.checkOnLaunch()
      expect(h.checker.view().available?.version).toBe('1.0.1')
    }
  })

  it('requête qui lève une erreur : hors ligne, sans planter', async () => {
    const h = harness()
    await expect(h.checker.checkOnLaunch()).resolves.toBeUndefined()
    expect(h.lines).toEqual(['[update-check] échec : offline'])
  })

  it('réponse illisible (pas une liste) : échec, rien de gardé', async () => {
    const h = harness({ outcomes: [{ ok: true, json: { message: 'Not Found' } }] })
    const view = await h.checker.checkNow()
    expect(view.manual).toEqual({ result: 'failed', failure: 'unreadable' })
    expect(h.saved).toEqual([])
  })

  it('à la main : l’échec est dit, avec sa raison courte', async () => {
    const h = harness({ outcomes: [{ ok: false, failure: 'limit' }] })
    expect((await h.checker.checkNow()).manual).toEqual({ result: 'failed', failure: 'limit' })
  })

  it('Release à la page inattendue : écartée, notée au journal', async () => {
    const h = harness({
      outcomes: [
        {
          ok: true,
          json: [release('v2.0.0', { html_url: 'https://evil.example/x' }), release('v1.0.1')]
        }
      ]
    })
    await h.checker.checkOnLaunch()
    expect(h.checker.view().available?.version).toBe('1.0.1')
    expect(h.lines).toContain('[update-check] Release v2.0.0 écartée : page inattendue')
  })
})

describe('avis de nouvelle version — une fois par version (fiche 274)', () => {
  it('« Plus tard » : masqué pour cette version, même relu du profil ; une plus récente revient', async () => {
    const h = harness({ outcomes: [ok('v1.0.1'), ok('v1.0.2', 'v1.0.1')] })
    await h.checker.checkNow()
    h.checker.dismiss('1.0.1')
    expect(h.checker.view().dismissed).toBe(true)
    const kept = h.saved.at(-1) ?? {}
    expect(kept.dismissed).toBe('1.0.1')

    // Relance : le profil relu garde le choix.
    const again = harness({ state: sanitizeState(JSON.parse(JSON.stringify(kept)), '1.0.0') })
    expect(again.checker.view()).toMatchObject({ dismissed: true, available: { version: '1.0.1' } })

    h.advance(DAY)
    await h.checker.checkNow()
    expect(h.checker.view()).toMatchObject({ dismissed: false, available: { version: '1.0.2' } })
  })

  it('« Voir » : ouvre la page vérifiée, et masque l’avis pour cette version', async () => {
    const h = harness({ outcomes: [ok('v1.0.1')] })
    await h.checker.checkNow()
    h.checker.open('1.0.1')
    expect(h.opened).toEqual(['https://github.com/jlallement/bobine/releases/tag/v1.0.1'])
    expect(h.checker.view().dismissed).toBe(true)
    expect(h.saved.at(-1)?.dismissed).toBe('1.0.1')
  })

  it('« Voir » d’une version inconnue : refusé, rien d’ouvert', async () => {
    const h = harness({ outcomes: [ok('v1.0.1')] })
    await h.checker.checkNow()
    expect(() => h.checker.open('9.9.9')).toThrow()
    h.checker.dismiss('9.9.9')
    expect(h.opened).toEqual([])
    expect(h.checker.view().dismissed).toBe(false)
  })

  it('profil en lecture seule : rien d’écrit, l’état reste en mémoire', async () => {
    const h = harness({ readOnly: true, outcomes: [ok('v1.0.1')] })
    await h.checker.checkNow()
    h.checker.dismiss('1.0.1')
    expect(h.saved).toEqual([])
    expect(h.checker.view()).toMatchObject({ dismissed: true, available: { version: '1.0.1' } })
  })

  it('réglage changé : l’état renvoyé dit si la vérification est active', () => {
    const h = harness()
    h.setEnabled(false)
    h.checker.settingsChanged()
    expect(h.views.at(-1)?.enabled).toBe(false)
  })
})

describe('état du profil relu (fiche 274)', () => {
  it('ce qui ne tient pas est ignoré, sans erreur', () => {
    expect(sanitizeState(null, '1.0.0')).toEqual({})
    expect(sanitizeState('x', '1.0.0')).toEqual({})
    expect(
      sanitizeState(
        { lastCheckedAt: 'hier', dismissed: '<b>', available: { version: 'x' } },
        '1.0.0'
      )
    ).toEqual({})
  })

  it('adresse gardée revérifiée : une page d’ailleurs est oubliée', () => {
    const state = sanitizeState(
      {
        available: { version: '1.0.1', prerelease: false, url: 'https://evil.example/tag/v1.0.1' }
      },
      '1.0.0'
    )
    expect(state.available).toBeUndefined()
  })

  it('version déjà installée (mise à jour faite) : plus d’avis', () => {
    const available = { version: '1.0.1', prerelease: false, url: releasePageUrl('v1.0.1') }
    expect(sanitizeState({ available }, '1.0.0').available).toEqual(available)
    expect(sanitizeState({ available }, '1.0.1').available).toBeUndefined()
  })
})
