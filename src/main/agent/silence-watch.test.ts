import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { OPENCODE_RETRY_STATUS } from './opencode-retry'
import { silenceBannerMs, TurnQuiet, watchSilence } from './silence-watch'

describe('silence de l’agent pendant un tour (fiche 194)', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }))
  afterEach(() => vi.useRealTimers())

  function watch(waiting = () => false) {
    const activity = { last: 0, progress: 0 }
    const calls: (number | undefined)[] = []
    const timer = watchSilence({
      activity,
      waiting,
      scope: '[essai]',
      onSilent: (since) => calls.push(since)
    })
    return {
      calls,
      speak: (at: number) => (activity.last = activity.progress = at),
      stop: () => clearInterval(timer)
    }
  }

  it('bandeau au bout de 5 min de silence, pas avant ; parti quand l’agent reparle', () => {
    const w = watch()
    vi.advanceTimersByTime(4 * 60_000 + 59_000)
    expect(w.calls).toEqual([])
    vi.advanceTimersByTime(15_000)
    expect(w.calls).toEqual([0])
    w.speak(Date.now())
    vi.advanceTimersByTime(15_000)
    expect(w.calls).toEqual([0, undefined])
    w.stop()
  })

  it('l’agent attend l’utilisateur (autorisation, question) : pas de bandeau', () => {
    const w = watch(() => true)
    vi.advanceTimersByTime(20 * 60_000)
    expect(w.calls).toEqual([])
    w.stop()
  })

  it('après une longue autorisation : le silence se compte depuis la réponse de l’utilisateur', () => {
    let waiting = true
    const w = watch(() => waiting)
    vi.advanceTimersByTime(10 * 60_000)
    waiting = false
    const answeredAt = Date.now()
    vi.advanceTimersByTime(4 * 60_000)
    expect(w.calls).toEqual([])
    vi.advanceTimersByTime(61_000)
    expect(w.calls).toHaveLength(1)
    // Depuis la fin de l'attente (à un contrôle près), pas depuis le dernier octet d'il y a 15 min.
    expect(answeredAt - (w.calls[0] ?? 0)).toBeLessThanOrEqual(15_000)
    w.stop()
  })

  it('silence d’avant le tour (agent resté prêt longtemps) : compté depuis le début du tour', () => {
    vi.setSystemTime(60 * 60_000)
    // Dernière avancée il y a une heure : rien au premier contrôle, bandeau 5 min après le début.
    const w = watch()
    const startedAt = Date.now()
    vi.advanceTimersByTime(4 * 60_000)
    expect(w.calls).toEqual([])
    vi.advanceTimersByTime(61_000)
    expect(w.calls).toEqual([startedAt])
    w.stop()
  })

  it('mises à jour d’état seules (agent qui réessaie) : bandeau quand même, journal qui les cite', async () => {
    const { log } = await import('../log')
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined)
    const activity = { last: 0, progress: 0 }
    const calls: (number | undefined)[] = []
    const timer = watchSilence({
      activity,
      waiting: () => false,
      scope: '[essai]',
      onSilent: (since) => calls.push(since)
    })
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(30_000)
      activity.last = Date.now()
    }
    expect(calls).toEqual([0])
    expect(warn.mock.calls.map(([line]) => line)).toContainEqual(
      expect.stringMatching(
        /rien envoyé depuis 60.0 s \(mises à jour d’état seules, la dernière il y a \d/
      )
    )
    clearInterval(timer)
    warn.mockRestore()
  })

  it('seuil imposé par `BOBINE_SILENCE_MS` (essais), sinon 5 min', () => {
    expect(silenceBannerMs({})).toBe(300_000)
    expect(silenceBannerMs({ BOBINE_SILENCE_MS: '2000' })).toBe(2000)
    expect(silenceBannerMs({ BOBINE_SILENCE_MS: 'non' })).toBe(300_000)
  })
})

describe('bandeaux du tour (fiche 275)', () => {
  const retry = (attempt: number | null) =>
    ({
      sessionUpdate: 'session_info_update',
      _meta: { 'opencode/retry': attempt === null ? null : { attempt, error: { message: 'x' } } }
    }) as SessionUpdate

  it('reprise lue par le profil ; `null` la garde ; l’agent qui avance l’efface', () => {
    let changes = 0
    const quiet = new TurnQuiet({ retryStatus: OPENCODE_RETRY_STATUS, changed: () => changes++ })
    quiet.proxy = 'http://jean:s3cr3t@proxy:3128'
    expect(quiet.view()).toEqual({})
    quiet.noteUpdate(retry(2))
    expect(quiet.view()).toEqual({
      unreachable: { attempt: 2, message: 'x' },
      proxy: 'http://•••@proxy:3128'
    })
    quiet.noteUpdate(retry(null))
    quiet.noteUpdate(retry(2))
    expect(changes).toBe(1)
    quiet.note(false)
    expect(quiet.view().unreachable).toBeDefined()
    quiet.note(true)
    expect(quiet.view()).toEqual({})
    expect(changes).toBe(2)
  })

  it('sans source de reprises : rien de lu', () => {
    const quiet = new TurnQuiet({ changed: () => undefined })
    quiet.noteUpdate(retry(3))
    expect(quiet.view()).toEqual({})
  })
})

describe('réglages réseau changés depuis le lancement (fiche 276)', () => {
  const retry = {
    sessionUpdate: 'session_info_update',
    _meta: { 'opencode/retry': { attempt: 2, error: { message: 'x' } } }
  } as SessionUpdate
  /** Réglages réseau de l'app : variables d'un lancement maintenant, abonnés prévenus. */
  function settings(env: Record<string, string> = {}) {
    const listeners = new Set<() => void>()
    return {
      env,
      listeners,
      source: {
        env: () => settings.current,
        onChange: (listener: () => void) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      save(next: Record<string, string>) {
        settings.current = next
        for (const listener of [...listeners]) listener()
      }
    }
  }
  settings.current = {} as Record<string, string>

  it('dit `networkStale` seulement avec un bandeau, et quand le réseau diffère', () => {
    let changes = 0
    settings.current = {}
    const app = settings()
    const quiet = new TurnQuiet({ retryStatus: OPENCODE_RETRY_STATUS, changed: () => changes++ })
    quiet.launch({}, {}, app.source)
    // Pas de bandeau : rien à dire, personne n'écoute les réglages.
    app.save({ HTTPS_PROXY: 'http://proxy:3128' })
    expect(quiet.view()).toEqual({})
    expect(app.listeners.size).toBe(0)
    expect(changes).toBe(0)
    quiet.noteUpdate(retry)
    expect(quiet.view()).toMatchObject({ unreachable: { attempt: 2 }, networkStale: true })
    expect(app.listeners.size).toBe(1)
    // Réglages enregistrés pendant le bandeau : il se redit aussitôt ; revenus à ceux du lancement,
    // plus rien à relancer.
    app.save({})
    expect(changes).toBe(2)
    expect(quiet.view().networkStale).toBeUndefined()
    // L'agent avance : plus de bandeau, plus d'abonnement.
    quiet.note(true)
    expect(app.listeners.size).toBe(0)
  })

  it('bandeau de silence aussi ; proxy du lancement gardé pour la piste ; sans source, jamais', () => {
    settings.current = { HTTPS_PROXY: 'http://b:1' }
    const app = settings()
    const quiet = new TurnQuiet({ changed: () => undefined })
    quiet.launch({}, { HTTPS_PROXY: 'http://a:1' }, app.source)
    quiet.setSilent(1)
    expect(quiet.view()).toEqual({ silentSince: 1, proxy: 'http://a:1', networkStale: true })
    quiet.clear()
    expect(app.listeners.size).toBe(0)
    const alone = new TurnQuiet({ changed: () => undefined })
    alone.launch({}, { HTTPS_PROXY: 'http://a:1' })
    alone.setSilent(1)
    expect(alone.view().networkStale).toBeUndefined()
  })
})
