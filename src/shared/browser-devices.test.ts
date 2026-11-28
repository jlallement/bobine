/**
 * Liste d'appareils de l'utilisateur (fiche 295, ADR-0078) : une donnée courte, chaque entrée avec
 * sa source (l'entrée de même nom de Chrome DevTools), dans les bornes de `browser_resize`.
 */
import { describe, expect, it } from 'vitest'
import {
  BROWSER_DEVICES,
  SCREEN_SIZE_MAX,
  SCREEN_SIZE_MIN,
  deviceColorScheme,
  deviceScreen,
  findDevice,
  isScreenSize
} from './browser-devices'

describe('liste d’appareils (fiche 295)', () => {
  it('huit entrées au plus, identifiants uniques, un nom ou une clé de traduction chacune', () => {
    expect(BROWSER_DEVICES.length).toBeLessThanOrEqual(8)
    expect(new Set(BROWSER_DEVICES.map((d) => d.id)).size).toBe(BROWSER_DEVICES.length)
    for (const device of BROWSER_DEVICES) {
      expect(!!device.name !== !!device.labelKey, device.id).toBe(true)
    }
  })

  it('chaque appareil nomme son entrée DevTools, sauf « Bureau », marqué conventionnel', () => {
    for (const device of BROWSER_DEVICES) {
      if (device.conventional) expect(device.devtools, device.id).toBeUndefined()
      else expect(device.devtools, device.id).toMatch(/\S/)
    }
    expect(BROWSER_DEVICES.filter((d) => d.conventional).map((d) => d.id)).toEqual(['desktop'])
  })

  it('tailles dans les bornes, entières ; mobile pour téléphones et tablettes seulement', () => {
    for (const device of BROWSER_DEVICES) {
      expect(isScreenSize(device.width) && isScreenSize(device.height), device.id).toBe(true)
    }
    expect(BROWSER_DEVICES.filter((d) => !d.mobile).map((d) => d.id)).toEqual(['laptop', 'desktop'])
  })

  it('les tailles du tableau de la fiche (entrée de même nom de DevTools, lue le 2026-11-28)', () => {
    expect(BROWSER_DEVICES.map((d) => [d.id, d.width, d.height, d.devtools ?? null])).toEqual([
      ['iphone-se', 375, 667, 'iPhone SE'],
      ['iphone-14', 390, 844, 'iPhone 14'],
      ['iphone-14-pro-max', 430, 932, 'iPhone 14 Pro Max'],
      ['pixel-7', 412, 915, 'Pixel 7'],
      ['ipad-mini', 768, 1024, 'iPad Mini'],
      ['ipad-pro', 1032, 1376, 'iPad Pro 13'],
      ['laptop', 1280, 800, 'Laptop with MDPI screen'],
      ['desktop', 1920, 1080, null]
    ])
  })

  it('bornes : entiers de 200 à 4 000, rien d’autre', () => {
    expect([SCREEN_SIZE_MIN, SCREEN_SIZE_MAX]).toEqual([200, 4000])
    for (const ok of [200, 390, 4000]) expect(isScreenSize(ok), String(ok)).toBe(true)
    for (const bad of [
      199,
      4001,
      390.5,
      -390,
      0,
      NaN,
      Infinity,
      -Infinity,
      '390',
      null,
      [390],
      {}
    ]) {
      expect(isScreenSize(bad), String(bad)).toBe(false)
    }
  })

  it('appareil par identifiant seulement : pas de prototype, pas d’inconnu', () => {
    expect(findDevice('iphone-14')?.width).toBe(390)
    for (const id of ['__proto__', 'constructor', 'toString', 'iPhone 14', '']) {
      expect(findDevice(id), id).toBeUndefined()
    }
  })
})

describe('taille et thème d’un réglage (fiche 295)', () => {
  it('Adaptatif : pas de taille ; appareil : sa taille, tournée en paysage ; taille libre telle quelle', () => {
    expect(deviceScreen(undefined)).toBeUndefined()
    expect(deviceScreen({ kind: 'responsive', colorScheme: 'dark' })).toBeUndefined()
    expect(
      deviceScreen({ kind: 'preset', id: 'iphone-14', landscape: false, colorScheme: null })
    ).toEqual({
      width: 390,
      height: 844,
      mobile: true
    })
    expect(
      deviceScreen({ kind: 'preset', id: 'iphone-14', landscape: true, colorScheme: null })
    ).toEqual({
      width: 844,
      height: 390,
      mobile: true
    })
    expect(
      deviceScreen({ kind: 'custom', width: 600, height: 300, mobile: false, colorScheme: null })
    ).toEqual({ width: 600, height: 300, mobile: false })
    expect(
      deviceScreen({ kind: 'preset', id: 'montre', landscape: false, colorScheme: null })
    ).toBeUndefined()
  })

  it('thème : celui du réglage, Auto sinon', () => {
    expect(deviceColorScheme(undefined)).toBeUndefined()
    expect(deviceColorScheme({ kind: 'responsive', colorScheme: null })).toBeUndefined()
    expect(deviceColorScheme({ kind: 'responsive', colorScheme: 'dark' })).toBe('dark')
  })
})
