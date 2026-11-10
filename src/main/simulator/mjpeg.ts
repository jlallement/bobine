/**
 * Lecture d'un flux MJPEG « multipart/x-mixed-replace » (sortie de `axe stream-video`, fiche 009) :
 * en-tête HTTP, puis pour chaque image un séparateur, ses en-têtes (`Content-Length`) et ses octets.
 */
const HEADER_END = Buffer.from('\r\n\r\n')
const LENGTH = /content-length:\s*(\d+)/i
/** Une image plus grosse est forcément une erreur de lecture. */
const MAX_FRAME = 20 * 1024 * 1024

export class MjpegParser {
  private buffer: Buffer = Buffer.alloc(0)
  /** Octets restants de l'image en cours de lecture. */
  private pending: number | undefined

  /** Ajoute des octets reçus ; renvoie les images complètes (JPEG). */
  push(chunk: Buffer): Buffer[] {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk
    const frames: Buffer[] = []
    for (;;) {
      if (this.pending === undefined) {
        const end = this.buffer.indexOf(HEADER_END)
        if (end === -1) {
          // En-têtes incomplets : on garde de quoi les finir, pas plus.
          if (this.buffer.length > 64 * 1024) this.buffer = this.buffer.subarray(-1024)
          break
        }
        const headers = this.buffer.subarray(0, end).toString('latin1')
        this.buffer = this.buffer.subarray(end + HEADER_END.length)
        const length = LENGTH.exec(headers)?.[1]
        // En-tête HTTP du flux, ou bloc sans longueur : rien à lire.
        if (length === undefined) continue
        const size = Number(length)
        if (size > MAX_FRAME) throw new Error(`Image trop grande dans le flux (${size} octets)`)
        this.pending = size
      }
      if (this.buffer.length < this.pending) break
      frames.push(Buffer.from(this.buffer.subarray(0, this.pending)))
      this.buffer = this.buffer.subarray(this.pending)
      this.pending = undefined
    }
    return frames
  }
}
