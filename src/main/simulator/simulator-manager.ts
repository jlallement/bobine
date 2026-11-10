/**
 * Simulateur iOS d'une conversation (fiche 008) : appareil choisi, captures à l'échelle des points
 * (mêmes coordonnées que les touchers), lecture de l'écran avec références, touchers par AXe.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import type { SimDevice, SimulatorState } from '@shared/simulator'
import { FixedFrames, looksLikeOpaqueBgra, streamGeometry } from './bgra-frames'
import { MjpegParser } from './mjpeg'
import {
  Axe,
  axeProblemForAgent,
  axeProblemText,
  checkAxe,
  formatScreen,
  type AxeCheck,
  type HardwareButton
} from './axe'
import type { Run } from './run'
import { Simctl, toMacRoman } from './simctl'
import type { FilmFrame } from '../filmstrip/sheet'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { delay } from '../delay'
import { trackChild } from '../process-registry'

/** Images par seconde demandées à AXe (son maximum ; tenu en BGRA, ≈ 10–18 en MJPEG). */
const STREAM_FPS = 30
/** Échelle du flux MJPEG (fiche 009). Le flux BGRA a la sienne (`streamGeometry`, fiche 044). */
const MJPEG_SCALE = 0.5
/** Sans image BGRA dans ce délai, le flux repasse en MJPEG (AXe sans ce format, appareil muet). */
const BGRA_FIRST_FRAME_MS = 4000
/** Planche contact (fiche 075) : attente de la première image du flux, images gardées au plus. */
const FILM_FIRST_FRAME_MS = 6000
const MAX_FILM_FRAMES = 300
/** Un AXe absent ou inutilisable est revérifié après ce délai (installé entre-temps…). */
const AXE_RECHECK_MS = 10_000

/** Mise à l'échelle d'une image JPEG (Electron `nativeImage`, injectée pour les tests). */
export type ResizeJpeg = (
  jpeg: Buffer,
  width: number,
  height: number
) => { data: string; width: number; height: number; sourceWidth: number; sourceHeight: number }

/** Image BGRA brute (largeur × hauteur × 4 octets) → JPEG (Electron `nativeImage`, injecté). */
export type EncodeBgra = (bgra: Buffer, width: number, height: number) => Buffer

export interface SimulatorManagerOptions {
  run: Run
  /** Chemin d'AXe, `undefined` s'il n'est pas installé (pas de touchers). */
  axeBinary: string | undefined
  /** Marche à suivre quand AXe manque (en développement : `pnpm fetch-axe`). */
  axeInstallHint?: string
  /** `xcrun` à utiliser (défaut : celui du PATH). */
  xcrun?: string
  resize: ResizeJpeg
  /** Sans encodeur, le flux vidéo reste en MJPEG (captures successives d'AXe). */
  encodeBgra?: EncodeBgra
  emitState: (state: SimulatorState) => void
}

type StreamFormat = 'bgra' | 'mjpeg'

interface StreamHandle {
  conversationId: string
  udid: string
  child?: ChildProcess
  /** Onglet « Simulateur » qui affiche le flux (absent : flux démarré pour une planche). */
  onFrame?: (jpeg: Buffer) => void
  onEnd?: (reason: string) => void
  /** Planches contact en cours (fiche 075) : elles reçoivent aussi chaque image. */
  watchers: Set<(jpeg: Buffer) => void>
}

export class SimulatorManager {
  readonly simctl: Simctl
  private readonly axe: Axe | undefined
  private readonly options: SimulatorManagerOptions
  private readonly selected = new Map<string, string>()
  /** Taille de l'écran en points, par appareil. */
  private readonly screens = new Map<string, { width: number; height: number }>()
  /** Taille de l'écran en pixels, par appareil (taille des images du flux BGRA). */
  private readonly pixels = new Map<string, { width: number; height: number }>()
  /** Flux vidéo de l'onglet visible (fiche 009) : un seul à la fois. */
  private stream: StreamHandle | undefined
  /** Références de la dernière lecture d'écran (`ref_N` → point), par conversation. */
  private readonly refs = new Map<string, Map<string, { x: number; y: number }>>()
  /** Dernière vérification d'AXe (`axe --version`) : gardée si bonne, refaite sinon après un délai. */
  private axeStatus: { at: number; check: Promise<AxeCheck> } | undefined

  constructor(options: SimulatorManagerOptions) {
    this.options = options
    this.simctl = new Simctl(options.run, options.xcrun)
    this.axe = options.axeBinary ? new Axe(options.run, options.axeBinary) : undefined
  }

  /** AXe répond-il, en version suffisante ? Vérifié au premier usage. */
  async axeCheck(): Promise<AxeCheck> {
    const cached = this.axeStatus
    if (cached && (Date.now() - cached.at < AXE_RECHECK_MS || (await cached.check).ok)) {
      return cached.check
    }
    const check = checkAxe(this.options.run, this.options.axeBinary)
    this.axeStatus = { at: Date.now(), check }
    return check
  }

  /** Appareil de la conversation : celui choisi, sinon le premier démarré. */
  async device(conversationId: string): Promise<SimDevice | null> {
    const devices = await this.simctl.devices()
    const chosen = this.selected.get(conversationId)
    return (
      devices.find((d) => d.udid === chosen) ?? devices.find((d) => d.state === 'Booted') ?? null
    )
  }

  /** Appareil démarré de la conversation, ou une erreur qui dit quoi faire. */
  async bootedDevice(conversationId: string): Promise<SimDevice> {
    const device = await this.device(conversationId)
    if (!device) throw new Error('No booted simulator. Call ios_devices then ios_boot first.')
    if (device.state !== 'Booted') {
      throw new Error(`Simulator "${device.name}" is ${device.state}. Call ios_boot first.`)
    }
    return device
  }

  select(conversationId: string, udid: string): void {
    this.selected.set(conversationId, udid)
    this.refs.delete(conversationId)
  }

  /** Capture en points × `scale` : les pixels de l'image sont les coordonnées des touchers. */
  async screenshot(
    conversationId: string,
    scale = 1
  ): Promise<{ data: string; mimeType: string; width: number; height: number }> {
    const device = await this.bootedDevice(conversationId)
    const jpeg = await this.simctl.screenshot(device.udid)
    const screen = await this.screenOf(device.udid, jpeg)
    const image = this.options.resize(
      jpeg,
      Math.round(screen.width * scale),
      Math.round(screen.height * scale)
    )
    return { data: image.data, mimeType: 'image/jpeg', width: image.width, height: image.height }
  }

  /** Taille de l'écran en points (AXe la donne ; sinon déduite de la capture, échelle 3 ou 2). */
  async screen(conversationId: string): Promise<{ width: number; height: number } | null> {
    const device = await this.device(conversationId)
    if (!device || device.state !== 'Booted') return null
    return this.screenOf(device.udid)
  }

  /** Écran lu par l'accessibilité, une ligne par élément avec sa référence. */
  async describe(conversationId: string, maxChars: number) {
    const axe = await this.requireAxe()
    const device = await this.bootedDevice(conversationId)
    const refs = new Map<string, { x: number; y: number }>()
    const formatted = formatScreen(await axe.describe(device.udid), maxChars, (center) => {
      const ref = `ref_${refs.size + 1}`
      refs.set(ref, center)
      return ref
    })
    this.refs.set(conversationId, refs)
    if (formatted.screen) this.screens.set(device.udid, formatted.screen)
    return formatted
  }

  pointOf(conversationId: string, ref: string): { x: number; y: number } {
    const point = this.refs.get(conversationId)?.get(ref)
    if (!point) throw new Error(`Unknown reference ${ref}: call ios_describe again`)
    return point
  }

  async tap(conversationId: string, point: { x: number; y: number }, holdSeconds?: number) {
    const axe = await this.requireAxe()
    await axe.tap((await this.bootedDevice(conversationId)).udid, point, holdSeconds)
    this.changed(conversationId)
  }

  async tapLabel(conversationId: string, label: string) {
    const axe = await this.requireAxe()
    await axe.tapLabel((await this.bootedDevice(conversationId)).udid, label)
    this.changed(conversationId)
  }

  async swipe(
    conversationId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationSeconds: number
  ) {
    const axe = await this.requireAxe()
    await axe.swipe((await this.bootedDevice(conversationId)).udid, from, to, durationSeconds)
    this.changed(conversationId)
  }

  /**
   * Saisie dans le champ actif. Par défaut, le texte exact est collé (presse-papiers de l'appareil
   * puis ⌘V) : accents compris, sans correction automatique. `keystrokes` : touche par touche,
   * caractères du clavier américain seulement (limite d'AXe), correction d'iOS appliquée.
   */
  async type(conversationId: string, text: string, keystrokes = false) {
    const axe = await this.requireAxe()
    const { udid } = await this.bootedDevice(conversationId)
    if (keystrokes) {
      const other = [...new Set([...text].filter((c) => !/^[\x20-\x7e\n]$/.test(c)))]
      if (other.length) {
        throw new Error(
          `Key-by-key typing only supports US keyboard characters (not: ${other.join(' ')}). Omit keystrokes to paste the exact text.`
        )
      }
      await axe.type(udid, text)
    } else {
      const encoded = toMacRoman(text)
      if ('missing' in encoded) {
        throw new Error(
          `These characters cannot be sent to the simulator: ${encoded.missing.join(' ')}`
        )
      }
      await this.simctl.pbcopy(udid, encoded.bytes)
      await axe.paste(udid)
    }
    this.changed(conversationId)
  }

  async button(conversationId: string, button: HardwareButton) {
    const axe = await this.requireAxe()
    await axe.button((await this.bootedDevice(conversationId)).udid, button)
    this.changed(conversationId)
  }

  async state(conversationId: string): Promise<SimulatorState> {
    const device = await this.device(conversationId).catch(() => null)
    const screen =
      device?.state === 'Booted' ? await this.screenOf(device.udid).catch(() => null) : null
    const check = await this.axeCheck()
    const version = check.ok ? check.version : check.version
    const error = axeProblemText(check, this.options.axeInstallHint)
    return {
      conversationId,
      device,
      screen,
      touch: check.ok,
      axe: {
        ...(version ? { version } : {}),
        ...(error ? { error } : {}),
        ...(this.options.axeBinary ? { path: this.options.axeBinary } : {})
      }
    }
  }

  /**
   * Flux vidéo de l'appareil de la conversation : chaque image JPEG va à `onFrame`, la fin du flux
   * (erreur, appareil arrêté) à `onEnd`. Remplace le flux précédent. `false` sans AXe utilisable
   * ou sans appareil démarré : l'onglet garde les captures successives.
   *
   * D'abord en BGRA (fiche 044 : image de l'appareil lue par AXe, 30 images/s, ≈ 3 Mo par image
   * dans un tube local, encodée ici en JPEG) quand la taille en pixels de l'écran est connue ;
   * sinon, ou si ce flux tombe avant sa première image, ou si cette image n'a pas la forme
   * attendue, en MJPEG (fiche 009 : captures enchaînées par AXe, ≈ 10–18 images/s).
   */
  async startStream(
    conversationId: string,
    onFrame: (jpeg: Buffer) => void,
    onEnd: (reason: string) => void
  ): Promise<boolean> {
    const stream = await this.openStream(conversationId)
    if (!stream) return false
    stream.onFrame = onFrame
    stream.onEnd = onEnd
    return true
  }

  /**
   * Film de l'écran pendant `run` (planche contact, fiche 075) : les images du flux d'AXe, celui de
   * l'onglet s'il tourne, sinon un flux démarré le temps du film. Dure au moins `durationMs` après
   * la première image, et jusqu'à la fin de `run`.
   */
  async film(
    conversationId: string,
    run: () => Promise<void>,
    durationMs: number
  ): Promise<FilmFrame[]> {
    await this.bootedDevice(conversationId)
    await this.requireAxe().catch((error: unknown) => {
      const reason = messageOf(error)
      throw new Error(
        `${reason} Without AXe there is no video stream to film: take ios_screenshot captures instead.`
      )
    })
    const stream = await this.openStream(conversationId)
    if (!stream) throw new Error('No video stream from the simulator (AXe). Use ios_screenshot.')
    const received: { time: number; jpeg: Buffer }[] = []
    let firstFrame = () => {}
    const first = new Promise<void>((resolve) => (firstFrame = resolve))
    const watch = (jpeg: Buffer) => {
      if (received.length < MAX_FILM_FRAMES) received.push({ time: Date.now(), jpeg })
      firstFrame()
    }
    stream.watchers.add(watch)
    let start = Date.now()
    try {
      await Promise.race([first, delay(FILM_FIRST_FRAME_MS)])
      start = Date.now()
      await run()
      const left = durationMs - (Date.now() - start)
      if (left > 0) await delay(left)
    } finally {
      stream.watchers.delete(watch)
      // Flux démarré pour la planche, que l'onglet n'a pas repris : arrêté.
      if (this.stream === stream && !stream.onFrame && stream.watchers.size === 0) {
        this.stopStream(true)
      }
    }
    return received.map((frame) => ({ at: Math.max(0, frame.time - start), jpeg: frame.jpeg }))
  }

  /** Flux de l'appareil de la conversation, démarré s'il ne tourne pas ; `null` si impossible. */
  private async openStream(conversationId: string): Promise<StreamHandle | null> {
    const binary = this.options.axeBinary
    const device = await this.device(conversationId).catch(() => null)
    if (!binary || device?.state !== 'Booted' || !(await this.axeCheck()).ok) return null
    if (this.stream?.conversationId === conversationId && this.stream.udid === device.udid) {
      return this.stream
    }
    this.stopStream(true)
    const udid = device.udid
    const stream: StreamHandle = { conversationId, udid, watchers: new Set() }
    this.stream = stream
    const deliver = (jpeg: Buffer) => {
      stream.onFrame?.(jpeg)
      for (const watch of stream.watchers) watch(jpeg)
    }
    const encode = this.options.encodeBgra
    const pixels = encode ? await this.pixelSize(udid) : null
    if (this.stream !== stream) return null
    const geometry = pixels ? streamGeometry(pixels) : null

    const run = (format: StreamFormat) => {
      const args = ['stream-video', '--udid', udid, '--format', format, '--fps', String(STREAM_FPS)]
      if (format === 'bgra' && geometry) args.push('--scale', String(geometry.scale))
      else args.push('--scale', String(MJPEG_SCALE), '--quality', '60')
      // Son propre groupe, noté au registre (fiche 195) : repris au lancement suivant après un plantage.
      const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      trackChild(child, [binary, ...args])
      stream.child = child
      let stderr = ''
      let frames = 0
      const fail = (error: unknown) => {
        stderr += messageOf(error)
        child.kill()
      }
      if (format === 'bgra' && geometry && encode) {
        const splitter = new FixedFrames(geometry.frameSize)
        child.stdout?.on('data', (chunk: Buffer) => {
          // Seule la plus récente des images arrivées compte : les autres sont déjà en retard.
          const latest = splitter.push(chunk).at(-1)
          if (!latest) return
          if (frames === 0 && !looksLikeOpaqueBgra(latest)) {
            fail(new Error('image BGRA inattendue (largeur ou lignes), MJPEG à la place'))
            return
          }
          try {
            const jpeg = encode(latest, geometry.width, geometry.height)
            frames++
            deliver(jpeg)
          } catch (error) {
            fail(error)
          }
        })
      } else {
        const parser = new MjpegParser()
        child.stdout?.on('data', (chunk: Buffer) => {
          try {
            for (const jpeg of parser.push(chunk)) {
              frames++
              deliver(jpeg)
            }
          } catch (error) {
            fail(error)
          }
        })
      }
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString('utf8')).slice(-2000)
      })
      const silent =
        format === 'bgra'
          ? setTimeout(() => {
              if (frames === 0 && stream.child === child) child.kill()
            }, BGRA_FIRST_FRAME_MS)
          : undefined
      const end = (reason: string) => {
        clearTimeout(silent)
        if (this.stream !== stream || stream.child !== child) return
        // Flux BGRA tombé avant la première image (AXe sans ce format, image inattendue…) :
        // les captures enchaînées d'AXe, comme avant.
        if (format === 'bgra' && frames === 0) {
          run('mjpeg')
          return
        }
        this.stream = undefined
        stream.onEnd?.(reason)
      }
      child.on('error', (error) => end(error.message))
      child.on('exit', (code) =>
        end(
          stderr.trim().split('\n').at(-1) || t('simulator.streamStopped', { code: String(code) })
        )
      )
    }
    run(geometry ? 'bgra' : 'mjpeg')
    return stream
  }

  /**
   * L'onglet ne montre plus le flux. Une planche en cours le garde jusqu'à sa fin ; `force` (autre
   * appareil, fermeture de l'app) l'arrête quand même.
   */
  stopStream(force = false): void {
    const stream = this.stream
    if (!stream) return
    if (!force && stream.watchers.size > 0) {
      stream.onFrame = undefined
      stream.onEnd = undefined
      return
    }
    this.stream = undefined
    if (stream.child && stream.child.exitCode === null) stream.child.kill('SIGINT')
  }

  /** Taille de l'écran en pixels (une capture `simctl`, gardée par appareil) ; `null` si impossible. */
  private async pixelSize(udid: string): Promise<{ width: number; height: number } | null> {
    const known = this.pixels.get(udid)
    if (known) return known
    try {
      const image = this.options.resize(await this.simctl.screenshot(udid), 1, 1)
      const size = { width: image.sourceWidth, height: image.sourceHeight }
      this.pixels.set(udid, size)
      return size
    } catch {
      return null
    }
  }

  /** Quelque chose a changé à l'écran ou sur l'appareil : l'onglet se rafraîchit. */
  changed(conversationId: string): void {
    void this.state(conversationId).then((state) => this.options.emitState(state))
  }

  /** AXe utilisable (présent, répond, version suffisante), sinon une erreur qui dit quoi faire. */
  private async requireAxe(): Promise<Axe> {
    const check = await this.axeCheck()
    if (!check.ok || !this.axe) throw new Error(axeProblemForAgent(check))
    return this.axe
  }

  private async screenOf(udid: string, jpeg?: Buffer): Promise<{ width: number; height: number }> {
    const known = this.screens.get(udid)
    if (known) return known
    if (this.axe && (await this.axeCheck()).ok) {
      const root = (await this.axe.describe(udid).catch(() => []))[0]?.frame
      if (root) {
        const screen = { width: Math.round(root.width), height: Math.round(root.height) }
        this.screens.set(udid, screen)
        return screen
      }
    }
    const image = this.options.resize(jpeg ?? (await this.simctl.screenshot(udid)), 1, 1)
    const scale = image.sourceWidth > 1000 ? 3 : 2
    const screen = {
      width: Math.round(image.sourceWidth / scale),
      height: Math.round(image.sourceHeight / scale)
    }
    this.screens.set(udid, screen)
    return screen
  }
}
