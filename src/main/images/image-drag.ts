/**
 * Glisser une image du fil vers le Finder (fiche 156) : le main l'écrit dans un fichier temporaire,
 * nommé d'après son empreinte (la même image glissée deux fois réutilise le même fichier), puis
 * lance le glisser natif.
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { draggedFileName, type DraggedImage } from '@shared/images'

/** Écrit l'image dans `dir` ; rend le chemin du fichier. */
export async function writeDraggedImage(image: DraggedImage, dir: string): Promise<string> {
  const bytes = Buffer.from(image.data, 'base64')
  const hash = createHash('sha256').update(bytes).digest('hex')
  // Un sous-dossier par image : deux images de même nom ne s'écrasent pas.
  const folder = join(dir, hash.slice(0, 16))
  await mkdir(folder, { recursive: true })
  const file = join(folder, draggedFileName(image, hash))
  await writeFile(file, bytes)
  // Glissée de nouveau : la date du dossier repart, le nettoyage la garde un jour de plus.
  const now = new Date()
  await utimes(folder, now, now)
  return file
}

/** Images glissées gardées au plus ce temps : le Finder a copié le fichier depuis longtemps. */
export const DRAGGED_IMAGE_MAX_AGE_MS = 24 * 3600 * 1000

/**
 * Retire de `dir` les images glissées il y a plus de `maxAge` (un sous-dossier par image, jusqu'à
 * ~30 Mo chacune) ; appelé au démarrage. Rend le nombre d'images retirées ; rien si `dir` manque.
 */
export async function cleanDraggedImages(
  dir: string,
  now = Date.now(),
  maxAge = DRAGGED_IMAGE_MAX_AGE_MS
): Promise<number> {
  const entries = await readdir(dir).catch(() => [] as string[])
  let removed = 0
  for (const entry of entries) {
    const path = join(dir, entry)
    const info = await stat(path).catch(() => null)
    if (!info || now - info.mtimeMs <= maxAge) continue
    await rm(path, { recursive: true, force: true })
    removed++
  }
  return removed
}
