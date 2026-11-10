import { describe, expect, it, vi } from 'vitest'
import type { AppAlert } from '@shared/app-alerts'
import {
  AppAlerts,
  askAfterCrashes,
  leaveAfterCrashes,
  RendererCrashes,
  type CrashChoice
} from './app-alerts'
import { QuitFlow, type QuitFlowOptions } from './quit-guard'

const flowOptions = (calls: {
  shutdown: QuitFlowOptions['shutdown']
  ask: QuitFlowOptions['ask']
}): QuitFlowOptions => ({
  busyTitles: () => ['Migration'],
  ask: calls.ask,
  hasDraftSessions: () => false,
  dropDraftSessions: async () => {},
  quit: () => {},
  shutdown: calls.shutdown
})

describe('avis de l’app (fiche 194)', () => {
  function alerts() {
    const sent: AppAlert[][] = []
    return { alerts: new AppAlerts((list) => sent.push(list)), sent }
  }

  it('erreur interne : un seul avis par lancement, les suivantes augmentent son compte', () => {
    const { alerts: a, sent } = alerts()
    a.internalError(new Error('première'))
    a.internalError(new Error('deuxième'))
    a.internalError('troisième')
    expect(a.list()).toEqual([
      { kind: 'internal-error', count: 3, detail: expect.stringContaining('première') }
    ])
    expect(sent).toHaveLength(3)
  })

  it('fermé par ✕ : ne revient pas avant le prochain lancement', () => {
    const { alerts: a } = alerts()
    a.internalError(new Error('une'))
    a.dismiss('internal-error')
    a.internalError(new Error('encore'))
    expect(a.list()).toEqual([])
  })

  it('plantage précédent : avis avec le dossier du rapport, une fois', () => {
    const { alerts: a } = alerts()
    a.crashed('/profil/crash-reports/2026-11-07')
    expect(a.list()).toEqual([{ kind: 'crashed', report: '/profil/crash-reports/2026-11-07' }])
    expect(a.report).toBe('/profil/crash-reports/2026-11-07')
    a.dismiss('crashed')
    expect(a.list()).toEqual([])
    expect(a.report).toBeUndefined()
  })
})

describe('interface qui plante en boucle (fiche 194)', () => {
  it('rechargée trois fois par minute, puis la question', () => {
    const crashes = new RendererCrashes()
    expect([0, 1000, 2000].map((at) => crashes.next(at))).toEqual(['reload', 'reload', 'reload'])
    expect(crashes.next(3000)).toBe('give-up')
    // Une minute plus tard, les plantages anciens ne comptent plus.
    expect(crashes.next(70_000)).toBe('reload')
  })

  it('après la réponse, un agent qui travaille ne fait pas reposer « quitter quand même ? »', () => {
    const calls = { quit: vi.fn(), shutdown: vi.fn(), ask: vi.fn(async () => false) }
    const flow = new QuitFlow({
      busyTitles: () => ['Migration'],
      ask: calls.ask,
      hasDraftSessions: () => false,
      dropDraftSessions: async () => {},
      quit: calls.quit,
      shutdown: calls.shutdown
    })
    leaveAfterCrashes('relaunch', flow, () => {})
    expect(calls.quit).toHaveBeenCalledTimes(1)
    // Electron rappelle `before-quit` : pas de question, arrêt avec relance (sur l'accueil).
    const event = { preventDefault: vi.fn() }
    flow.beforeQuit(event)
    expect(calls.ask).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(calls.shutdown).toHaveBeenCalledWith(true)

    const quitOnly = vi.fn()
    const other = new QuitFlow({ ...flowOptions(calls), quit: quitOnly })
    leaveAfterCrashes('quit', other, quitOnly)
    other.beforeQuit({ preventDefault: vi.fn() })
    expect(calls.ask).not.toHaveBeenCalled()
    expect(calls.shutdown).toHaveBeenLastCalledWith(false)
  })

  it('« Afficher le journal » montre le journal puis repose la question ; Échap = Quitter', async () => {
    const answers: CrashChoice[] = ['log', 'log', 'relaunch']
    const showLog = vi.fn()
    expect(await askAfterCrashes(async () => answers.shift() ?? 'quit', showLog)).toBe('relaunch')
    expect(showLog).toHaveBeenCalledTimes(2)
    expect(await askAfterCrashes(async () => 'quit', showLog)).toBe('quit')
  })
})
