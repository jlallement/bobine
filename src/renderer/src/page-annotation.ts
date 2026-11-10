/**
 * Annoter la page au clic (fiches 132 et 146) : où la capture figée se pose dans la zone de la page
 * (comme la vue native, fiche 129), où va la bulle d'une épingle, et les images envoyées à l'agent
 * (chaque capture à la taille CSS de la page, épingles dessinées par le moteur de la fiche 067).
 */
import type { ImageAttachment } from '@shared/attachments'
import { base64Bytes, MAX_IMAGE_BYTES } from '@shared/attachments'
import type { PageFreeze, PageImage } from '@shared/page-notes'
import { drawShapes, type Point, type Shape } from './annotation'

export interface Size {
  width: number
  height: number
}

/** Capture posée dans la zone : échelle (pixels de la zone par pixel CSS de la page) et décalage. */
export interface FrozenLayout {
  scale: number
  left: number
  top: number
  width: number
  height: number
}

/** Bulle d'une épingle : largeur, et hauteur prévue pour la garder dans la zone. */
export const BUBBLE = { width: 250, height: 100, gap: 10 } as const
/** Côté de l'épingle à l'écran. */
export const PIN_SIZE = 26
const MARGIN = 8

/**
 * Même place que la vue native : toute la largeur de la zone (page zoomée comprise), ou, sous une
 * taille imposée par l'agent, l'écran réduit pour tenir, centré en haut (`emulationFrame`).
 */
export function frozenLayout(area: Size, page: Pick<PageFreeze, 'width' | 'height' | 'emulated'>) {
  const scale = page.emulated
    ? Math.min(1, area.width / page.width, area.height / page.height)
    : area.width / page.width
  const width = page.width * scale
  const height = page.height * scale
  const left = page.emulated ? Math.floor((area.width - width) / 2) : 0
  return { scale, left, top: 0, width, height } satisfies FrozenLayout
}

/** Point de la zone → point de la page (pixels CSS) ; `null` hors de la capture. */
export function toPagePoint(at: Point, layout: FrozenLayout): Point | null {
  const x = (at.x - layout.left) / layout.scale
  const y = (at.y - layout.top) / layout.scale
  if (at.x < layout.left || at.y < layout.top) return null
  if (at.x > layout.left + layout.width || at.y > layout.top + layout.height) return null
  return { x: Math.round(x), y: Math.round(y) }
}

/** Point de la page → point de la zone. */
export function toAreaPoint(at: Point, layout: FrozenLayout): Point {
  return { x: layout.left + at.x * layout.scale, y: layout.top + at.y * layout.scale }
}

/**
 * Bulle d'une épingle pointée en `pin` (pixels de la zone) : à gauche de la pointe, juste dessous
 * (maquette) ; à droite de l'épingle près du bord gauche ; toujours dans la zone.
 */
export function bubbleAt(pin: Point, area: Size): { left: number; top: number } {
  const leftSide = pin.x - BUBBLE.gap - BUBBLE.width
  const wanted = leftSide >= MARGIN ? leftSide : pin.x + PIN_SIZE + BUBBLE.gap
  const left = Math.max(MARGIN, Math.min(wanted, area.width - BUBBLE.width - MARGIN))
  const top = Math.max(MARGIN, Math.min(pin.y + 11, area.height - BUBBLE.height - MARGIN))
  return { left: Math.round(left), top: Math.round(top) }
}

/** Épingles dessinées sur une image envoyée, avec le numéro de leur remarque. */
export function pinShapes(pins: PageImage['pins'], color: string): Shape[] {
  return pins.map(({ n, at }) => ({ kind: 'pin', color, at, label: String(n) }))
}

/**
 * Image envoyée : la capture ramenée à la fenêtre CSS de la page (comme celles de l'agent, fiche
 * 129 : les points du message se lisent sur l'image), épingles dessinées ; JPEG si le PNG est trop
 * lourd pour une pièce jointe.
 */
export async function composePageImage(
  freeze: PageFreeze,
  pins: PageImage['pins'],
  color: string,
  name: string
): Promise<ImageAttachment> {
  const picture = new Image()
  picture.src = `data:${freeze.mimeType};base64,${freeze.data}`
  await picture.decode()
  const width = Math.max(1, Math.round(freeze.width))
  const height = Math.max(1, Math.round(freeze.height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(picture, 0, 0, width, height)
  drawShapes(ctx, pinShapes(pins, color), { width, height })
  let mimeType = 'image/png'
  let data = canvas.toDataURL(mimeType).split(',')[1] ?? ''
  if (base64Bytes(data) > MAX_IMAGE_BYTES) {
    mimeType = 'image/jpeg'
    data = canvas.toDataURL(mimeType, 0.85).split(',')[1] ?? ''
  }
  return {
    kind: 'image',
    name: `${name}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    mimeType,
    data
  }
}
