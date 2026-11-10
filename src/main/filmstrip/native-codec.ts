/**
 * Décodage et encodage des images de la planche contact par Electron (`nativeImage`), sans
 * dépendance : pixels bruts dans l'ordre de la plateforme (BGRA sur macOS), que la grille recopie
 * sans les interpréter.
 */
import { nativeImage } from 'electron'
import type { ImageCodec } from './sheet'

export const nativeCodec: ImageCodec = {
  bitmap: (jpeg, width, height) => {
    const image = nativeImage.createFromBuffer(jpeg)
    if (image.isEmpty()) throw new Error('image illisible')
    const sized = image.resize({ width, height, quality: 'good' })
    const size = sized.getSize()
    return { width: size.width, height: size.height, data: sized.toBitmap() }
  },
  jpeg: (bitmap) =>
    nativeImage
      .createFromBitmap(
        Buffer.from(bitmap.data.buffer, bitmap.data.byteOffset, bitmap.data.byteLength),
        {
          width: bitmap.width,
          height: bitmap.height
        }
      )
      .toJPEG(80)
}
