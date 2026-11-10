/**
 * Capture d'écran jointe à un message (fiche 062) : l'outil de macOS (`screencapture -i`) laisse
 * l'utilisateur choisir une zone (Espace : une fenêtre ; Échap : annuler). L'image est réduite si
 * elle est trop grande, puis jointe comme une image collée. Commande remplaçable (essais :
 * `BOBINE_SCREENCAPTURE`). Sans l'autorisation « Enregistrement de l'écran », rien n'est lancé et
 * l'empêchement est rendu, pour être dit à l'utilisateur (fiche 124).
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  MAX_IMAGE_BYTES,
  type ImageAttachment,
  type ScreenCaptureResult
} from '@shared/attachments'

export type { ImageAttachment }
import type { Run } from './simulator/run'
import { log } from './log'
import { t } from 'i18next'

/** Autorisation « Enregistrement de l'écran » (`systemPreferences.getMediaAccessStatus('screen')`). */
export type ScreenAccess = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'

const SCREEN_ACCESS: readonly ScreenAccess[] = [
  'not-determined',
  'granted',
  'denied',
  'restricted',
  'unknown'
]

/**
 * Autorisation vue par l'app (captures, Diagnostic). Essais : `BOBINE_SCREEN_ACCESS` la remplace ;
 * une capture simulée (`BOBINE_SCREENCAPTURE`) n'en a pas besoin.
 */
export function screenAccessOf(
  env: NodeJS.ProcessEnv,
  system: { getMediaAccessStatus(media: 'screen'): ScreenAccess }
): ScreenAccess {
  const forced = SCREEN_ACCESS.find((a) => a === env['BOBINE_SCREEN_ACCESS'])
  if (forced) return forced
  if (env['BOBINE_SCREENCAPTURE']) return 'granted'
  return system.getMediaAccessStatus('screen')
}

/** Réglage de macOS où l'accorder : celui que la commande du Diagnostic ouvre (fiche 061). */
export const SCREEN_RECORDING_SETTINGS =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/** Ce dont la capture a besoin d'une image d'Electron (`nativeImage`), remplaçable en test. */
export interface CaptureImage {
  isEmpty(): boolean
  getSize(): { width: number; height: number }
  resize(options: { width: number; quality?: 'good' | 'better' | 'best' }): CaptureImage
  toPNG(): Buffer
  toJPEG(quality: number): Buffer
}

export interface CaptureOptions {
  run: Run
  /** `screencapture`, ou la commande des essais. */
  command: string
  decode: (data: Buffer) => CaptureImage
  /** Masque les fenêtres de l'app pendant la sélection ; rend de quoi les remettre. */
  hideWindows?: () => () => void
  /** Autorisation de macOS ; absente : la capture part (macOS demandera s'il le faut). */
  access?: () => ScreenAccess
  now?: () => Date
}

/** Au-delà, l'image est réduite (un écran Retina entier ferait plus de 5 000 px de large). */
export const MAX_CAPTURE_WIDTH = 2000

const pad = (n: number) => String(n).padStart(2, '0')

/** Nom à la manière de macOS : « Capture d’écran 2026-10-15 à 09.12.33.png ». */
export function captureName(at: Date, extension: 'png' | 'jpg'): string {
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  const time = `${pad(at.getHours())}.${pad(at.getMinutes())}.${pad(at.getSeconds())}`
  return t('capture.fileName', { date, time, extension })
}

/**
 * Zone choisie par l'utilisateur, en image jointe ; `null` s'il a annulé. Autorisation refusée ou
 * restreinte : rien n'est lancé (macOS ne rendrait rien, ou le fond d'écran). Jamais demandée :
 * la capture part et macOS pose la question.
 */
export async function captureScreen(options: CaptureOptions): Promise<ScreenCaptureResult> {
  const access = options.access?.()
  if (access === 'denied' || access === 'restricted') return { kind: 'unavailable', reason: access }
  const dir = await mkdtemp(join(tmpdir(), 'bob-capture-'))
  const file = join(dir, 'capture.png')
  const restore = options.hideWindows?.()
  try {
    // -i : zone ou fenêtre choisie à la souris ; -x : sans le bruit d'appareil photo.
    const result = await options.run(options.command, ['-i', '-x', '-t', 'png', file], {
      timeoutMs: 5 * 60_000
    })
    const data = await readFile(file).catch(() => undefined)
    // Échap : code 0, pas de fichier. Sans l'autorisation, une zone choisie : code 1, « could not
    // create image from rect », pas de fichier (essayé sur macOS 27). Un fichier vide non plus
    // n'est pas une annulation.
    if (!data && result.code === 0) return null
    if (!data?.length) {
      log.warn('Capture d’écran sans image', { code: result.code, stderr: result.stderr.trim() })
      return { kind: 'unavailable', reason: 'failed' }
    }
    return encodeCapture(options.decode(data), (options.now ?? (() => new Date()))())
  } finally {
    restore?.()
    await rm(dir, { recursive: true, force: true })
  }
}

/** Capture d'écran nommée à la manière de macOS. */
export function encodeCapture(image: CaptureImage, at: Date): ImageAttachment | null {
  return encodeImage(image, captureName(at, 'png').replace(/\.png$/, ''))
}

/**
 * Image réduite si besoin, en PNG, ou en JPEG si le PNG dépasse la taille d'une pièce jointe
 * (`name` sans extension : `.png` ou `.jpg` selon le format retenu).
 */
export function encodeImage(image: CaptureImage, name: string): ImageAttachment | null {
  if (image.isEmpty()) return null
  const scaled =
    image.getSize().width > MAX_CAPTURE_WIDTH
      ? image.resize({ width: MAX_CAPTURE_WIDTH, quality: 'best' })
      : image
  const png = scaled.toPNG()
  if (png.length <= MAX_IMAGE_BYTES) {
    return {
      kind: 'image',
      name: `${name}.png`,
      mimeType: 'image/png',
      data: png.toString('base64')
    }
  }
  for (const quality of [85, 70, 50]) {
    const jpeg = scaled.toJPEG(quality)
    if (jpeg.length <= MAX_IMAGE_BYTES) {
      return {
        kind: 'image',
        name: `${name}.jpg`,
        mimeType: 'image/jpeg',
        data: jpeg.toString('base64')
      }
    }
  }
  throw new Error(t('capture.tooLarge'))
}
