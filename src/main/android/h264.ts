/**
 * Flux H.264 « Annex B » de `screenrecord` (fiche 032) découpé en images pour le décodeur de
 * Chromium (WebCodecs) : chaque image regroupe ses unités (SPS, PPS…) et sa tranche.
 */

export interface H264Frame {
  /** Octets Annex B de l'image (codes de début compris). */
  data: Buffer
  /** Image clé (IDR) : le décodeur peut repartir d'elle. */
  key: boolean
  /** Chaîne de codec (`avc1.42c029`) quand l'image porte un SPS. */
  codec?: string
}

const SLICE = 1
const IDR = 5
const SPS = 7

/** Positions des codes de début (00 00 01, ou 00 00 00 01) dans le tampon. */
function startCodes(buffer: Buffer, from: number): { at: number; length: number }[] {
  const found: { at: number; length: number }[] = []
  let i = from
  while (i + 3 <= buffer.length) {
    const j = buffer.indexOf(0x00, i)
    if (j === -1 || j + 3 > buffer.length) break
    if (buffer[j + 1] === 0 && buffer[j + 2] === 1) {
      const long = j > 0 && buffer[j - 1] === 0
      found.push({ at: long ? j - 1 : j, length: long ? 4 : 3 })
      i = j + 3
    } else i = j + 1
  }
  return found
}

export class H264Splitter {
  private buffer: Buffer = Buffer.alloc(0)
  /** Unités en attente de la tranche qui terminera l'image. */
  private pending: Buffer[] = []
  private pendingKey = false
  private pendingCodec: string | undefined

  /** Octets reçus → images complètes. La dernière unité attend la suivante pour être sûre. */
  push(chunk: Buffer): H264Frame[] {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk
    const codes = startCodes(this.buffer, 0)
    if (codes.length < 2) return []
    const frames: H264Frame[] = []
    for (let k = 0; k < codes.length - 1; k++) {
      const start = codes[k] as { at: number; length: number }
      const end = (codes[k + 1] as { at: number }).at
      const unit = this.buffer.subarray(start.at, end)
      const type = (this.buffer[start.at + start.length] ?? 0) & 0x1f
      this.pending.push(unit)
      if (type === SPS) {
        const p = start.at + start.length + 1
        this.pendingCodec = `avc1.${this.buffer.subarray(p, p + 3).toString('hex')}`
      }
      if (type === IDR) this.pendingKey = true
      if (type === SLICE || type === IDR) {
        frames.push({
          data: Buffer.concat(this.pending),
          key: this.pendingKey,
          ...(this.pendingCodec ? { codec: this.pendingCodec } : {})
        })
        this.pending = []
        this.pendingKey = false
        this.pendingCodec = undefined
      }
    }
    const last = codes[codes.length - 1] as { at: number }
    this.buffer = Buffer.from(this.buffer.subarray(last.at))
    return frames
  }

  /**
   * Plus rien n'arrive (écran immobile : `screenrecord` n'envoie que les changements) : la dernière
   * unité reçue est complète, l'image qu'elle termine part tout de suite.
   */
  flush(): H264Frame[] {
    if (this.buffer.length === 0) return []
    const frames = this.push(Buffer.from([0, 0, 0, 1]))
    // Le code de début ajouté n'appartient à aucune unité réelle.
    this.buffer = Buffer.alloc(0)
    return frames
  }
}
