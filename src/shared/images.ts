/** Images du fil glissées vers le Finder (fiche 156). */

/** Image glissée : celle d'un message ou d'une capture d'outil, en base64. */
export interface DraggedImage {
  mimeType: string
  data: string
  /** Nom affiché (pièce jointe) ; absent pour une capture d'outil. */
  name?: string
}

/** Types d'image écrits sur le disque, et leur extension. */
export const DRAGGABLE_IMAGE_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

/** Au-delà (en caractères base64, ≈ 30 Mo d'image), le glisser est refusé. */
export const MAX_DRAGGED_IMAGE = 40_000_000

/**
 * Nom du fichier glissé : celui de la pièce jointe, sans chemin ni caractère gênant dans le
 * Finder, avec l'extension de son type ; sinon « image-<empreinte> ».
 */
export function draggedFileName(image: DraggedImage, hash: string): string {
  const ext = DRAGGABLE_IMAGE_TYPES[image.mimeType] ?? 'png'
  const base = ((image.name ?? '').split(/[/\\]/).pop() ?? '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 80)
  const stem =
    base && base !== 'image' && !base.startsWith('.') ? base : `image-${hash.slice(0, 8)}`
  return `${stem}.${ext}`
}

/** Image valide venue du renderer, sinon une erreur. */
export function parseDraggedImage(value: unknown): DraggedImage {
  const obj = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const { mimeType, data, name } = obj
  if (typeof mimeType !== 'string' || !Object.hasOwn(DRAGGABLE_IMAGE_TYPES, mimeType)) {
    throw new Error('Invalid image type')
  }
  if (typeof data !== 'string' || !data || data.length > MAX_DRAGGED_IMAGE) {
    throw new Error('Invalid image data')
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 1000))) throw new Error('Invalid image data')
  return { mimeType, data, ...(typeof name === 'string' ? { name: name.slice(0, 200) } : {}) }
}
