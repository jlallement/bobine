/**
 * « Ouvrir dans l'éditeur » une sortie d'outil trop grosse pour le fil (fiche 192) : la sortie est
 * écrite dans un fichier temporaire de l'app, jamais dans le dossier de l'utilisateur. Dossier
 * réservé à l'utilisateur (0700), fichier lisible par lui seul (0600), nom tiré au hasard (pas
 * devinable par un autre programme). Tout le dossier part au démarrage et à la fermeture de l'app.
 *
 * Le dossier est hors du profil (fiche 196 : un profil en lecture seule ne reçoit aucune écriture),
 * dans le dossier temporaire du système, un par profil (`toolOutputsDir`).
 */
import { createHash, randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/** Dossier des sorties d'un profil : dans `temp`, nommé d'après le dossier de données. */
export function toolOutputsDir(temp: string, userData: string): string {
  const id = createHash('sha256').update(resolve(userData)).digest('hex').slice(0, 8)
  return join(temp, `bobine-tool-outputs-${id}`)
}

/** Sortie la plus grosse acceptée du renderer (au-delà, refusée). */
export const MAX_OUTPUT_FILE_BYTES = 64 * 1024 * 1024

/** Écrit `text` dans un fichier neuf de `dir` ; rend son chemin. */
export async function writeOutputFile(dir: string, text: string): Promise<string> {
  if (Buffer.byteLength(text) > MAX_OUTPUT_FILE_BYTES) throw new Error('Sortie trop grosse')
  await mkdir(dir, { recursive: true, mode: 0o700 })
  // Dossier déjà là (créé par une version d'avant, ou réglé autrement) : remis à 0700.
  await chmod(dir, 0o700)
  const file = join(dir, `sortie-${randomUUID()}.txt`)
  // `wx` : jamais par-dessus un fichier (ni un lien) qui serait déjà là.
  await writeFile(file, text, { mode: 0o600, flag: 'wx' })
  return file
}

/** Retire le dossier des sorties (démarrage, fermeture) ; rien s'il n'existe pas. */
export function cleanOutputFiles(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}
