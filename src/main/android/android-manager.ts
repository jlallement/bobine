/**
 * Émulateur Android d'une conversation (fiche 032) : appareil choisi, captures et coordonnées en dp
 * (comme les points d'iOS), lecture de l'écran avec références, touchers convertis en pixels. Tout
 * suit l'orientation courante de l'écran (fiche 081).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import type { AndroidDevice, AndroidState } from '@shared/android'
import { H264Splitter, type H264Frame } from './h264'
import type { EncodeBgra, ResizeJpeg } from '../simulator/simulator-manager'
import type { FilmFrame } from '../filmstrip/sheet'
import { RawFrameSplitter, toBgra } from './raw-frames'
import type { Run } from '../simulator/run'
import { Adb, KEYS } from './adb'
import { formatUiDump, parseUiDump } from './ui-dump'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { delay } from '../delay'
import { stopGroup } from '../process-group'
import { trackChild } from '../process-registry'

export interface AndroidManagerOptions {
  run: Run
  adb: string
  emulator: string
  /** Mise à l'échelle d'une capture (PNG ou JPEG) : Electron `nativeImage`, injecté pour les tests. */
  resize: ResizeJpeg
  /** Image BGRA → JPEG (Electron `nativeImage`) : images de la planche contact (fiche 076). */
  encodeBgra?: EncodeBgra
  emitState: (state: AndroidState) => void
}

/** Planche contact (fiche 076) : attente de la première image, images gardées au plus. */
const FILM_FIRST_FRAME_MS = 6000
const MAX_FILM_FRAMES = 300
/** Pendant la vidéo : orientation relue à ce rythme, pour relancer `screenrecord` si elle change. */
const ORIENTATION_POLL_MS = 1000

interface Display {
  width: number
  height: number
  /** Pixels par dp (densité / 160). */
  ratio: number
}

/** Écran dans son orientation courante (pixels), d'après la taille physique et `dumpsys`. */
interface Current extends Display {
  /** Quarts de tour du dessin par rapport à la position naturelle (0 à 3). */
  rotation: number
  /** Rayon des coins déclaré par l'appareil, en pixels (0 : rien). */
  cornerRadius: number
}

export class AndroidManager {
  readonly adb: Adb
  private readonly options: AndroidManagerOptions
  private readonly selected = new Map<string, string>()
  private readonly displays = new Map<string, Display>()
  /** Dernière orientation vue par appareil, pour signaler un changement à l'onglet. */
  private readonly orientations = new Map<string, string>()
  private readonly refs = new Map<string, Map<string, { x: number; y: number }>>()
  /** Flux vidéo de l'onglet visible : un seul à la fois. */
  private stream: Stream | undefined

  constructor(options: AndroidManagerOptions) {
    this.options = options
    this.adb = new Adb(options.run, options.adb, options.emulator)
  }

  /** Appareil de la conversation : celui choisi, sinon le premier prêt. */
  async device(conversationId: string): Promise<AndroidDevice | null> {
    const devices = await this.adb.devices()
    const chosen = this.selected.get(conversationId)
    return (
      devices.find((d) => d.serial === chosen) ?? devices.find((d) => d.state === 'device') ?? null
    )
  }

  async readyDevice(conversationId: string): Promise<AndroidDevice> {
    const device = await this.device(conversationId)
    if (!device)
      throw new Error('No Android device running. Call android_devices then android_boot.')
    if (device.state !== 'device') {
      throw new Error(
        `Android device "${device.name}" is ${device.state}. Call android_boot again.`
      )
    }
    return device
  }

  select(conversationId: string, serial: string): void {
    this.selected.set(conversationId, serial)
    this.refs.delete(conversationId)
  }

  /** Taille de l'écran en dp, orientation comprise (coordonnées de l'agent). */
  async screen(conversationId: string): Promise<{ width: number; height: number } | null> {
    const device = await this.device(conversationId).catch(() => null)
    if (device?.state !== 'device') return null
    const current = await this.current(device.serial, conversationId).catch(() => null)
    return current ? this.dp(current) : null
  }

  /** Capture en dp × `scale` : les pixels de l'image sont les coordonnées des touchers. */
  async screenshot(conversationId: string, scale = 1) {
    const device = await this.readyDevice(conversationId)
    const [png, display] = await Promise.all([
      this.adb.screenshot(device.serial),
      this.current(device.serial, conversationId)
    ])
    const dp = this.dp(display)
    const image = this.options.resize(
      png,
      Math.round(dp.width * scale),
      Math.round(dp.height * scale)
    )
    return { data: image.data, mimeType: 'image/jpeg', width: image.width, height: image.height }
  }

  async describe(conversationId: string, maxChars: number) {
    const device = await this.readyDevice(conversationId)
    const [xml, display] = await Promise.all([
      this.adb.uiDump(device.serial),
      this.current(device.serial, conversationId)
    ])
    const refs = new Map<string, { x: number; y: number }>()
    const formatted = formatUiDump(parseUiDump(xml), 1 / display.ratio, maxChars, (center) => {
      const ref = `ref_${refs.size + 1}`
      refs.set(ref, center)
      return ref
    })
    this.refs.set(conversationId, refs)
    return { ...formatted, screen: this.dp(display) }
  }

  pointOf(conversationId: string, ref: string): { x: number; y: number } {
    const point = this.refs.get(conversationId)?.get(ref)
    if (!point) throw new Error(`Unknown reference ${ref}: call android_describe again`)
    return point
  }

  /** Toucher en dp (appui long si `holdMs`). */
  async tap(conversationId: string, point: { x: number; y: number }, holdMs?: number) {
    const { serial, display } = await this.target(conversationId)
    await this.adb.tap(serial, ...this.px(display, point), holdMs)
    this.changed(conversationId)
  }

  async swipe(
    conversationId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    ms: number
  ) {
    const { serial, display } = await this.target(conversationId)
    const [x1, y1] = this.px(display, from)
    const [x2, y2] = this.px(display, to)
    await this.adb.swipe(serial, { x: x1, y: y1 }, { x: x2, y: y2 }, ms)
    this.changed(conversationId)
  }

  /** Saisie dans le champ actif (ASCII seulement : limite de `input text`). */
  async type(conversationId: string, text: string) {
    const other = [...new Set([...text].filter((c) => !/^[\x20-\x7e]$/.test(c)))]
    if (other.length) {
      throw new Error(
        `Android input only supports ASCII characters (not: ${other.join(' ')}): type the rest another way or skip them.`
      )
    }
    const device = await this.readyDevice(conversationId)
    await this.adb.text(device.serial, text)
    this.changed(conversationId)
  }

  async key(conversationId: string, key: string) {
    const keycode = KEYS[key.toLowerCase()] ?? (/^KEYCODE_[A-Z0-9_]+$/.test(key) ? key : undefined)
    if (!keycode)
      throw new Error(`Unknown key "${key}" (${Object.keys(KEYS).join(', ')} or KEYCODE_*)`)
    const device = await this.readyDevice(conversationId)
    await this.adb.key(device.serial, keycode)
    this.changed(conversationId)
  }

  async state(conversationId: string): Promise<AndroidState> {
    const device = await this.device(conversationId).catch(() => null)
    const current =
      device?.state === 'device' ? await this.current(device.serial).catch(() => null) : null
    if (!current) return { conversationId, device, screen: null, sdk: true }
    return {
      conversationId,
      device,
      screen: this.dp(current),
      rotation: current.rotation,
      cornerRadius: Math.round(current.cornerRadius / current.ratio),
      sdk: true
    }
  }

  /**
   * Flux vidéo de l'appareil (`screenrecord`, H.264 décodé par Chromium dans l'onglet). Relancé
   * quand `screenrecord` atteint sa limite de durée ; `false` sans appareil prêt.
   */
  async startStream(
    conversationId: string,
    onFrame: (frame: H264Frame) => void,
    onEnd: (reason: string) => void
  ): Promise<boolean> {
    const device = await this.device(conversationId).catch(() => null)
    if (device?.state !== 'device') return false
    if (this.stream?.conversationId === conversationId && this.stream.serial === device.serial) {
      return true
    }
    this.stopStream()
    const display = await this.current(device.serial, conversationId)
    // Moitié de la définition, en multiples de 16 (exigence de certains encodeurs).
    const size = (n: number) => Math.max(16, Math.round(n / 2 / 16) * 16)
    const stream: Stream = { conversationId, serial: device.serial }
    this.stream = stream
    // `screenrecord` garde sa taille de départ : si l'écran tourne, il met l'image en bandes.
    // L'orientation est relue ; un changement est signalé à l'onglet, qui relance la vidéo.
    stream.poll = setInterval(() => {
      if (this.stream === stream) void this.current(device.serial, conversationId).catch(() => {})
    }, ORIENTATION_POLL_MS)
    const record = () => {
      if (this.stream !== stream) return
      const splitter = new H264Splitter()
      let idle: NodeJS.Timeout | undefined
      let stderr = ''
      const startedAt = Date.now()
      const child = spawn(
        this.options.adb,
        [
          '-s',
          device.serial,
          'exec-out',
          'screenrecord',
          '--output-format=h264',
          '--size',
          `${size(display.width)}x${size(display.height)}`,
          '--bit-rate',
          '6000000',
          '-'
        ],
        // Son propre groupe, noté au registre (fiche 195).
        { stdio: ['ignore', 'pipe', 'pipe'], detached: true }
      )
      trackChild(child, [this.options.adb, 'exec-out', 'screenrecord'])
      stream.child = child
      child.stdout?.on('data', (chunk: Buffer) => {
        for (const frame of splitter.push(chunk)) onFrame(frame)
        clearTimeout(idle)
        idle = setTimeout(() => splitter.flush().forEach(onFrame), 30)
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString('utf8')).slice(-2000)
      })
      child.on('exit', (code) => {
        clearTimeout(idle)
        if (this.stream !== stream) return
        // Fin normale au bout de la durée maximale : on enchaîne un nouvel enregistrement.
        if (code === 0 && Date.now() - startedAt > 5000) return record()
        this.stopStream()
        onEnd(
          stderr.trim().split('\n').at(-1) || t('simulator.streamStopped', { code: String(code) })
        )
      })
      child.on('error', (error) => {
        if (this.stream !== stream) return
        this.stopStream()
        onEnd(error.message)
      })
    }
    record()
    return true
  }

  /**
   * Film de l'écran pendant `run` (planche contact, fiche 076) : un second `screenrecord`, en
   * images brutes à la taille en dp, le temps du film (celui de l'onglet n'est pas touché). Chaque
   * image passe en JPEG à son arrivée. Dure au moins `durationMs` après la première image, et
   * jusqu'à la fin de `run` ; sans première image, rien n'est fait.
   */
  async film(
    conversationId: string,
    run: () => Promise<void>,
    durationMs: number
  ): Promise<FilmFrame[]> {
    const encode = this.options.encodeBgra
    if (!encode) throw new Error('Filming is not available here: use android_screenshot.')
    const { serial, display } = await this.target(conversationId)
    const dp = this.dp(display)
    const child = spawn(
      this.options.adb,
      [
        '-s',
        serial,
        'exec-out',
        'screenrecord',
        '--output-format=frames',
        '--size',
        `${dp.width}x${dp.height}`,
        '-'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], detached: true }
    )
    trackChild(child, [this.options.adb, 'exec-out', 'screenrecord'])
    const splitter = new RawFrameSplitter()
    const received: { time: number; jpeg: Buffer }[] = []
    let problem: string | undefined
    let stderr = ''
    let firstFrame = () => {}
    const first = new Promise<void>((resolve) => (firstFrame = resolve))
    child.stdout?.on('data', (chunk: Buffer) => {
      if (problem) return
      try {
        for (const frame of splitter.push(chunk)) {
          if (received.length >= MAX_FILM_FRAMES) continue
          const time = Date.now()
          const bitmap = toBgra(frame)
          const bgra = Buffer.from(bitmap.data.buffer, bitmap.data.byteOffset, bitmap.data.length)
          received.push({ time, jpeg: encode(bgra, bitmap.width, bitmap.height) })
          firstFrame()
        }
      } catch (error) {
        problem = messageOf(error)
        stopGroup(child)
        firstFrame()
      }
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-2000)
    })
    // `close` et non `exit` : le processus peut finir avant que sa sortie d'erreur soit lue
    // (Linux), et la raison de l'échec serait perdue.
    child.on('close', () => firstFrame())
    child.on('error', (error) => {
      problem ??= error.message
      firstFrame()
    })
    let start = Date.now()
    try {
      await Promise.race([first, delay(FILM_FIRST_FRAME_MS)])
      if (received.length === 0) {
        const reason = problem ?? (stderr.trim().split('\n').at(-1) || 'no frame')
        throw new Error(
          `No image from the Android screen (screenrecord --output-format=frames: ${reason}). Nothing was done: take android_screenshot captures instead.`
        )
      }
      start = Date.now()
      await run()
      const left = durationMs - (Date.now() - start)
      if (left > 0) await delay(left)
    } finally {
      // Tout le groupe (fiche 208) : un `adb` qui lance des enfants ne les laisse pas derrière lui.
      stopGroup(child)
    }
    return received.map((frame) => ({ at: Math.max(0, frame.time - start), jpeg: frame.jpeg }))
  }

  stopStream(): void {
    const stream = this.stream
    this.stream = undefined
    clearInterval(stream?.poll)
    // Tout le groupe, attendu en quittant (fiche 208) : SIGTERM au seul chef laissait ses enfants
    // vivre après l'app (chef encore « zombie » quand le registre le vérifie).
    if (stream?.child) stopGroup(stream.child)
  }

  changed(conversationId: string): void {
    void this.state(conversationId).then((state) => this.options.emitState(state))
  }

  private async target(conversationId: string) {
    const device = await this.readyDevice(conversationId)
    return { serial: device.serial, display: await this.current(device.serial, conversationId) }
  }

  /**
   * Écran dans son orientation courante (taille physique en cache, orientation relue) ; un
   * changement d'orientation est signalé à l'onglet de la conversation.
   */
  private async current(serial: string, conversationId?: string): Promise<Current> {
    const [display, orientation] = await Promise.all([
      this.display(serial),
      this.adb.orientation(serial).catch(() => null)
    ])
    const current: Current = orientation
      ? { ...orientation, ratio: display.ratio }
      : { ...display, rotation: 0, cornerRadius: 0 }
    const key = `${current.width}x${current.height}@${current.rotation}`
    const before = this.orientations.get(serial)
    this.orientations.set(serial, key)
    if (conversationId && before !== undefined && before !== key) this.changed(conversationId)
    return current
  }

  private async display(serial: string): Promise<Display> {
    const known = this.displays.get(serial)
    if (known) return known
    const { width, height, density } = await this.adb.display(serial)
    const display = { width, height, ratio: density / 160 }
    this.displays.set(serial, display)
    return display
  }

  private dp(display: Display) {
    return {
      width: Math.round(display.width / display.ratio),
      height: Math.round(display.height / display.ratio)
    }
  }

  private px(display: Display, point: { x: number; y: number }): [number, number] {
    return [Math.round(point.x * display.ratio), Math.round(point.y * display.ratio)]
  }
}

interface Stream {
  conversationId: string
  serial: string
  child?: ChildProcess
  /** Relecture de l'orientation pendant la vidéo. */
  poll?: NodeJS.Timeout
}
