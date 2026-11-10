/**
 * Essai manuel du simulateur iOS avec le vrai AXe (fiche 043, ADR-0009) : à lancer avant une
 * version de l'app, et après une mise à jour d'Xcode ou d'AXe. Jamais en CI.
 *
 *   pnpm simulator-smoke [--keep] [--axe <chemin>]
 *
 * Crée son propre simulateur (« Bobine Smoke », jamais celui de l'utilisateur), le démarre,
 * ouvre Réglages, lit l'écran, touche, colle du texte, capture, reçoit quelques images du flux
 * vidéo, puis supprime le simulateur (sauf --keep).
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  Axe,
  checkAxe,
  findAxe,
  formatScreen,
  MIN_AXE_VERSION,
  type AxeElement
} from '../src/main/simulator/axe.ts'
import {
  FixedFrames,
  looksLikeOpaqueBgra,
  streamGeometry
} from '../src/main/simulator/bgra-frames.ts'
import { MjpegParser } from '../src/main/simulator/mjpeg.ts'
import { runCommand } from '../src/main/simulator/run.ts'
import { Simctl, toMacRoman } from '../src/main/simulator/simctl.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { keep: { type: 'boolean' }, axe: { type: 'string' } } })
const DEVICE_NAME = 'Bobine Smoke'
const STREAM_SECONDS = 3

let failures = 0
const check = (ok: boolean, label: string, detail = ''): void => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const text = (buffer: Buffer) => buffer.toString('utf8').trim()

interface Runtime {
  identifier: string
  name: string
  platform?: string
  isAvailable?: boolean
  version?: string
  supportedDeviceTypes?: { identifier: string; name: string }[]
}

/** Runtime iOS disponible le plus récent et un iPhone qu'il accepte. */
async function pickRuntime(): Promise<{ runtime: Runtime; deviceType: string } | undefined> {
  const out = await runCommand('xcrun', ['simctl', 'list', 'runtimes', '-j'])
  if (out.code !== 0) return undefined
  const runtimes = (JSON.parse(text(out.stdout)) as { runtimes?: Runtime[] }).runtimes ?? []
  const ios = runtimes
    .filter((r) => r.isAvailable !== false && (r.platform ?? r.name).includes('iOS'))
    .sort((a, b) => (b.version ?? '').localeCompare(a.version ?? '', undefined, { numeric: true }))
  for (const runtime of ios) {
    const types = runtime.supportedDeviceTypes ?? []
    const phone =
      types.find((t) => /^iPhone \d+$/.test(t.name)) ?? types.find((t) => /iPhone/.test(t.name))
    if (phone) return { runtime, deviceType: phone.identifier }
  }
  return undefined
}

/**
 * `describe-ui` échoue parfois juste après un geste (« No translation object returned » pendant
 * l'animation du clavier sur un simulateur tout neuf) : on réessaie un peu plus tard.
 */
async function describeSettled(axe: Axe, udid: string): Promise<AxeElement[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await axe.describe(udid)
    } catch (error) {
      if (attempt >= 2) throw error
      await sleep(1500)
    }
  }
}

/** Largeur et hauteur en pixels d'un JPEG (marqueur SOF), sans décoder l'image. */
function jpegSize(jpeg: Buffer): { width: number; height: number } {
  let offset = 2
  while (offset + 9 < jpeg.length) {
    if (jpeg[offset] !== 0xff) throw new Error('JPEG inattendu')
    const marker = jpeg[offset + 1] ?? 0
    const length = jpeg.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: jpeg.readUInt16BE(offset + 5), width: jpeg.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  throw new Error('JPEG sans en-tête de taille')
}

/** Quelques secondes de `axe stream-video` en MJPEG (captures enchaînées) : images reçues. */
function streamFrames(binary: string, udid: string, seconds: number): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      binary,
      ['stream-video', '--udid', udid, '--format', 'mjpeg', '--fps', '30', '--scale', '0.5'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const parser = new MjpegParser()
    let frames = 0
    child.stdout.on('data', (chunk: Buffer) => {
      frames += parser.push(chunk).length
    })
    child.on('exit', () => resolve(frames))
    setTimeout(() => child.kill('SIGINT'), seconds * 1000)
  })
}

/**
 * Quelques secondes de `axe stream-video --format bgra` (image de l'appareil, fiche 044), à la
 * géométrie que l'app demande : images reçues, et si la première a bien la forme attendue.
 */
function streamBgra(
  binary: string,
  udid: string,
  pixels: { width: number; height: number },
  seconds: number
): Promise<{ frames: number; opaque: boolean; geometry: ReturnType<typeof streamGeometry> }> {
  const geometry = streamGeometry(pixels)
  if (!geometry) return Promise.resolve({ frames: 0, opaque: false, geometry })
  return new Promise((resolve) => {
    const child = spawn(
      binary,
      [
        'stream-video',
        '--udid',
        udid,
        '--format',
        'bgra',
        '--fps',
        '30',
        '--scale',
        String(geometry.scale)
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const splitter = new FixedFrames(geometry.frameSize)
    let frames = 0
    let opaque = false
    child.stdout.on('data', (chunk: Buffer) => {
      for (const frame of splitter.push(chunk)) {
        if (frames === 0) opaque = looksLikeOpaqueBgra(frame)
        frames++
      }
    })
    child.on('exit', () => resolve({ frames, opaque, geometry }))
    setTimeout(() => child.kill('SIGINT'), seconds * 1000)
  })
}

async function main(): Promise<void> {
  console.log('— Simulateur iOS avec le vrai AXe')
  const binary = values.axe ?? findAxe(process.env, [join(root, 'vendor', 'axe', 'axe')])
  const axeCheck = await checkAxe(runCommand, binary)
  check(
    axeCheck.ok,
    `AXe (${binary ?? 'introuvable'})`,
    axeCheck.ok
      ? `version ${axeCheck.version}`
      : `${axeCheck.problem}${axeCheck.version ? ` ${axeCheck.version}` : ''}, minimum ${MIN_AXE_VERSION}`
  )
  if (!axeCheck.ok || !binary) return
  const axe = new Axe(runCommand, binary)
  const simctl = new Simctl(runCommand)

  const picked = await pickRuntime()
  check(!!picked, 'runtime iOS et type d’iPhone', picked ? `${picked.runtime.name}` : 'aucun')
  if (!picked) return

  const created = await runCommand('xcrun', [
    'simctl',
    'create',
    DEVICE_NAME,
    picked.deviceType,
    picked.runtime.identifier
  ])
  const udid = text(created.stdout)
  check(created.code === 0 && !!udid, 'simulateur créé', udid || created.stderr.trim())
  if (!udid) return

  try {
    await simctl.boot(udid)
    const booted = await simctl.waitBooted(udid, 180_000)
    check(booted, 'simulateur démarré')
    if (!booted) return

    await simctl.launch(udid, 'com.apple.Preferences')
    await sleep(2500)

    const refs: { x: number; y: number }[] = []
    const refFor = (center: { x: number; y: number }) => {
      refs.push(center)
      return `ref_${refs.length}`
    }
    const first = formatScreen(await axe.describe(udid), 20_000, refFor)
    check(
      first.lines.length > 3 && !!first.screen,
      'lecture de l’écran (describe-ui)',
      `${first.lines.length} éléments, écran ${first.screen?.width}×${first.screen?.height}`
    )

    const target = first.lines.findIndex((line) => /^\s*- (Button|Cell)/.test(line))
    const point = refs[target]
    if (point) {
      await axe.tap(udid, point)
      await sleep(1500)
      const after = formatScreen(await axe.describe(udid), 20_000, () => 'ref')
      check(
        after.lines.join('\n') !== first.lines.join('\n'),
        'toucher à un point : l’écran a changé',
        first.lines[target]?.trim() ?? ''
      )
    } else {
      check(false, 'toucher : aucun bouton trouvé dans Réglages')
    }

    await axe.button(udid, 'home')
    await sleep(1000)
    await simctl.launch(udid, 'com.apple.Preferences')
    await sleep(2000)
    const fields: { x: number; y: number }[] = []
    const home = formatScreen(await axe.describe(udid), 20_000, (c) => {
      fields.push(c)
      return `ref_${fields.length}`
    })
    const field = home.lines.findIndex((line) => /^\s*- (TextField|SearchField)/.test(line))
    const fieldPoint = fields[field]
    if (fieldPoint) {
      await axe.tap(udid, fieldPoint)
      await sleep(800)
      const encoded = toMacRoman('Zoé ça')
      if ('bytes' in encoded) {
        await simctl.pbcopy(udid, encoded.bytes)
        await axe.paste(udid)
        await sleep(800)
        const typed = formatScreen(await describeSettled(axe, udid), 20_000, () => 'ref')
        check(
          typed.lines.some((line) => line.includes('Zoé ça')),
          'saisie exacte collée (pbcopy MacRoman + ⌘V)',
          typed.lines.find((line) => /TextField|SearchField/.test(line))?.trim() ?? ''
        )
      }
    } else {
      check(false, 'saisie : aucun champ de texte trouvé dans Réglages')
    }

    const jpeg = await simctl.screenshot(udid)
    check(jpeg.length > 10_000, 'capture simctl', `${Math.round(jpeg.length / 1024)} Ko`)

    const frames = await streamFrames(binary, udid, STREAM_SECONDS)
    check(
      frames >= STREAM_SECONDS * 5,
      'flux vidéo de secours (stream-video MJPEG)',
      `${frames} images en ${STREAM_SECONDS} s (${(frames / STREAM_SECONDS).toFixed(1)} i/s)`
    )
    const bgra = await streamBgra(binary, udid, jpegSize(jpeg), STREAM_SECONDS)
    check(
      bgra.frames >= STREAM_SECONDS * 20 && bgra.opaque,
      'flux vidéo de l’app (stream-video BGRA, image de l’appareil)',
      `${bgra.frames} images en ${STREAM_SECONDS} s (${(bgra.frames / STREAM_SECONDS).toFixed(1)} i/s), ${bgra.geometry?.width}×${bgra.geometry?.height}, première image ${bgra.opaque ? 'conforme' : 'INATTENDUE'}`
    )
  } finally {
    if (values.keep) {
      console.log(`  (simulateur gardé : ${udid})`)
    } else {
      await runCommand('xcrun', ['simctl', 'shutdown', udid], { timeoutMs: 60_000 })
      const deleted = await runCommand('xcrun', ['simctl', 'delete', udid], { timeoutMs: 60_000 })
      check(deleted.code === 0, 'simulateur supprimé')
    }
  }
}

await main()
console.log(failures ? `\n✗ ${failures} échec(s)` : '\n✓ simulateur ok')
process.exit(failures ? 1 : 0)
