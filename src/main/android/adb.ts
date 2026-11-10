/**
 * `adb` et `emulator` du SDK Android (fiche 032) : appareils, démarrage, apps, captures, touchers,
 * lecture de l'écran, journaux. Rien d'autre à installer.
 */
import { spawn } from 'node:child_process'
import type { AndroidDevice } from '@shared/android'
import type { Run } from '../simulator/run'
import { t } from 'i18next'

/** Longueur gardée d'un message d'erreur d'adb : entier, mais pas un journal. */
const ADB_ERROR_MAX = 2000

/** Touches nommées → codes Android (`input keyevent`). */
export const KEYS: Record<string, string> = {
  back: 'KEYCODE_BACK',
  home: 'KEYCODE_HOME',
  enter: 'KEYCODE_ENTER',
  tab: 'KEYCODE_TAB',
  delete: 'KEYCODE_DEL',
  backspace: 'KEYCODE_DEL',
  menu: 'KEYCODE_MENU',
  recents: 'KEYCODE_APP_SWITCH',
  power: 'KEYCODE_POWER',
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  volume_up: 'KEYCODE_VOLUME_UP',
  volume_down: 'KEYCODE_VOLUME_DOWN'
}

/** Argument sûr pour le shell de l'appareil (`adb shell` passe la commande à `sh -c`). */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** `adb devices -l` → appareils (prêts d'abord). */
export function parseDevices(output: string): { serial: string; state: string; model?: string }[] {
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial = '', state = ''] = line.split(/\s+/)
      const model = /model:(\S+)/.exec(line)?.[1]
      return { serial, state, ...(model ? { model } : {}) }
    })
    .filter((d) => d.serial && !d.serial.startsWith('*'))
    .sort((a, b) => Number(b.state === 'device') - Number(a.state === 'device'))
}

/** Écran dans son orientation courante (pixels). */
export interface Orientation {
  /** Taille logique, orientation comprise (`cur=` de `dumpsys window displays`). */
  width: number
  height: number
  /** Quarts de tour du dessin par rapport à la position naturelle (`Surface.ROTATION_*` / 90). */
  rotation: number
  /** Rayon des coins déclaré par l'appareil, en pixels (0 : rien de déclaré). */
  cornerRadius: number
}

/** Extrait de `dumpsys window displays` → orientation de l'écran principal, `null` si illisible. */
export function parseOrientation(output: string): Orientation | null {
  const size = /\bcur=(\d+)x(\d+)/.exec(output)
  if (!size) return null
  const rotation = /mCurrentRotation=ROTATION_(0|90|180|270)\b/.exec(output)
  const radii = [...output.matchAll(/RoundedCorner\{position=\w+, radius=(\d+)/g)].map((m) =>
    Number(m[1])
  )
  return {
    width: Number(size[1]),
    height: Number(size[2]),
    rotation: rotation ? Number(rotation[1]) / 90 : 0,
    cornerRadius: radii.length ? Math.min(...radii) : 0
  }
}

export class Adb {
  private readonly run: Run
  readonly adb: string
  readonly emulator: string

  constructor(run: Run, adb: string, emulator: string) {
    this.run = run
    this.adb = adb
    this.emulator = emulator
  }

  /** Appareils connus d'adb ; les émulateurs portent le nom de leur appareil virtuel. */
  async devices(): Promise<AndroidDevice[]> {
    const out = await this.exec(['devices', '-l'])
    const devices = parseDevices(out.toString('utf8'))
    return Promise.all(
      devices.map(async (d) => {
        let name = d.model?.replace(/_/g, ' ') ?? d.serial
        if (d.serial.startsWith('emulator-') && d.state === 'device') {
          const avd = await this.run(this.adb, ['-s', d.serial, 'emu', 'avd', 'name'], {
            timeoutMs: 5000
          })
          const first = avd.stdout.toString('utf8').split(/\r?\n/)[0]?.trim()
          if (avd.code === 0 && first && first !== 'OK') name = first
        }
        return { serial: d.serial, name, state: d.state }
      })
    )
  }

  /** Appareils virtuels (AVD) installés. */
  async avds(): Promise<string[]> {
    const result = await this.run(this.emulator, ['-list-avds'], { timeoutMs: 15_000 })
    return result.stdout
      .toString('utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^(INFO|WARNING|ERROR)\b/.test(l))
  }

  /**
   * Démarre un appareil virtuel, détaché (il survit à l'app, comme le simulateur iOS), sans fenêtre :
   * l'écran est montré dans le panneau.
   */
  startEmulator(avd: string): void {
    const child = spawn(this.emulator, ['-avd', avd, '-no-window', '-no-audio', '-no-boot-anim'], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
  }

  /** Démarrage terminé (`sys.boot_completed`). */
  async booted(serial: string): Promise<boolean> {
    const result = await this.run(
      this.adb,
      ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
      { timeoutMs: 5000 }
    )
    return result.code === 0 && result.stdout.toString('utf8').trim() === '1'
  }

  async install(serial: string, apk: string): Promise<void> {
    await this.exec(['-s', serial, 'install', '-r', apk], 180_000)
  }

  /** Lance l'activité principale d'un paquet ; renvoie le composant lancé. */
  async launch(serial: string, packageName: string): Promise<string> {
    const resolved = (
      await this.shell(serial, `cmd package resolve-activity --brief ${shellQuote(packageName)}`)
    )
      .trim()
      .split('\n')
      .pop()
      ?.trim()
    if (!resolved || !resolved.includes('/')) {
      throw new Error(`Aucune activité de lancement pour ${packageName} (installée ?)`)
    }
    await this.shell(serial, `am start -W -n ${shellQuote(resolved)}`)
    return resolved
  }

  async openUrl(serial: string, url: string): Promise<void> {
    await this.shell(serial, `am start -a android.intent.action.VIEW -d ${shellQuote(url)}`)
  }

  /** Capture de l'écran (PNG, en pixels). */
  async screenshot(serial: string): Promise<Buffer> {
    const out = await this.exec(['-s', serial, 'exec-out', 'screencap', '-p'], 20_000)
    if (out.length < 8) throw new Error(t('panel.device.emptyCapture'))
    return out
  }

  /** Taille de l'écran (pixels) et densité (ppp) : 160 ppp = 1 dp par pixel. */
  async display(serial: string): Promise<{ width: number; height: number; density: number }> {
    const size = /(\d+)x(\d+)\s*$/m.exec(await this.shell(serial, 'wm size'))
    const density = /(\d+)\s*$/m.exec(await this.shell(serial, 'wm density'))
    if (!size || !density) throw new Error(t('android.unknownSize'))
    return { width: Number(size[1]), height: Number(size[2]), density: Number(density[1]) }
  }

  /** Orientation courante de l'écran (fiche 081) : `wm size` ne donne que la taille physique. */
  async orientation(serial: string): Promise<Orientation> {
    const out = await this.shell(
      serial,
      "dumpsys window displays | grep -E 'cur=|mCurrentRotation|mRoundedCorners'",
      10_000
    )
    const orientation = parseOrientation(out)
    if (!orientation) throw new Error(t('android.unknownSize'))
    return orientation
  }

  /** Hiérarchie de l'écran (XML de `uiautomator dump`). */
  async uiDump(serial: string): Promise<string> {
    const out = (
      await this.exec(['-s', serial, 'exec-out', 'uiautomator', 'dump', '/dev/tty'], 30_000)
    ).toString('utf8')
    const end = out.lastIndexOf('</hierarchy>')
    if (end === -1) throw new Error(t('android.readFailed', { error: out.trim().slice(0, 200) }))
    return out.slice(out.indexOf('<'), end + '</hierarchy>'.length)
  }

  async tap(serial: string, x: number, y: number, holdMs?: number): Promise<void> {
    await this.shell(
      serial,
      holdMs ? `input swipe ${x} ${y} ${x} ${y} ${holdMs}` : `input tap ${x} ${y}`
    )
  }

  async swipe(
    serial: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    ms: number
  ) {
    await this.shell(serial, `input swipe ${from.x} ${from.y} ${to.x} ${to.y} ${ms}`)
  }

  /** Saisie (caractères ASCII : `input text` n'en accepte pas d'autres). */
  async text(serial: string, text: string): Promise<void> {
    // `input text` : les espaces s'écrivent %s.
    await this.shell(serial, `input text ${shellQuote(text.replace(/ /g, '%s'))}`)
  }

  async key(serial: string, keycode: string): Promise<void> {
    await this.shell(serial, `input keyevent ${shellQuote(keycode)}`)
  }

  /** Dernières lignes du journal (`logcat`), éventuellement d'un seul paquet. */
  async logcat(
    serial: string,
    options: { lines: number; level: string; pid?: string }
  ): Promise<string> {
    const args = ['-s', serial, 'logcat', '-d', '-t', String(options.lines), `*:${options.level}`]
    if (options.pid) args.push(`--pid=${options.pid}`)
    return (await this.exec(args, 20_000)).toString('utf8')
  }

  async pidOf(serial: string, packageName: string): Promise<string | undefined> {
    const result = await this.run(this.adb, ['-s', serial, 'shell', 'pidof', packageName], {
      timeoutMs: 5000
    })
    const pid = result.stdout.toString('utf8').trim().split(/\s+/)[0]
    return result.code === 0 && pid ? pid : undefined
  }

  async shell(serial: string, command: string, timeoutMs = 30_000): Promise<string> {
    return (await this.exec(['-s', serial, 'shell', command], timeoutMs)).toString('utf8')
  }

  private async exec(args: string[], timeoutMs = 30_000): Promise<Buffer> {
    const result = await this.run(this.adb, args, { timeoutMs })
    // `adb shell` rend parfois 0 avec une exception Java : on la considère comme une erreur.
    const text = result.code === 0 ? '' : result.stderr || result.stdout.toString('utf8')
    if (result.code !== 0) {
      // Message entier : la raison suit souvent la première ligne (`adb install`, fiche 122).
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      throw new Error(
        `adb ${args
          .filter((a) => a !== '-s')
          .slice(1, 3)
          .join(' ')} : ${lines.join('\n').slice(0, ADB_ERROR_MAX) || `code ${result.code}`}`
      )
    }
    if (args.includes('shell')) {
      const out = result.stdout.toString('utf8')
      if (/^Exception occurred|^java\.lang\.\w+Exception|^Error:/m.test(out)) {
        throw new Error(`adb shell : ${out.trim().split('\n')[0]}`)
      }
    }
    return result.stdout
  }
}
