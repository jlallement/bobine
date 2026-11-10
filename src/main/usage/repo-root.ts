/**
 * Racine du dépôt git d'un dossier, pour regrouper la consommation par projet (fiche 130) : celle
 * du dépôt principal pour un worktree (`.git` y est un fichier `gitdir: <dépôt>/.git/worktrees/…`).
 * Lu sur le disque, sans lancer git ; `undefined` hors d'un dépôt.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const WORKTREE_GITDIR = /^(.*)[\\/]\.git[\\/]worktrees[\\/][^\\/]+[\\/]?$/

export function repoRootOf(folder: string): string | undefined {
  if (!folder || !isAbsolute(folder)) return undefined
  for (let dir = folder; ; dir = dirname(dir)) {
    const dotGit = join(dir, '.git')
    try {
      const stat = statSync(dotGit)
      if (stat.isDirectory()) return dir
      if (stat.isFile()) return worktreeMain(dotGit, dir) ?? dir
    } catch {
      // Pas de `.git` ici : on remonte.
    }
    if (dirname(dir) === dir) return undefined
  }
}

/** Dépôt principal d'un worktree, d'après le `gitdir:` de son fichier `.git`. */
function worktreeMain(dotGit: string, dir: string): string | undefined {
  try {
    const line = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim()
    if (!line) return undefined
    return WORKTREE_GITDIR.exec(resolve(dir, line))?.[1]
  } catch {
    return undefined
  }
}

/** `repoRootOf` mis en cache par dossier : un dossier ne change pas de dépôt pendant un lancement. */
export function cachedRepoRoot(): (folder: string) => string | undefined {
  const cache = new Map<string, string | undefined>()
  return (folder) => {
    if (!cache.has(folder)) cache.set(folder, repoRootOf(folder))
    return cache.get(folder)
  }
}
