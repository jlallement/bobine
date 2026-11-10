/**
 * `xcrun simctl` (fiche 008) : appareils, démarrage, apps, liens profonds, captures. Tout ce que le
 * simulateur sait faire sans outil tiers.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SimDevice } from '@shared/simulator'
import type { Run } from './run'
import { t } from 'i18next'
import { delay } from '../delay.ts'

const BOOT_POLL_MS = 1000

export class Simctl {
  private readonly run: Run
  private readonly xcrun: string

  /** `xcrun` remplaçable (essais de bout en bout sans simulateur : `BOBINE_XCRUN`). */
  constructor(run: Run, xcrun = 'xcrun') {
    this.run = run
    this.xcrun = xcrun
  }

  /** Appareils disponibles, démarrés d'abord. */
  async devices(): Promise<SimDevice[]> {
    const out = await this.simctl(['list', 'devices', 'available', '-j'])
    return parseDevices(out.toString('utf8'))
  }

  /** Démarre l'appareil (sans attendre) ; sans effet s'il l'est déjà. */
  async boot(udid: string): Promise<void> {
    const result = await this.run(this.xcrun, ['simctl', 'boot', udid], { timeoutMs: 60_000 })
    if (result.code !== 0 && !/current state: Booted/i.test(result.stderr)) {
      throw new Error(`simctl boot : ${firstLine(result.stderr)}`)
    }
  }

  /** Attend que l'appareil ait fini de démarrer, au plus `budgetMs` ; `true` s'il est prêt. */
  async waitBooted(udid: string, budgetMs: number): Promise<boolean> {
    const until = Date.now() + budgetMs
    while (Date.now() < until) {
      const result = await this.run(this.xcrun, ['simctl', 'bootstatus', udid], { timeoutMs: 5000 })
      if (result.code === 0) return true
      await delay(BOOT_POLL_MS)
    }
    return false
  }

  async install(udid: string, appPath: string): Promise<void> {
    await this.simctl(['install', udid, appPath], 120_000)
  }

  /** Lance l'app ; renvoie son pid. `relaunch` : la redémarre si elle tourne déjà. */
  async launch(udid: string, bundleId: string): Promise<number | undefined> {
    const out = await this.simctl(['launch', '--terminate-running-process', udid, bundleId])
    const pid = /:\s*(\d+)/.exec(out.toString('utf8'))?.[1]
    return pid ? Number(pid) : undefined
  }

  async terminate(udid: string, bundleId: string): Promise<void> {
    await this.simctl(['terminate', udid, bundleId]).catch(() => {})
  }

  /**
   * Presse-papiers de l'appareil. `simctl pbcopy` lit son entrée en MacRoman (relevé sur Xcode
   * 26.6) : le texte est donc encodé ainsi, d'où `toMacRoman`.
   */
  async pbcopy(udid: string, bytes: Buffer): Promise<void> {
    const result = await this.run(this.xcrun, ['simctl', 'pbcopy', udid], { input: bytes })
    if (result.code !== 0) throw new Error(`simctl pbcopy : ${firstLine(result.stderr)}`)
  }

  async openUrl(udid: string, url: string): Promise<void> {
    await this.simctl(['openurl', udid, url])
  }

  /**
   * Capture de l'écran (JPEG, en pixels de l'appareil). Par un fichier temporaire : avec Xcode 27,
   * `screenshot -` écrit un fichier nommé « - » dans le dossier courant au lieu de la sortie
   * standard, contrairement à ce qu'annonce son aide.
   */
  async screenshot(udid: string): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'bob-simulateur-'))
    const file = join(dir, 'ecran.jpg')
    try {
      const out = await this.simctl(['io', udid, 'screenshot', '--type=jpeg', file], 15_000)
      const image = await readFile(file).catch(() => out)
      if (image.length === 0) throw new Error(t('panel.device.emptyCapture'))
      return image
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  private async simctl(args: string[], timeoutMs = 30_000): Promise<Buffer> {
    const result = await this.run(this.xcrun, ['simctl', ...args], { timeoutMs })
    if (result.code !== 0) {
      throw new Error(
        `simctl ${args[0] ?? ''} : ${firstLine(result.stderr) || `code ${result.code}`}`
      )
    }
    return result.stdout
  }
}

/** Liste JSON de `simctl list devices -j` → appareils (démarrés d'abord, puis par nom). */
export function parseDevices(json: string): SimDevice[] {
  const data = JSON.parse(json) as {
    devices?: Record<
      string,
      {
        udid: string
        name: string
        state: string
        isAvailable?: boolean
        deviceTypeIdentifier?: string
      }[]
    >
  }
  const devices: SimDevice[] = []
  for (const [runtimeId, list] of Object.entries(data.devices ?? {})) {
    const runtime = runtimeName(runtimeId)
    for (const d of list) {
      if (d.isAvailable === false) continue
      devices.push({
        udid: d.udid,
        name: d.name,
        state: d.state,
        runtime,
        ...(d.deviceTypeIdentifier ? { deviceType: d.deviceTypeIdentifier } : {})
      })
    }
  }
  return devices.sort(
    (a, b) =>
      Number(b.state === 'Booted') - Number(a.state === 'Booted') ||
      a.name.localeCompare(b.name) ||
      b.runtime.localeCompare(a.runtime)
  )
}

/** `com.apple.CoreSimulator.SimRuntime.iOS-26-5` → « iOS 26.5 ». */
export function runtimeName(id: string): string {
  const match = /SimRuntime\.([A-Za-z]+)-([\d-]+)$/.exec(id)
  return match ? `${match[1]} ${match[2]?.replace(/-/g, '.')}` : id
}

const firstLine = (text: string) => text.trim().split('\n')[0] ?? ''

/** Caractères 0x80 à 0xFF du codage MacRoman (CoreFoundation). */
const MAC_ROMAN_HIGH =
  'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
  '¿¡¬√ƒ≈∆«»…\u00a0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uf8ffÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ'

/**
 * Texte → octets MacRoman ; `undefined` s'il contient un caractère hors MacRoman (emoji…), listés
 * dans `missing`.
 */
export function toMacRoman(text: string): { bytes: Buffer } | { missing: string[] } {
  const bytes: number[] = []
  const missing = new Set<string>()
  for (const char of text.normalize('NFC')) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x80) bytes.push(code === 0x0a ? 0x0d : code)
    else {
      const index = MAC_ROMAN_HIGH.indexOf(char)
      if (index === -1) missing.add(char)
      else bytes.push(0x80 + index)
    }
  }
  return missing.size ? { missing: [...missing] } : { bytes: Buffer.from(bytes) }
}
