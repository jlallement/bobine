/**
 * Écriture et lecture sûres des fichiers JSON de l'app (historique, réglages).
 *
 * - Écriture atomique : fichier temporaire synchronisé sur le disque, puis renommage. Un arrêt
 *   brutal laisse l'ancienne version ou la nouvelle, jamais un fichier à moitié écrit.
 * - Un fichier illisible n'est jamais écrasé en silence : il est mis de côté
 *   (`<nom>.corrupt-<date>`) avant que l'app ne réécrive par-dessus. S'il ne peut pas l'être (droits),
 *   il est protégé : toute écriture par-dessus échoue au lieu de l'effacer (fiche 196).
 * - Une écriture en échec (disque plein…) ne laisse pas son fichier temporaire derrière elle, et
 *   ceux d'un arrêt brutal sont balayés au lancement (`sweepTempFiles`, fiche 196).
 * - Profil d'une version plus récente de Bobine (fiche 196) : lecture seule, rien n'y est écrit ni
 *   déplacé (`setReadOnlyProfile`).
 */
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync
} from 'node:fs'
import { copyFile, open, rename, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { log } from './log'

let asyncTmpCounter = 0

/** Fichiers illisibles qu'on n'a pas pu mettre de côté : jamais écrasés. */
const protectedFiles = new Set<string>()
/** Dossier du profil ouvert en lecture seule (fiche 196), et ce qui s'y écrit quand même. */
let readOnly: { root: string; exempt: ReadonlySet<string> } | undefined

/**
 * Profil d'une version plus récente (fiche 196) : plus rien n'est écrit, renommé ni supprimé sous
 * `root`, sauf les fichiers de `exempt` (noms, à la racine : registre des processus des agents).
 * `undefined` lève la lecture seule (essais).
 */
export function setReadOnlyProfile(root: string | undefined, exempt: readonly string[] = []): void {
  readOnly = root ? { root: resolve(root), exempt: new Set(exempt) } : undefined
}

/** Ce fichier est-il dans un profil en lecture seule ? */
export function isReadOnly(file: string): boolean {
  if (!readOnly) return false
  const path = resolve(file)
  if (!path.startsWith(readOnly.root + sep)) return false
  return !(path === join(readOnly.root, basename(path)) && readOnly.exempt.has(basename(path)))
}

/** Écrire par-dessus un fichier illisible gardé tel quel : refusé, l'appelant le signale. */
function refuseProtected(file: string): void {
  if (protectedFiles.has(resolve(file))) {
    throw new Error(`fichier illisible gardé tel quel, pas réécrit : ${file}`)
  }
}

/** Supprime un fichier temporaire après un échec, sans masquer l'erreur d'origine. */
function dropTmp(tmp: string): void {
  try {
    rmSync(tmp, { force: true })
  } catch {
    // Rien de plus à faire : le balayage du prochain lancement s'en chargera.
  }
}

/** Fichier temporaire d'une écriture atomique (`x.tmp`, `x.<pid>-<n>.tmp`). */
const TMP_FILE = /\.(\d+-\d+\.)?tmp$/

/**
 * Balaye les fichiers temporaires laissés par un arrêt brutal ou une écriture en échec (fiche 196),
 * dans ces dossiers seulement (pas leurs sous-dossiers). À appeler au lancement, avant toute
 * écriture : l'app est seule sur son dossier de données. Rend le nombre de fichiers retirés.
 */
export function sweepTempFiles(dirs: readonly string[]): number {
  let removed = 0
  for (const dir of dirs) {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      const file = join(dir, name)
      if (!TMP_FILE.test(name) || isReadOnly(file)) continue
      try {
        rmSync(file, { force: true })
        removed++
      } catch {
        // Fichier verrouillé : il le sera encore au prochain lancement, sans gêner.
      }
    }
  }
  return removed
}

/**
 * Écriture atomique asynchrone (fiche 043) : la synchronisation sur le disque se fait hors du fil
 * principal, et plusieurs écritures du même fichier peuvent se chevaucher (fichier temporaire
 * unique). `commit`, consulté juste avant le renommage, permet d'abandonner une écriture dépassée
 * par une plus récente : le fichier temporaire est alors supprimé et rien n'est remplacé. Rend
 * `true` si le fichier a été remplacé.
 */
export async function writeFileAtomicAsync(
  file: string,
  text: string,
  options: { backup?: boolean; mode?: number; commit?: () => boolean } = {}
): Promise<boolean> {
  if (isReadOnly(file)) return false
  refuseProtected(file)
  const tmp = `${file}.${process.pid}-${++asyncTmpCounter}.tmp`
  const handle = await open(tmp, 'w', options.mode ?? 0o666)
  try {
    try {
      await handle.writeFile(text)
      await handle.sync()
    } finally {
      await handle.close()
    }
    // Relu juste avant de remplacer : une écriture plus récente, ou une conversation supprimée
    // entre-temps, l'emporte.
    if (options.commit && !options.commit()) {
      await rm(tmp, { force: true })
      return false
    }
    if (options.backup && existsSync(file)) {
      await copyFile(file, `${file}.bak.tmp`)
      await rename(`${file}.bak.tmp`, `${file}.bak`)
    }
    await rename(tmp, file)
    await fsyncDirAsync(dirname(file))
    return true
  } catch (error) {
    // Disque plein : un temporaire à moitié écrit reprendrait la place libérée (fiche 196).
    await rm(tmp, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Synchronise un dossier après un renommage : sans cela, une coupure de courant peut perdre le
 * renommage lui-même (fiche 197). Au mieux : un système qui ne le permet pas n'empêche rien.
 */
export function fsyncDir(dir: string): void {
  try {
    const fd = openSync(dir, 'r')
    try {
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
  } catch {
    // Pas de synchronisation de dossier ici (système de fichiers, droits) : le renommage tient.
  }
}

async function fsyncDirAsync(dir: string): Promise<void> {
  try {
    const handle = await open(dir, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Comme `fsyncDir`.
  }
}

/** Rend `false` si rien n'a été écrit (profil en lecture seule). */
export function writeFileAtomic(
  file: string,
  text: string,
  options: { backup?: boolean; mode?: number } = {}
): boolean {
  if (isReadOnly(file)) return false
  refuseProtected(file)
  const tmp = `${file}.tmp`
  try {
    const fd = openSync(tmp, 'w', options.mode ?? 0o666)
    try {
      writeSync(fd, text)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    // Dernière bonne version gardée à côté : de quoi repartir si la suivante s'abîme.
    if (options.backup && existsSync(file)) {
      copyFileSync(file, `${file}.bak.tmp`)
      renameSync(`${file}.bak.tmp`, `${file}.bak`)
    }
    renameSync(tmp, file)
    fsyncDir(dirname(file))
    return true
  } catch (error) {
    dropTmp(tmp)
    throw error
  }
}

export type JsonRead =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'corrupt'; movedTo?: string }

/**
 * Lit un fichier JSON. Contenu invalide : mis de côté (jamais supprimé). Lecture impossible (droits,
 * trop de fichiers ouverts, erreur du disque) : le fichier n'est pas déplacé — l'erreur peut être
 * passagère — mais protégé : rien ne l'écrasera pendant ce lancement (`movedTo` absent).
 */
export function readJson(file: string, now = new Date()): JsonRead {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return { ok: false, reason: 'missing' }
    protectedFiles.add(resolve(file))
    return { ok: false, reason: 'corrupt' }
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, reason: 'corrupt', ...movedOrProtected(file, now) }
  }
}

function movedOrProtected(file: string, now: Date): { movedTo?: string } {
  const movedTo = quarantine(file, now)
  return movedTo ? { movedTo } : {}
}

/** Copies mises de côté d'un même fichier au plus : au-delà, il reste en place, protégé. */
export const MAX_CORRUPT_COPIES = 10

/** Oublie les fichiers protégés (essais). */
export function resetProtectedFiles(): void {
  protectedFiles.clear()
}

/**
 * Met un fichier abîmé de côté ; rend son nouveau chemin. Jamais par-dessus une copie, et rien
 * n'est jamais supprimé : au-delà de `MAX_CORRUPT_COPIES` copies du même fichier (il s'abîme à
 * chaque lancement), plus de nouvelle copie — le fichier reste en place, protégé (jamais écrasé),
 * et c'est dit. Impossible (droits) : de même.
 */
export function quarantine(file: string, now = new Date()): string | undefined {
  // Profil en lecture seule : rien ne bouge, même abîmé.
  if (isReadOnly(file)) return undefined
  const dir = dirname(file)
  const prefix = `${basename(file)}.corrupt-`
  const copies = safeNames(dir).filter((name) => name.startsWith(prefix))
  if (copies.length >= MAX_CORRUPT_COPIES) {
    log.warn(`Déjà ${copies.length} copies mises de côté de ${file} : laissé en place, protégé`)
    protectedFiles.add(resolve(file))
    return undefined
  }
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const base = `${file}.corrupt-${stamp}`
  let target = base
  for (let n = 2; existsSync(target); n++) target = `${base}-${n}`
  try {
    renameSync(file, target)
  } catch {
    protectedFiles.add(resolve(file))
    return undefined
  }
  return target
}

function safeNames(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
