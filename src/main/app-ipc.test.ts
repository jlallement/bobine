import { describe, expect, it, vi } from 'vitest'
import { appHandlers } from './app-ipc'

const base = {
  appName: 'Bobine',
  appVersion: '0.4.0',
  electronVersion: '44.7.2',
  platform: 'darwin'
}

describe('canaux de l’app et de la fenêtre À propos (fiche 116)', () => {
  it('app:getInfo : date et commit du build en plus', async () => {
    const handlers = appHandlers({ ...base, build: { date: '2026-10-22', commit: 'abc1234' } })
    expect(await handlers['app:getInfo']()).toEqual({
      name: 'Bobine',
      version: '0.4.0',
      electron: '44.7.2',
      platform: 'darwin',
      buildDate: '2026-10-22',
      commit: 'abc1234'
    })
    // Hors build (tests, dev) : « dev ».
    expect((await appHandlers(base)['app:getInfo']()).commit).toBe('dev')
  })

  it('about:* : bloc d’infos, fermeture, nouveautés ; indisponible sans fenêtre', async () => {
    const about = {
      technicalInfo: vi.fn(() => 'Bobine 0.4.0'),
      close: vi.fn(),
      showChangelog: vi.fn()
    }
    const handlers = appHandlers({ ...base, about })
    expect(await handlers['about:technicalInfo']()).toBe('Bobine 0.4.0')
    await handlers['about:close']()
    await handlers['about:showChangelog']()
    expect(about.close).toHaveBeenCalledOnce()
    expect(about.showChangelog).toHaveBeenCalledOnce()
    expect(() => appHandlers(base)['about:technicalInfo']()).toThrow(
      'Fenêtre À propos indisponible'
    )
  })

  it('help:* (fiche 186) : sujet de la liste seulement, première cible, nouveautés', async () => {
    const help = {
      open: vi.fn(),
      target: vi.fn(() => ({ target: { page: 'README' }, search: true })),
      showChangelog: vi.fn()
    }
    const handlers = appHandlers({ ...base, help })
    await handlers['help:open']('review')
    await handlers['help:open'](null)
    expect(help.open.mock.calls).toEqual([['review'], [null]])
    for (const bad of ['constructor', '../x', 42, undefined]) {
      expect(() => handlers['help:open'](bad as never)).toThrow('Paramètre invalide')
    }
    expect(await handlers['help:target']()).toEqual({ target: { page: 'README' }, search: true })
    await handlers['help:showChangelog']()
    expect(help.showChangelog).toHaveBeenCalledOnce()
    expect(() => appHandlers(base)['help:target']()).toThrow('Aide indisponible')
  })

  it('app:fonts (fiche 136) : les polices du lecteur, ou des listes vides sans lui', async () => {
    const fonts = { families: ['Avenir Next'], monospace: ['Menlo'] }
    expect(await appHandlers({ ...base, fonts: async () => fonts })['app:fonts']()).toEqual(fonts)
    expect(await appHandlers(base)['app:fonts']()).toEqual({ families: [], monospace: [] })
  })

  it('app:commandStatus (fiche 158) : état de la commande, `null` sans elle (sources), sans erreur', async () => {
    const status = {
      target: '/usr/local/bin',
      current: true,
      inPath: true,
      path: '/usr/local/bin/bobine'
    }
    const commandLine = { status: () => status, install: () => status, uninstall: () => status }
    expect(await appHandlers({ ...base, commandLine })['app:commandStatus']()).toEqual(status)
    expect(await appHandlers(base)['app:commandStatus']()).toBeNull()
  })

  it('recommencer à neuf (fiche 148) : infos du lancement, plan, réinitialisation, profil', async () => {
    const plan = { items: [], keychain: true, canUninstall: false }
    const freshStart = {
      info: { temporary: true, askReset: false },
      plan: vi.fn(async () => plan),
      reset: vi.fn(),
      openTemporary: vi.fn()
    }
    const handlers = appHandlers({ ...base, freshStart })
    expect((await handlers['app:getInfo']()).freshStart).toEqual({
      temporary: true,
      askReset: false
    })
    expect(await handlers['app:resetPlan']()).toBe(plan)
    await handlers['app:reset'](true)
    expect(freshStart.reset).toHaveBeenCalledWith(true)
    await handlers['app:openTemporaryProfile'](false)
    expect(freshStart.openTemporary).toHaveBeenCalledWith(false)
    expect(() => handlers['app:reset']('oui' as never)).toThrow('uninstall')
    expect(() => handlers['app:openTemporaryProfile'](1 as never)).toThrow('freshAgents')
    expect((await appHandlers(base)['app:getInfo']()).freshStart).toBeUndefined()
    expect(() => appHandlers(base)['app:resetPlan']()).toThrow('Recommencer à neuf indisponible')
  })
})
