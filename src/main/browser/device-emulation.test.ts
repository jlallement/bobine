/**
 * Deux couches (fiche 295, ADR-0078) : ce qui s'applique (fonction pure) et la file des poses d'un
 * onglet (rien d'envoyé si c'est déjà posé, demandes en attente regroupées, tout reposé après un
 * échec), contre un faux `CdpTab`.
 */
import { describe, expect, it } from 'vitest'
import type { BrowserDeviceRequest, BrowserEmulation } from '@shared/browser'
import { DeviceEmulation } from './device-emulation'
import { appliedSettings, sameEmulation } from './page-view'

const IPHONE: BrowserDeviceRequest = {
  kind: 'preset',
  id: 'iphone-se',
  landscape: false,
  colorScheme: 'dark'
}
const FREE: BrowserDeviceRequest = {
  kind: 'custom',
  width: 600,
  height: 400,
  mobile: false,
  colorScheme: null
}

describe('ce qui s’applique (fiche 295)', () => {
  it.each([
    ['rien', undefined, undefined, {}],
    [
      'réglage seul',
      IPHONE,
      undefined,
      { screen: { width: 375, height: 667, mobile: true }, colorScheme: 'dark', control: 'user' }
    ],
    [
      'Adaptatif sombre',
      { kind: 'responsive', colorScheme: 'dark' },
      undefined,
      { colorScheme: 'dark', control: 'user' }
    ],
    [
      'barre ouverte, Adaptatif, Auto',
      { kind: 'responsive', colorScheme: null },
      undefined,
      { control: 'user' }
    ],
    [
      'agent seul',
      undefined,
      { screen: { width: 768, height: 1024, mobile: true } },
      { screen: { width: 768, height: 1024, mobile: true }, control: 'agent' }
    ],
    [
      'agent devant le réglage',
      IPHONE,
      { screen: { width: 768, height: 1024, mobile: true } },
      { screen: { width: 768, height: 1024, mobile: true }, colorScheme: 'dark', control: 'agent' }
    ],
    [
      '`desktop` de l’agent devant le réglage',
      IPHONE,
      { screen: 'panel' },
      { colorScheme: 'dark', control: 'agent' }
    ],
    [
      '`auto` de l’agent devant le réglage',
      IPHONE,
      { colorScheme: 'auto' },
      { screen: { width: 375, height: 667, mobile: true }, control: 'agent' }
    ],
    [
      'thème de l’agent, taille de l’utilisateur',
      FREE,
      { colorScheme: 'light' },
      { screen: { width: 600, height: 400, mobile: false }, colorScheme: 'light', control: 'agent' }
    ],
    [
      'essai vide : l’utilisateur',
      IPHONE,
      {},
      { screen: { width: 375, height: 667, mobile: true }, colorScheme: 'dark', control: 'user' }
    ]
  ] as const)('%s', (_label, user, agent, want) => {
    expect(appliedSettings(user as BrowserDeviceRequest | undefined, agent)).toEqual(want)
  })

  it('même écran posé : au millième de réduction près', () => {
    const a = { width: 390, height: 844, mobile: true, scale: 0.5 }
    expect(sameEmulation(a, { ...a, scale: 0.5009 })).toBe(true)
    expect(sameEmulation(a, { ...a, scale: 0.502 })).toBe(false)
    expect(sameEmulation(a, { ...a, mobile: false })).toBe(false)
    expect(sameEmulation(a, { ...a, width: 391 })).toBe(false)
    expect(sameEmulation(undefined, undefined)).toBe(true)
    expect(sameEmulation(a, undefined)).toBe(false)
  })
})

/** Faux `CdpTab` : ce qui est posé, les appels, une réponse qu'on libère à la main. */
function fakeTab() {
  const calls: string[] = []
  let gate: (() => void) | undefined
  let fail = false
  const wait = async () => {
    if (gate !== undefined) return
    await new Promise<void>((resolve) => (gate = resolve))
    gate = undefined
  }
  const tab = {
    cdp: {
      emulation: undefined as BrowserEmulation | undefined,
      colorScheme: undefined as 'light' | 'dark' | undefined,
      async emulate(emulation: BrowserEmulation | undefined) {
        calls.push(`emulate ${emulation ? `${emulation.width}x${emulation.height}` : 'none'}`)
        if (hold) await wait()
        if (fail) throw new Error('target closed')
        tab.cdp.emulation = emulation
      },
      async setColorScheme(scheme: 'light' | 'dark' | undefined) {
        calls.push(`scheme ${scheme ?? 'auto'}`)
        if (fail) throw new Error('target closed')
        tab.cdp.colorScheme = scheme
      }
    }
  }
  let hold = false
  return {
    tab,
    calls,
    hold: (on: boolean) => (hold = on),
    release: () => gate?.(),
    failing: (on: boolean) => (fail = on)
  }
}

function engine() {
  const changed: string[] = []
  const devices = new DeviceEmulation<ReturnType<typeof fakeTab>['tab']>({
    area: (id) => (id === 'gone' ? undefined : { x: 0, y: 0, width: 600, height: 700 }),
    changed: (id) => changed.push(id)
  })
  return { devices, changed }
}

describe('file des poses d’un onglet (fiche 295)', () => {
  it('rien n’est envoyé quand c’est déjà posé ; l’état est relu sur le CDP', async () => {
    const { devices, changed } = engine()
    const { tab, calls } = fakeTab()
    await devices.sync('c1', tab)
    expect(calls).toEqual([])
    expect(changed).toEqual([])
    devices.setDevice('c1', IPHONE)
    await devices.sync('c1', tab)
    await devices.sync('c1', tab)
    expect(calls).toEqual(['emulate 375x667', 'scheme dark'])
    expect(changed).toEqual(['c1'])
    expect(devices.view('c1', tab)).toEqual({
      emulation: { width: 375, height: 667, mobile: true, scale: 1 },
      colorScheme: 'dark',
      device: IPHONE,
      control: 'user'
    })
  })

  it('une pose à la fois ; les demandes faites pendant qu’elle attend n’en font qu’une, la dernière', async () => {
    const { devices } = engine()
    const f = fakeTab()
    f.hold(true)
    devices.setDevice('c1', IPHONE)
    const first = devices.sync('c1', f.tab)
    await Promise.resolve()
    devices.setDevice('c1', FREE)
    const second = devices.sync('c1', f.tab)
    devices.setDevice('c1', { kind: 'preset', id: 'pixel-7', landscape: false, colorScheme: null })
    const third = devices.sync('c1', f.tab)
    expect(third).toBe(second)
    f.hold(false)
    f.release()
    await Promise.all([first, second, third])
    expect(f.calls).toEqual(['emulate 375x667', 'scheme dark', 'emulate 412x915', 'scheme auto'])
    expect(f.tab.cdp.emulation).toMatchObject({ width: 412, height: 915 })
  })

  it('échec : rejetée, l’état dit ce qui a été pris, et le passage suivant repose tout', async () => {
    const { devices, changed } = engine()
    const f = fakeTab()
    devices.setDevice('c1', IPHONE)
    f.failing(true)
    await expect(devices.sync('c1', f.tab)).rejects.toThrow('target closed')
    expect(devices.view('c1', f.tab).emulation).toBeUndefined()
    expect(changed).toEqual(['c1'])
    await expect(devices.settled(f.tab)).resolves.toBeUndefined()
    f.failing(false)
    f.tab.cdp.emulation = { width: 375, height: 667, mobile: true, scale: 1 }
    f.tab.cdp.colorScheme = 'dark'
    f.calls.length = 0
    // Rien ne diffère en apparence, mais l'échec impose de tout reposer.
    await devices.sync('c1', f.tab)
    expect(f.calls).toEqual(['emulate 375x667', 'scheme dark'])
    f.calls.length = 0
    await devices.sync('c1', f.tab)
    expect(f.calls).toEqual([])
  })

  it('conversation fermée entre-temps : rien n’est posé', async () => {
    const { devices } = engine()
    const f = fakeTab()
    devices.setDevice('gone', IPHONE)
    await devices.sync('gone', f.tab)
    expect(f.calls).toEqual([])
  })

  it('essai de l’agent : effacer la taille seule garde son thème ; un essai vide n’existe pas', () => {
    const { devices } = engine()
    const { tab } = fakeTab()
    expect(devices.clearTrial(tab)).toBe(false)
    devices.setTrial(tab, { screen: 'panel' })
    devices.setTrial(tab, { colorScheme: 'light' })
    expect(devices.clearTrial(tab, 'screen')).toBe(true)
    expect(devices.trial(tab)).toEqual({ colorScheme: 'light' })
    expect(devices.clearTrial(tab, 'screen')).toBe(false)
    expect(devices.clearTrial(tab)).toBe(true)
    expect(devices.trial(tab)).toBeUndefined()
    devices.setTrial(tab, {})
    expect(devices.trial(tab)).toBeUndefined()
    expect(devices.view('c1', tab)).toEqual({})
  })

  it('l’état rendu est une copie : le modifier ne change pas le moteur', () => {
    const { devices } = engine()
    const { tab } = fakeTab()
    devices.setDevice('c1', { ...IPHONE })
    devices.setTrial(tab, { screen: { width: 500, height: 500, mobile: false } })
    const view = devices.view('c1', tab)
    ;(view.device as { id: string }).id = 'ipad-pro'
    ;(view.agent?.screen as { width: number }).width = 9
    expect(devices.view('c1', tab)).toMatchObject({
      device: IPHONE,
      agent: { screen: { width: 500 } }
    })
  })
})
