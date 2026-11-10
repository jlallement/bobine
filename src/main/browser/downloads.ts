/**
 * Téléchargements du navigateur intégré (fiche 094, ADR-0018) : chacun demande « Enregistrer
 * sous ». En attendant la réponse, les données arrivent dans un dossier propre à l'app ; le fichier
 * ne rejoint l'endroit choisi qu'après le clic de l'utilisateur, et rien ne reste s'il annule.
 *
 * Pas la fenêtre d'Electron (celle qu'il ouvre si `setSavePath` n'est pas appelé) : pendant qu'elle
 * est ouverte, Chromium écrit déjà les données dans un fichier caché de ~/Downloads (mesuré sur
 * Electron 44.7.2), qui y resterait après un plantage.
 */
import { randomUUID } from 'node:crypto'
import { copyFile, rename, rm, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export type DownloadEnd = 'completed' | 'cancelled' | 'interrupted'

export type DownloadOutcome =
  { state: 'completed'; path: string } | { state: 'cancelled' } | { state: 'interrupted' }

/** Ce qu'on utilise d'un `DownloadItem` d'Electron (remplaçable en test). */
export interface PendingDownload {
  getFilename(): string
  setSavePath(path: string): void
  getState(): string
  cancel(): void
  once(event: 'done', listener: (event: unknown, state: DownloadEnd) => void): unknown
}

export interface DownloadDeps {
  /** Dossier où le fichier attend la décision de l'utilisateur. */
  pendingDir: string
  /** Fenêtre « Enregistrer sous » ; `undefined` si l'utilisateur annule. */
  chooseTarget: (name: string) => Promise<string | undefined>
}

/**
 * Prend un téléchargement en charge depuis `will-download`, qui veut son chemin tout de suite
 * (appel synchrone). Se résout une fois tout terminé : enregistré, annulé ou en échec.
 */
export function saveDownload(item: PendingDownload, deps: DownloadDeps): Promise<DownloadOutcome> {
  const name = item.getFilename()
  const waiting = join(deps.pendingDir, randomUUID())
  const temp = join(waiting, name)
  item.setSavePath(temp)
  const ended = new Promise<DownloadEnd>((resolve) =>
    item.once('done', (_event, state) => resolve(state))
  )
  const settle = async (): Promise<DownloadOutcome> => {
    const target = await deps.chooseTarget(name).catch(() => undefined)
    if (!target) {
      if (item.getState() === 'progressing') item.cancel()
      await ended
      return { state: 'cancelled' }
    }
    if ((await ended) !== 'completed') return { state: 'interrupted' }
    await moveFile(temp, target)
    return { state: 'completed', path: target }
  }
  return settle()
    .catch((): DownloadOutcome => ({ state: 'interrupted' }))
    .finally(() => rm(waiting, { recursive: true, force: true }))
}

/** Déplace un fichier, même vers un autre volume (copie puis suppression). */
async function moveFile(from: string, to: string): Promise<void> {
  try {
    await rename(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
    await copyFile(from, to)
    await unlink(from)
  }
}
