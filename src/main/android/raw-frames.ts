/**
 * Images brutes de `screenrecord --output-format=frames` (fiche 076), pour la planche contact :
 * découpage du flux en images, puis pixels BGRA (ordre de `nativeImage` sur macOS). Pur, pour les
 * tests.
 *
 * Relevé (Android 16, screenrecord 1.4) : pour chaque image, 5 entiers de 32 bits petit-boutistes
 * — longueur de la suite (16 + octets des pixels), largeur, hauteur, octets par ligne, format
 * (3 = RGB_888) — puis les pixels, sans remplissage final. Une image à l'ouverture, puis une à
 * chaque changement de l'écran.
 */
import type { Bitmap } from '../filmstrip/select'

export interface RawFrame {
  width: number
  height: number
  /** Octets par ligne. */
  stride: number
  /** Format de pixels d'Android (`HAL_PIXEL_FORMAT_*`). */
  format: number
  pixels: Buffer
}

const HEADER = 20
/** Au-delà, l'en-tête est faux (le flux n'est pas au format `frames`). */
const MAX_LENGTH = 16 + 8192 * 8192 * 4

/**
 * Formats connus : octets par pixel et place du rouge, du vert et du bleu. Seul RGB_888 a été
 * relevé ; les formats sur 4 octets ne coûtent qu'une ligne.
 */
const FORMATS: Record<number, { bytes: number; r: number; g: number; b: number }> = {
  1: { bytes: 4, r: 0, g: 1, b: 2 }, // RGBA_8888
  2: { bytes: 4, r: 0, g: 1, b: 2 }, // RGBX_8888
  3: { bytes: 3, r: 0, g: 1, b: 2 }, // RGB_888
  5: { bytes: 4, r: 2, g: 1, b: 0 } // BGRA_8888
}

export class RawFrameSplitter {
  private pending: Buffer[] = []
  private size = 0

  /** Octets reçus → images complètes ; une image n'est recopiée qu'une fois, entière. */
  push(chunk: Buffer): RawFrame[] {
    this.pending.push(chunk)
    this.size += chunk.length
    const frames: RawFrame[] = []
    while (this.size >= HEADER) {
      if ((this.pending[0]?.length ?? 0) < HEADER) this.join()
      const head = this.pending[0] as Buffer
      const length = head.readUInt32LE(0)
      if (length < HEADER - 4 || length > MAX_LENGTH) {
        throw new Error(`screenrecord: unexpected frame header (length ${length})`)
      }
      const total = 4 + length
      if (this.size < total) break
      this.join()
      const all = this.pending[0] as Buffer
      frames.push(parseFrame(all.subarray(0, total)))
      const rest = all.subarray(total)
      this.pending = rest.length ? [rest] : []
      this.size = rest.length
    }
    return frames
  }

  private join(): void {
    if (this.pending.length > 1) this.pending = [Buffer.concat(this.pending, this.size)]
  }
}

function parseFrame(data: Buffer): RawFrame {
  const width = data.readUInt32LE(4)
  const height = data.readUInt32LE(8)
  const stride = data.readUInt32LE(12)
  const format = data.readUInt32LE(16)
  const pixels = data.subarray(HEADER)
  const known = FORMATS[format]
  if (!known) throw new Error(`screenrecord: unsupported pixel format ${format}`)
  if (
    width === 0 ||
    height === 0 ||
    stride < width * known.bytes ||
    pixels.length < stride * height
  ) {
    throw new Error(`screenrecord: inconsistent frame ${width}×${height} (stride ${stride})`)
  }
  return { width, height, stride, format, pixels }
}

/** Image en BGRA opaque, 4 octets par pixel. */
export function toBgra(frame: RawFrame): Bitmap {
  const { width, height, stride, pixels } = frame
  const { bytes, r, g, b } = FORMATS[frame.format] ?? { bytes: 3, r: 0, g: 1, b: 2 }
  const data = new Uint8Array(width * height * 4)
  let out = 0
  for (let y = 0; y < height; y++) {
    let at = y * stride
    for (let x = 0; x < width; x++, at += bytes) {
      data[out++] = pixels[at + b] as number
      data[out++] = pixels[at + g] as number
      data[out++] = pixels[at + r] as number
      data[out++] = 255
    }
  }
  return { width, height, data }
}
