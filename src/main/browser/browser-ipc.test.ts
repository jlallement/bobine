/**
 * Canal `browser:setDevice` (fiche 295) : le renderer n'obtient aucun pouvoir nouveau. Tout est
 * revérifié dans le main ; une entrée mal formée est refusée sans rien appeler.
 */
import { describe, expect, it, vi } from 'vitest'
import type { IpcHandlers } from '@shared/ipc'
import type { BrowserController } from './browser-controller'
import { browserHandlers, parseDeviceRequest } from './browser-ipc'
import { guardReadOnly } from '../read-only-guard'

vi.mock('i18next', () => ({ t: (key: string) => key }))

const VALID = [
  { kind: 'responsive', colorScheme: null },
  { kind: 'responsive', colorScheme: 'dark' },
  { kind: 'preset', id: 'iphone-14', landscape: false, colorScheme: 'light' },
  { kind: 'preset', id: 'desktop', landscape: true, colorScheme: null },
  { kind: 'custom', width: 200, height: 4000, mobile: true, colorScheme: null },
  { kind: 'custom', width: 1280, height: 800, mobile: false, colorScheme: 'dark' }
] as const

/** Objet pollué : `__proto__` en propriété propre (JSON.parse le fait). */
const polluted = JSON.parse('{"kind":"responsive","colorScheme":null,"__proto__":{"admin":true}}')
const withGetter = Object.defineProperty({ kind: 'responsive' }, 'colorScheme', {
  get: () => 'dark',
  enumerable: true
})
const custom = (patch: Record<string, unknown>) => ({
  kind: 'custom',
  width: 390,
  height: 844,
  mobile: true,
  colorScheme: null,
  ...patch
})

const INVALID: [string, unknown][] = [
  ['undefined', undefined],
  ['chaîne', 'iphone-14'],
  ['nombre', 390],
  ['tableau', [{ kind: 'responsive', colorScheme: null }]],
  ['objet vide', {}],
  ['genre inconnu', { kind: 'device', colorScheme: null }],
  ['thème hors énumération', { kind: 'responsive', colorScheme: 'sepia' }],
  ['thème absent', { kind: 'responsive' }],
  ['thème « auto »', { kind: 'responsive', colorScheme: 'auto' }],
  ['clé en trop (échelle)', { kind: 'responsive', colorScheme: null, scale: 0.5 }],
  ['identité du navigateur', { kind: 'responsive', colorScheme: null, userAgent: 'iPhone' }],
  ['densité', custom({ deviceScaleFactor: 3 })],
  ['prototype pollué', polluted],
  ['accesseur', withGetter],
  [
    'prototype non simple',
    Object.assign(Object.create({ kind: 'responsive' }), { colorScheme: null })
  ],
  [
    'objet sans prototype',
    Object.assign(Object.create(null), { kind: 'responsive', colorScheme: null })
  ],
  ['instance (Date)', Object.assign(new Date(0), { kind: 'responsive', colorScheme: null })],
  ['clé symbole', { kind: 'responsive', colorScheme: null, [Symbol('scale')]: 0.5 }],
  [
    'genre en accesseur',
    Object.defineProperty({ colorScheme: null }, 'kind', {
      get: () => 'responsive',
      enumerable: true
    })
  ],
  ['appareil inconnu', { kind: 'preset', id: 'iphone-99', landscape: false, colorScheme: null }],
  ['appareil par nom', { kind: 'preset', id: 'iPhone 14', landscape: false, colorScheme: null }],
  ['appareil __proto__', { kind: 'preset', id: '__proto__', landscape: false, colorScheme: null }],
  [
    'paysage non booléen',
    { kind: 'preset', id: 'iphone-14', landscape: 'true', colorScheme: null }
  ],
  ['paysage absent', { kind: 'preset', id: 'iphone-14', colorScheme: null }],
  ['largeur NaN', custom({ width: NaN })],
  ['largeur Infinity', custom({ width: Infinity })],
  ['hauteur -Infinity', custom({ height: -Infinity })],
  ['largeur négative', custom({ width: -390 })],
  ['largeur décimale', custom({ width: 390.5 })],
  ['largeur 199', custom({ width: 199 })],
  ['hauteur 4 001', custom({ height: 4001 })],
  ['largeur en chaîne', custom({ width: '390' })],
  ['largeur en tableau', custom({ width: [390] })],
  ['largeur en objet', custom({ width: { valueOf: () => 390 } })],
  ['mobile non booléen', custom({ mobile: 1 })],
  ['taille sans mobile', { kind: 'custom', width: 390, height: 844, colorScheme: null }],
  ['taille libre avec appareil', custom({ id: 'iphone-14' })]
]

describe('analyse de `browser:setDevice` (fiche 295)', () => {
  it('accepte « Adaptatif », un appareil connu, une taille libre entière dans les bornes ; `null` ferme', () => {
    for (const value of VALID) expect(parseDeviceRequest(structuredClone(value))).toEqual(value)
    expect(parseDeviceRequest(null)).toBeNull()
  })

  it('rend un objet neuf, jamais celui reçu', () => {
    const input = { kind: 'custom', width: 390, height: 844, mobile: true, colorScheme: null }
    const parsed = parseDeviceRequest(input)
    expect(parsed).not.toBe(input)
    input.width = 9999
    expect(parsed).toMatchObject({ width: 390 })
  })

  it.each(INVALID)('refuse : %s', (_label, value) => {
    expect(() => parseDeviceRequest(value)).toThrow('Paramètre invalide : device')
  })
})

describe('canal `browser:setDevice` (fiche 295)', () => {
  function setup() {
    const setDevice = vi.fn(async () => {})
    const handlers = browserHandlers({ setDevice } as unknown as BrowserController)
    const call = (...args: unknown[]) =>
      (handlers['browser:setDevice'] as (...a: unknown[]) => Promise<unknown>)(...args)
    return { setDevice, call, handlers }
  }

  it('transmet au main la conversation, l’onglet et le réglage revérifié', async () => {
    const { setDevice, call } = setup()
    await call('c1', 'onglet-2', {
      kind: 'preset',
      id: 'pixel-7',
      landscape: true,
      colorScheme: 'dark'
    })
    expect(setDevice).toHaveBeenCalledWith('c1', 'onglet-2', {
      kind: 'preset',
      id: 'pixel-7',
      landscape: true,
      colorScheme: 'dark'
    })
    await call('c1', 'onglet-2', null)
    expect(setDevice).toHaveBeenLastCalledWith('c1', 'onglet-2', null)
  })

  it('refuse sans rien appeler : identifiants manquants ou d’un autre type, réglage mal formé', async () => {
    const { setDevice, call } = setup()
    for (const [id, tab] of [
      ['', 'onglet-1'],
      ['c1', ''],
      [undefined, 'onglet-1'],
      ['c1', 7],
      [{ id: 'c1' }, 'onglet-1']
    ]) {
      await expect(call(id, tab, null)).rejects.toThrow('Paramètre invalide')
    }
    for (const [, value] of INVALID) {
      await expect(call('c1', 'onglet-1', value)).rejects.toThrow('Paramètre invalide : device')
    }
    expect(setDevice).not.toHaveBeenCalled()
  })

  it('profil en lecture seule : le réglage reste permis (rien n’est écrit)', async () => {
    const { setDevice, handlers } = setup()
    const guarded = guardReadOnly(handlers as unknown as IpcHandlers, () => true)
    await (guarded['browser:setDevice'] as (...a: unknown[]) => Promise<unknown>)(
      'c1',
      'onglet-1',
      {
        kind: 'responsive',
        colorScheme: 'dark'
      }
    )
    expect(setDevice).toHaveBeenCalledOnce()
  })
})
