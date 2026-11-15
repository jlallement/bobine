/**
 * Icône de l'app Windows (fiche 229, lot 6) : `build/icon.ico`, plusieurs tailles dans un seul
 * fichier (`scripts/make-icon.mjs --win`), réduites depuis build/icon.png. Chaque image est un PNG
 * dans l'ICO (admis depuis Windows Vista) : pas d'encodeur BMP à écrire, rien à installer.
 * 256 px est le maximum du format (et le minimum qu'exige electron-builder).
 */
export const WINDOWS_ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

/**
 * Fichier ICO à partir d'images PNG carrées, dans l'ordre donné. En-tête ICONDIR (6 octets), une
 * entrée ICONDIRENTRY de 16 octets par image, puis les PNG ; une largeur de 256 s'écrit 0.
 * @param {{ size: number, png: Uint8Array }[]} images
 * @returns {Buffer}
 */
export function encodeIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0) // réservé
  header.writeUInt16LE(1, 2) // type : icône
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    if (!Number.isInteger(size) || size < 1 || size > 256)
      throw new Error(`Taille ${size} hors ICO`)
    const entry = 6 + 16 * i
    header.writeUInt8(size === 256 ? 0 : size, entry)
    header.writeUInt8(size === 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2) // pas de palette
    header.writeUInt8(0, entry + 3) // réservé
    header.writeUInt16LE(1, entry + 4) // plans
    header.writeUInt16LE(32, entry + 6) // bits par pixel
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => Buffer.from(png))])
}

/**
 * Lecture inverse (essais) : taille annoncée et PNG de chaque entrée.
 * @param {Uint8Array} data
 * @returns {{ size: number, png: Buffer }[]}
 */
export function decodeIco(data) {
  const buf = Buffer.from(data)
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('Pas un fichier ICO')
  const count = buf.readUInt16LE(4)
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + 16 * i
    const width = buf.readUInt8(entry) || 256
    const length = buf.readUInt32LE(entry + 8)
    const start = buf.readUInt32LE(entry + 12)
    return { size: width, png: buf.subarray(start, start + length) }
  })
}
