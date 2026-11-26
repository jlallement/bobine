/**
 * Lecture des sorties de git et des outils de forge, sans processus (sortis de `worktree-cycle.ts`,
 * fiche 289, pour rester sous la borne de taille de la fiche 089).
 */
import { isAbsolute, relative, resolve, sep } from 'node:path'

/**
 * Ligne utile d'une erreur de `glab` : ce qui suit son cadre « ERROR », sans la phrase du fichier
 * de reprise (`--recover`), espaces des colonnes ramenés à un.
 */
export function toolError(stderr: string): string {
  const flat = stderr.replace(/\s+/g, ' ').trim()
  const afterError = /\bERROR\b(.*)$/.exec(flat)?.[1]?.trim()
  const message = (afterError || flat)
    .replace(/Failed to create merge request\. Created recovery file: \S+/i, '')
    .replace(/Run the command again with the '--recover' option to retry\./i, '')
    .replace(/^x\s+/, '')
    .trim()
  return message
}

export function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel) && !rel.includes(`..${sep}`)
}

/** Totaux de `git diff --numstat` (« 12\t3\tchemin », « -\t-\t… » pour un binaire). */
export function lineCounts(stdout: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of stdout.split('\n')) {
    const [a, r] = line.split('\t')
    added += Number(a) || 0
    removed += Number(r) || 0
  }
  return { added, removed }
}
