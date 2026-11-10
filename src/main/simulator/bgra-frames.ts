/**
 * Flux d'images brutes d'AXe (`stream-video --format bgra`, fiche 044) : géométrie demandée,
 * découpage des octets en images, vérification de la première image. Pur, pour les tests.
 *
 * Relevé (AXe 1.8.0, FBSimulatorControl) : une image = `bytesPerRow × hauteur` octets, sans
 * en-tête ni remplissage final, où `bytesPerRow` est largeur × 4 arrondie au multiple de 64 ;
 * largeur et hauteur = pixels de l'appareil × échelle, tronqués. On choisit donc une échelle qui
 * donne une largeur multiple de 16 pixels : les lignes sont alors exactement largeur × 4 octets.
 */

/** Taille demandée au flux : autour de la moitié des pixels de l'appareil. */
const TARGET_SCALE = 0.5

export interface StreamGeometry {
  /** Largeur des images, multiple de 16 pixels. */
  width: number
  height: number
  /** Échelle à passer à AXe (6 décimales), choisie pour obtenir exactement `width`. */
  scale: number
  /** Octets par image. */
  frameSize: number
}

/** Géométrie du flux pour un écran de `pixels` (taille de la capture `simctl`). */
export function streamGeometry(pixels: { width: number; height: number }): StreamGeometry | null {
  if (pixels.width < 32 || pixels.height < 32) return null
  const width = Math.max(16, Math.round((pixels.width * TARGET_SCALE) / 16) * 16)
  if (width > pixels.width) return null
  // (largeur + ½) / pixels : la troncature d'AXe retombe sur `width`, quel que soit l'arrondi.
  const scale = Math.round(((width + 0.5) / pixels.width) * 1e6) / 1e6
  const height = Math.floor(pixels.height * scale)
  return { width, height, scale, frameSize: width * height * 4 }
}

/**
 * Une image BGRA opaque a `FF` comme 4ᵉ octet de chaque pixel : vérifié sur un échantillon,
 * ce qui trahit une largeur ou un remplissage de ligne différents de ceux attendus (l'image
 * serait de travers) — on repasse alors en MJPEG.
 */
export function looksLikeOpaqueBgra(frame: Buffer, samples = 2048): boolean {
  const pixels = Math.floor(frame.length / 4)
  if (pixels === 0) return false
  const step = Math.max(1, Math.floor(pixels / samples))
  for (let p = 0; p < pixels; p += step) {
    if (frame[p * 4 + 3] !== 0xff) return false
  }
  return true
}

/** Découpe les octets reçus en images complètes de taille fixe. */
export class FixedFrames {
  readonly frameSize: number
  private chunks: Buffer[] = []
  private buffered = 0

  constructor(frameSize: number) {
    if (!Number.isInteger(frameSize) || frameSize <= 0) {
      throw new Error(`Taille d'image invalide : ${frameSize}`)
    }
    this.frameSize = frameSize
  }

  /** Ajoute des octets reçus ; renvoie les images complètes, dans l'ordre. */
  push(chunk: Buffer): Buffer[] {
    this.chunks.push(chunk)
    this.buffered += chunk.length
    if (this.buffered < this.frameSize) return []
    const all =
      this.chunks.length === 1 ? (this.chunks[0] ?? Buffer.alloc(0)) : Buffer.concat(this.chunks)
    const frames: Buffer[] = []
    let offset = 0
    while (all.length - offset >= this.frameSize) {
      frames.push(Buffer.from(all.subarray(offset, offset + this.frameSize)))
      offset += this.frameSize
    }
    const rest = all.subarray(offset)
    this.chunks = rest.length ? [Buffer.from(rest)] : []
    this.buffered = rest.length
    return frames
  }
}
