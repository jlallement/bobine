/**
 * Copie des fichiers ignorés listés par `.worktreeinclude` (fiche 175, ADR-0037) : du dossier
 * d'origine vers le nouveau worktree. Format de Claude Code : syntaxe `.gitignore`, et seuls les
 * fichiers que git ignore vraiment sont copiés (un fichier suivi est déjà dans le worktree).
 *
 * La correspondance des motifs est laissée à git (`ls-files --exclude-from`, puis `check-ignore`) ;
 * ici, seulement les garde-fous : rien hors du dépôt (dossiers parents résolus), aucun lien
 * symbolique, ni `.git` ni `.worktrees/`, rien d'écrasé, plafonds de nombre et de taille.
 */
import { constants } from 'node:fs'
import { copyFile, lstat, mkdir, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import {
  MAX_INCLUDED_BYTES,
  MAX_INCLUDED_FILES,
  WORKTREE_INCLUDE_FILE,
  LISTED_INCLUDED_FILES,
  type IncludedCopy
} from '@shared/worktree-setup'
import type { Run } from '../simulator/run'
import { WORKTREES_DIR } from './worktrees'

const nul = (buffer: Buffer | string) => buffer.toString().split('\0').filter(Boolean)

/** `child` est-il `parent` lui-même ou en dessous (chemins déjà résolus) ? */
export function within(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

/** Chemin relatif acceptable : ni absolu, ni `..`, ni dans `.git` ou les worktrees de l'app. */
export function safeRelative(rel: string): boolean {
  if (!rel || isAbsolute(rel) || rel.includes('\0')) return false
  const parts = rel.split(/[\\/]+/)
  if (parts.some((p) => p === '..' || p === '')) return false
  const first = parts[0]
  return first !== '.git' && first !== WORKTREES_DIR
}

/**
 * Fichiers à copier, relatifs à `root` : retenus par les motifs de `.worktreeinclude`, non suivis,
 * et ignorés par git. Aucun fichier de motifs : `null`.
 */
export async function includedFiles(run: Run, git: string, root: string): Promise<string[] | null> {
  const patterns = join(root, WORKTREE_INCLUDE_FILE)
  const exists = await lstat(patterns).then(
    (s) => s.isFile(),
    () => false
  )
  if (!exists) return null
  const listed = await run(
    git,
    ['ls-files', '-z', '--others', '--ignored', `--exclude-from=${patterns}`],
    { cwd: root, timeoutMs: 60_000 }
  )
  if (listed.code !== 0) return []
  const candidates = nul(listed.stdout).filter(safeRelative)
  if (!candidates.length) return []
  // Vraiment ignorés par le dépôt (`.gitignore`, `info/exclude`…) : `check-ignore` rend ceux-là.
  const ignored = await run(git, ['check-ignore', '-z', '--stdin'], {
    cwd: root,
    timeoutMs: 60_000,
    input: candidates.join('\0') + '\0'
  })
  // Code 1 : aucun n'est ignoré ; autre code : erreur, rien copié.
  if (ignored.code !== 0) return []
  const keep = new Set(nul(ignored.stdout))
  return candidates.filter((file) => keep.has(file))
}

/** Copie un fichier, ou dit pourquoi pas (`'skip'`), sans jamais sortir des deux dossiers. */
async function copyOne(
  realRoot: string,
  realTarget: string,
  rel: string
): Promise<{ bytes: number } | 'skip'> {
  const source = join(realRoot, rel)
  // Dossiers parents résolus : un dossier lien qui sort du dépôt est refusé.
  const parent = await realpath(dirname(source)).catch(() => undefined)
  if (!parent || !within(realRoot, parent)) return 'skip'
  const info = await lstat(source).catch(() => undefined)
  if (!info?.isFile()) return 'skip' // lien symbolique, dossier, disparu
  const destination = join(realTarget, rel)
  await mkdir(dirname(destination), { recursive: true })
  const destParent = await realpath(dirname(destination)).catch(() => undefined)
  if (!destParent || !within(realTarget, destParent)) return 'skip'
  try {
    await copyFile(join(parent, basename(source)), destination, constants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'skip'
    throw error
  }
  return { bytes: info.size }
}

/**
 * Copie de `root` (dossier d'origine) vers `target` (nouveau worktree). `null` sans
 * `.worktreeinclude`. Une erreur de copie arrête la copie et est rendue, sans lever.
 */
export async function copyIncluded(
  run: Run,
  root: string,
  target: string,
  git = 'git',
  limits = { files: MAX_INCLUDED_FILES, bytes: MAX_INCLUDED_BYTES }
): Promise<IncludedCopy | null> {
  const files = await includedFiles(run, git, root)
  if (files === null) return null
  const realRoot = await realpath(root)
  const realTarget = await realpath(target)
  const copy: IncludedCopy = { count: 0, files: [], skipped: 0, truncated: 0 }
  let bytes = 0
  for (const [index, rel] of files.entries()) {
    if (copy.count >= limits.files) {
      copy.truncated = files.length - index
      break
    }
    try {
      const size = await lstat(join(realRoot, rel)).then(
        (s) => s.size,
        () => 0
      )
      if (bytes + size > limits.bytes) {
        copy.truncated = files.length - index
        break
      }
      const done = await copyOne(realRoot, realTarget, rel)
      if (done === 'skip') copy.skipped++
      else {
        bytes += done.bytes
        copy.count++
        if (copy.files.length < LISTED_INCLUDED_FILES) copy.files.push(rel)
      }
    } catch (error) {
      copy.error = error instanceof Error ? error.message : String(error)
      copy.truncated = files.length - index
      break
    }
  }
  return copy
}
