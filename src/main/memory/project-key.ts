/**
 * Projet d'un dossier pour la mémoire (fiche 182, § 2) : la racine du dépôt **principal**, worktrees
 * compris (une fille partage la mémoire de sa mère), hors dépôt le dossier lui-même.
 *
 * `repoRootOf` (fiche 130) ne suffit pas : pour un worktree dont le dépôt principal a été déplacé,
 * il rend l'ancien chemin sans vérifier qu'il existe, et pour un dépôt nu il rend le worktree. On lit
 * donc le fichier `commondir` du `gitdir` du worktree (écrit par git) : dossier commun en `.git` →
 * son parent, dépôt nu → le dossier nu lui-même ; dossier commun absent → le worktree seul.
 * Lu sur le disque, sans lancer git.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

export interface ProjectKey {
  /** Racine du projet (chemin réel). */
  root: string
  /** Nom du dossier de mémoire : `<nom de la racine>-<8 car. du SHA-256 du chemin>`. */
  id: string
  /** Le dépôt principal du worktree est introuvable : mémoire du worktree seul (journal). */
  orphanWorktree?: true
}

const real = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Nom lisible et sûr pour un dossier (le nom de la racine, réduit à `[a-z0-9._-]`). */
function slug(root: string): string {
  const name = basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|-+$/g, '')
  return name.slice(0, 40) || 'project'
}

export function projectIdOf(root: string): string {
  const hash = createHash('sha256').update(root).digest('hex').slice(0, 8)
  return `${slug(root)}-${hash}`
}

/**
 * Racine du projet d'un worktree d'après son fichier `.git` (`gitdir: …`) ; `undefined` si ce
 * n'est pas un worktree lisible.
 */
function worktreeRoot(
  dotGit: string,
  dir: string
): { root: string } | { orphan: true } | undefined {
  let gitdir: string
  try {
    const line = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim()
    if (!line) return undefined
    gitdir = resolve(dir, line)
  } catch {
    return undefined
  }
  let common: string
  try {
    common = resolve(gitdir, readFileSync(join(gitdir, 'commondir'), 'utf8').trim())
  } catch {
    // Pas de `commondir` (sous-module, gitdir déplacé) : le gitdir est son propre dépôt.
    return existsSync(gitdir) ? undefined : { orphan: true }
  }
  if (!isDir(common)) return { orphan: true }
  // Dépôt ordinaire : `<racine>/.git` ; dépôt nu : le dossier nu lui-même.
  return { root: basename(common) === '.git' ? dirname(common) : common }
}

/** Clé de projet d'un dossier absolu (sinon `undefined`). */
export function projectKeyOf(folder: string): ProjectKey | undefined {
  if (!folder || !isAbsolute(folder)) return undefined
  const start = real(folder)
  for (let dir = start; ; dir = dirname(dir)) {
    const dotGit = join(dir, '.git')
    try {
      const stat = statSync(dotGit)
      if (stat.isDirectory()) return keyFor(dir)
      if (stat.isFile()) {
        const found = worktreeRoot(dotGit, dir)
        if (found && 'root' in found) return keyFor(real(found.root))
        return { ...keyFor(dir), ...(found ? { orphanWorktree: true as const } : {}) }
      }
    } catch {
      // Pas de `.git` ici : on remonte.
    }
    if (dirname(dir) === dir) return keyFor(start)
  }
}

const keyFor = (root: string): ProjectKey => ({ root, id: projectIdOf(root) })
