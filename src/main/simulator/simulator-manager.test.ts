import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Run } from './run'
import { SimulatorManager } from './simulator-manager'
import { simulatorController } from './simulator-setup'

/**
 * Flux vidéo du simulateur (fiches 009, 044) : ce que devient la mort du processus `axe
 * stream-video`. Le processus est simulé (`spawn`), comme `xcrun` et `axe --version` (`Run`) :
 * aucun Xcode ni AXe n'est nécessaire. Remplace la vérification « flux interrompu : retour aux
 * captures successives, raison affichée » de l'e2e `simulator` (n° 14), côté main.
 */

/** Faux processus `axe stream-video` : sorties pilotées par l'essai. */
class FakeStream extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  exitCode: number | null = null
  readonly args: string[]
  killed: (string | undefined)[] = []
  constructor(args: string[]) {
    super()
    this.args = args
  }
  kill(signal?: string): boolean {
    this.killed.push(signal)
    this.exit(null)
    return true
  }
  /** Fin du processus : sortie d'erreur lue d'abord, comme pour un vrai tube. */
  exit(code: number | null): void {
    if (this.exitCode !== null) return
    this.exitCode = code ?? 1
    setImmediate(() => this.emit('exit', code))
  }
}

const spawned: FakeStream[] = []

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    spawn: vi.fn((_file: string, args: string[]) => {
      const child = new FakeStream(args)
      spawned.push(child)
      return child
    })
  }
})

/** Faux `xcrun simctl list` (un iPhone démarré) et `axe --version` en version suffisante. */
const run: Run = async (file, args) => {
  const ok = (stdout: string) => ({ code: 0, stdout: Buffer.from(stdout), stderr: '' })
  if (file === 'xcrun' && args[1] === 'list') {
    return ok(
      JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
            { udid: 'U1', name: 'iPhone 17', state: 'Booted' }
          ]
        }
      })
    )
  }
  // Capture (taille de l'écran en pixels, pour le flux BGRA) : le faux `resize` la mesure.
  if (file === 'xcrun' && args[1] === 'io') return ok('jpeg')
  if (file.endsWith('axe') && args[0] === '--version') return ok('1.8.0\n')
  return { code: 1, stdout: Buffer.alloc(0), stderr: 'inconnu' }
}

function manager(options: { encodeBgra?: boolean } = {}) {
  return new SimulatorManager({
    run,
    axeBinary: '/bin/axe',
    resize: (_jpeg, width, height) => ({
      data: 'AA==',
      width,
      height,
      sourceWidth: 1206,
      sourceHeight: 2622
    }),
    ...(options.encodeBgra ? { encodeBgra: () => Buffer.from('jpeg') } : {}),
    emitState: () => {}
  })
}

/** Une image du flux MJPEG d'AXe : en-tête HTTP, séparateur, longueur, octets. */
const IMAGE = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9])
const JPEG = Buffer.concat([
  Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace\r\n\r\n'),
  Buffer.from(`--mjpegstream\r\nContent-Length: ${IMAGE.length}\r\n\r\n`),
  IMAGE
])

const formatOf = (child: FakeStream | undefined) => child?.args[child.args.indexOf('--format') + 1]

async function until(condition: () => boolean): Promise<void> {
  await vi.waitFor(() => {
    if (!condition()) throw new Error('pas encore')
  })
}

describe('flux vidéo du simulateur : mort du processus (fiches 009, 044)', () => {
  afterEach(() => {
    spawned.length = 0
  })

  it('flux MJPEG tombé : la raison d’AXe va à l’onglet, qui repasse aux captures ; un nouveau flux repart', async () => {
    const sim = manager()
    const frames: Buffer[] = []
    const ends: string[] = []
    expect(
      await sim.startStream(
        'c1',
        (jpeg) => frames.push(jpeg),
        (r) => ends.push(r)
      )
    ).toBe(true)
    const child = spawned[0]
    expect(formatOf(child)).toBe('mjpeg')
    child?.stdout.write(JPEG)
    await until(() => frames.length === 1)
    expect(frames[0]).toEqual(IMAGE)

    // AXe meurt : sa dernière ligne d'erreur est la raison, une seule fois.
    child?.stderr.write('stream-video: device disconnected\nAXe: simulator went away\n')
    await new Promise((r) => setImmediate(r))
    child?.exit(3)
    await until(() => ends.length === 1)
    expect(ends).toEqual(['AXe: simulator went away'])

    // Le flux mort est oublié : l'onglet peut en redemander un, un nouveau processus part.
    expect(
      await sim.startStream(
        'c1',
        () => {},
        () => {}
      )
    ).toBe(true)
    expect(spawned).toHaveLength(2)
  })

  it('mort sans message : la raison dit le code de sortie, dans la langue de l’app', async () => {
    const sim = manager()
    const ends: string[] = []
    await sim.startStream(
      'c1',
      () => {},
      (r) => ends.push(r)
    )
    spawned[0]?.exit(9)
    await until(() => ends.length === 1)
    expect(ends).toEqual(['flux arrêté (code 9)'])
  })

  it('arrêté par l’onglet : aucune raison remontée (ce n’est pas une panne)', async () => {
    const sim = manager()
    const ends: string[] = []
    await sim.startStream(
      'c1',
      () => {},
      (r) => ends.push(r)
    )
    sim.stopStream()
    await new Promise((r) => setImmediate(r))
    await new Promise((r) => setImmediate(r))
    expect(spawned[0]?.killed).toEqual(['SIGINT'])
    expect(ends).toEqual([])
  })

  it('flux BGRA tombé avant sa première image : repli en MJPEG, sans fin dite à l’onglet', async () => {
    const sim = manager({ encodeBgra: true })
    const ends: string[] = []
    await sim.startStream(
      'c1',
      () => {},
      (r) => ends.push(r)
    )
    expect(formatOf(spawned[0])).toBe('bgra')
    spawned[0]?.stderr.write('unsupported format bgra\n')
    spawned[0]?.exit(1)
    await until(() => spawned.length === 2)
    expect(formatOf(spawned[1])).toBe('mjpeg')
    expect(ends).toEqual([])
    // Le repli meurt à son tour : là, l'onglet l'apprend.
    spawned[1]?.exit(2)
    await until(() => ends.length === 1)
  })

  it('l’IPC relaie la fin du flux à la fenêtre (`simulator:streamEnded`), avec sa conversation', async () => {
    const sim = manager()
    const send = vi.fn()
    const controller = simulatorController(sim, send)
    expect(await controller.startStream('c1')).toBe(true)
    spawned[0]?.stdout.write(JPEG)
    await until(() => send.mock.calls.some(([channel]) => channel === 'simulator:frame'))
    spawned[0]?.stderr.write('AXe: boom\n')
    await new Promise((r) => setImmediate(r))
    spawned[0]?.exit(1)
    await until(() => send.mock.calls.some(([channel]) => channel === 'simulator:streamEnded'))
    expect(send).toHaveBeenCalledWith('simulator:streamEnded', {
      conversationId: 'c1',
      reason: 'AXe: boom'
    })
  })

  it('sans AXe : pas de flux, l’onglet garde les captures successives', async () => {
    const sim = new SimulatorManager({
      run,
      axeBinary: undefined,
      resize: () => ({ data: '', width: 1, height: 1, sourceWidth: 1, sourceHeight: 1 }),
      emitState: () => {}
    })
    expect(
      await sim.startStream(
        'c1',
        () => {},
        () => {}
      )
    ).toBe(false)
    expect(spawned).toHaveLength(0)
  })
})
