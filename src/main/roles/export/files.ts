/**
 * Lecture et écriture d'un fichier d'agent pour l'installation des rôles (fiche 223, phase 4) :
 * jamais à travers un lien symbolique (le fichier lui-même ; pour un projet, aucun dossier entre le
 * projet et le fichier, qu'un dépôt pourrait faire pointer ailleurs), lecture bornée, écriture d'un
 * coup (`writeFileAtomic`) après copie de sauvegarde, droits du fichier gardés.
 */
import { lstatSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { dirname, relative, sep } from 'node:path'
import type { RoleExportError, RoleExportScope } from '@shared/role-export'
import { writeFileAtomic } from '../../storage'
import { backupFile } from './backup'

/** Taille lue au plus : un fichier de modes plus gros n'est pas à nous de le réécrire. */
export const MAX_FILE_BYTES = 1024 * 1024

export type FileRead = { exists: boolean; text?: string; mode: number } | { error: RoleExportError }

const isLink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/** Un lien sur le chemin : le fichier, et pour un projet chaque dossier sous la racine. */
export function linkOnPath(file: string, root: string, scope: RoleExportScope): boolean {
  if (isLink(file)) return true
  if (scope === 'user') return false
  const rel = relative(root, dirname(file))
  if (rel.startsWith('..')) return true
  let dir = root
  for (const part of rel ? rel.split(sep) : []) {
    dir = `${dir}${sep}${part}`
    if (isLink(dir)) return true
  }
  return false
}

export function readTarget(
  file: string,
  root: string,
  scope: RoleExportScope,
  shown: string
): FileRead {
  if (linkOnPath(file, root, scope)) return { error: { code: 'link', file: shown } }
  try {
    const info = statSync(file)
    if (!info.isFile())
      return { error: { code: 'invalidFile', detail: 'pas un fichier', file: shown } }
    if (info.size > MAX_FILE_BYTES) {
      return { error: { code: 'invalidFile', detail: 'trop gros', file: shown } }
    }
    return { exists: true, text: readFileSync(file, 'utf8'), mode: info.mode & 0o777 }
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return { exists: false, mode: 0o644 }
    return { error: { code: 'invalidFile', detail: (error as Error).message, file: shown } }
  }
}

/**
 * Écrit (ou supprime, `text` nul) après une copie de ce qu'on remplace. Rend une erreur plutôt que
 * de lever : l'interface la dit.
 */
export function writeTarget(
  file: string,
  before: { exists: boolean; text?: string; mode: number },
  text: string | null,
  backup: { dir: string; format: string },
  shown: string
): RoleExportError | undefined {
  try {
    if (before.exists && before.text !== undefined) {
      backupFile(backup.dir, file, backup.format, before.text)
    }
    if (text === null) {
      if (before.exists) unlinkSync(file)
      return undefined
    }
    mkdirSync(dirname(file), { recursive: true })
    if (!writeFileAtomic(file, text, { mode: before.mode })) {
      return { code: 'writeFailed', file: shown }
    }
    return undefined
  } catch (error) {
    return { code: 'writeFailed', detail: (error as Error).message, file: shown }
  }
}
