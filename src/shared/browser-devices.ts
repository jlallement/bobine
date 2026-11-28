/**
 * Appareils que l'utilisateur peut choisir pour la page du navigateur intégré (fiche 295,
 * ADR-0078), et bornes des tailles d'écran, partagées par l'outil `browser_resize` de l'agent, le
 * canal `browser:setDevice` (revérifié dans le main) et l'interface.
 *
 * **Une donnée, pas du code** : chaque entrée reprend la taille en pixels CSS de l'entrée de même
 * nom de la liste d'appareils de Chrome DevTools (`front_end/models/emulation/EmulatedDevices.ts`,
 * dépôt ChromeDevTools/devtools-frontend, branche `main`, lue le 2026-11-28), nommée dans
 * `devtools`. Relue à chaque version majeure ; huit entrées au plus ; aucun appareil sans son entrée
 * (« Bureau » excepté, valeur conventionnelle). Seule la taille est imitée, avec le mode mobile et
 * le tactile : ni la densité de pixels, ni l'identité du navigateur.
 */
import type { BrowserColorScheme, BrowserDeviceRequest, EmulatedScreen } from './browser'

/** Bornes d'une largeur ou d'une hauteur, en pixels CSS : celles de `browser_resize` depuis la fiche 031. */
export const SCREEN_SIZE_MIN = 200
export const SCREEN_SIZE_MAX = 4000

export interface BrowserDevicePreset {
  /** Identifiant stable, seul envoyé par l'interface. */
  id: string
  /** Nom de produit, identique dans toutes les langues ; absent : `labelKey` (clé i18n). */
  name?: string
  labelKey?: 'browser.device.laptop' | 'browser.device.desktop'
  width: number
  height: number
  /** Téléphone ou tablette : mode mobile de Chromium (`meta viewport`) et tactile. */
  mobile: boolean
  /** Entrée de la liste de Chrome DevTools dont la taille est reprise. */
  devtools?: string
  /** Pas d'entrée DevTools : valeur conventionnelle, dite comme telle. */
  conventional?: true
}

export const BROWSER_DEVICES: readonly BrowserDevicePreset[] = [
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    width: 375,
    height: 667,
    mobile: true,
    devtools: 'iPhone SE'
  },
  {
    id: 'iphone-14',
    name: 'iPhone 14',
    width: 390,
    height: 844,
    mobile: true,
    devtools: 'iPhone 14'
  },
  {
    id: 'iphone-14-pro-max',
    name: 'iPhone 14 Pro Max',
    width: 430,
    height: 932,
    mobile: true,
    devtools: 'iPhone 14 Pro Max'
  },
  { id: 'pixel-7', name: 'Pixel 7', width: 412, height: 915, mobile: true, devtools: 'Pixel 7' },
  {
    id: 'ipad-mini',
    name: 'iPad mini',
    width: 768,
    height: 1024,
    mobile: true,
    devtools: 'iPad Mini'
  },
  // La liste n'a pas d'entrée « iPad Pro » seule : `iPad Pro 13` est la seule de ce nom.
  {
    id: 'ipad-pro',
    name: 'iPad Pro',
    width: 1032,
    height: 1376,
    mobile: true,
    devtools: 'iPad Pro 13'
  },
  // Donnée en 800 × 1280 (portrait) dans la liste ; un portable s'affiche en paysage.
  {
    id: 'laptop',
    labelKey: 'browser.device.laptop',
    width: 1280,
    height: 800,
    mobile: false,
    devtools: 'Laptop with MDPI screen'
  },
  {
    id: 'desktop',
    labelKey: 'browser.device.desktop',
    width: 1920,
    height: 1080,
    mobile: false,
    conventional: true
  }
]

/** Appareil de la liste, par identifiant (jamais par index d'objet : pas de prototype). */
export function findDevice(id: string): BrowserDevicePreset | undefined {
  return BROWSER_DEVICES.find((device) => device.id === id)
}

/** Largeur ou hauteur acceptable : un entier dans les bornes, rien d'autre. */
export function isScreenSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SCREEN_SIZE_MIN &&
    value <= SCREEN_SIZE_MAX
  )
}

/**
 * Taille d'écran d'un réglage de l'utilisateur ; `undefined` en « Adaptatif » (largeur du panneau)
 * ou pour un appareil inconnu. Un appareil en paysage échange largeur et hauteur.
 */
export function deviceScreen(device: BrowserDeviceRequest | undefined): EmulatedScreen | undefined {
  if (!device || device.kind === 'responsive') return undefined
  if (device.kind === 'custom') {
    return { width: device.width, height: device.height, mobile: device.mobile }
  }
  const preset = findDevice(device.id)
  if (!preset) return undefined
  return device.landscape
    ? { width: preset.height, height: preset.width, mobile: preset.mobile }
    : { width: preset.width, height: preset.height, mobile: preset.mobile }
}

/** Thème d'un réglage de l'utilisateur ; `undefined` : Auto (celui du système). */
export function deviceColorScheme(
  device: BrowserDeviceRequest | undefined
): BrowserColorScheme | undefined {
  return device?.colorScheme ?? undefined
}
