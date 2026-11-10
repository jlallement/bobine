/**
 * Images du simulateur et de l'émulateur, faites par Electron (`nativeImage`) : sorties de
 * `index.ts`, qui les passe aux gestionnaires des appareils.
 */
import { nativeImage } from 'electron'
import type { EncodeBgra, ResizeJpeg } from './simulator-manager'

/** Capture JPEG remise à la taille voulue (points de l'écran du simulateur). */
export const resizeJpeg: ResizeJpeg = (jpeg, width, height) => {
  const image = nativeImage.createFromBuffer(jpeg)
  const source = image.getSize()
  const sized = image.resize({
    width: Math.max(1, width),
    height: Math.max(1, height),
    quality: 'good'
  })
  const size = sized.getSize()
  return {
    data: sized.toJPEG(80).toString('base64'),
    width: size.width,
    height: size.height,
    sourceWidth: source.width,
    sourceHeight: source.height
  }
}

/** Image BGRA du flux vidéo du simulateur (fiche 044) → JPEG, ≈ 3 ms pour 630×1368. */
export const encodeBgra: EncodeBgra = (bgra, width, height) =>
  nativeImage.createFromBitmap(bgra, { width, height }).toJPEG(60)
