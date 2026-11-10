/**
 * Fichiers du dossier de travail, pour les mentions `@` : liste via git (fichiers suivis et non
 * ignorés) si le dossier est un dépôt, sinon parcours borné qui saute les dossiers lourds.
 * Mise en cache quelques secondes par dossier.
 */
import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { WorkspaceFile } from '@shared/attachments'
import { gitRun } from './git/git-queue'

const SKIPPED = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.next',
  '.cache',
  'DerivedData',
  'Pods'
])
const MAX_FILES = 20_000
const CACHE_MS = 15_000

const cache = new Map<string, { at: number; files: string[] }>()

async function gitFiles(root: string): Promise<string[] | undefined> {
  // Par la file git du dépôt (fiche 138) : jamais pendant un commit ou une fusion de l'app.
  const result = await gitRun(
    'git',
    ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { timeoutMs: 5000 }
  )
  if (result.code !== 0) return undefined // Pas un dépôt git (ou git absent).
  return result.stdout.toString('utf8').split('\0').filter(Boolean).slice(0, MAX_FILES)
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const queue = [root]
  while (queue.length > 0 && files.length < MAX_FILES) {
    const dir = queue.shift() as string
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) queue.push(full)
      } else if (entry.isFile()) {
        files.push(relative(root, full).split(sep).join('/'))
        if (files.length >= MAX_FILES) break
      }
    }
  }
  return files
}

export async function listWorkspaceFiles(root: string): Promise<string[]> {
  const cached = cache.get(root)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.files
  const files = (await gitFiles(root)) ?? (await walkFiles(root))
  cache.set(root, { at: Date.now(), files })
  return files
}

/** Le texte commence un segment du chemin, ou un mot du nom (« list » dans « books-list.js »). */
const startsSegment = (lower: string, q: string): boolean =>
  lower.startsWith(q) || [...'/._- '].some((separator) => lower.includes(separator + q))

/** Rang des lettres dans l'ordre (« srcapp » trouve « src/app.ts ») : en repli seulement. */
const FUZZY = 4

/**
 * Rang d'un chemin pour une recherche : plus petit = meilleur, `undefined` = écarté. Préfixes
 * d'abord (nom, puis segment ou mot), puis ce qui contient ; les lettres dans l'ordre en dernier.
 */
export function rankPath(path: string, query: string): number | undefined {
  if (!query) return path.split('/').length
  const q = query.toLowerCase()
  const lower = path.toLowerCase()
  const name = lower.slice(lower.lastIndexOf('/') + 1)
  if (name.startsWith(q)) return 0
  if (startsSegment(lower, q)) return 1
  if (name.includes(q)) return 2
  if (lower.includes(q)) return 3
  let i = 0
  for (const ch of lower) if (ch === q[i]) i++
  return i === q.length ? FUZZY : undefined
}

/**
 * Fichiers qui correspondent à la saisie d'une mention `@`, les meilleurs d'abord. Les lettres dans
 * l'ordre ne servent que si rien d'autre ne correspond (fiche 126) : `@books` ne propose pas les
 * `.plist` d'Xcode.
 */
export async function searchWorkspaceFiles(
  root: string,
  query: string,
  limit = 30,
  /** Fichiers que l'agent exclut (fiche 155) : jamais proposés. */
  isExcluded?: (path: string) => Promise<boolean>
): Promise<WorkspaceFile[]> {
  const files = await listWorkspaceFiles(root)
  const ranked = files
    .map((file) => ({ file, rank: rankPath(file, query) }))
    .filter((f): f is { file: string; rank: number } => f.rank !== undefined)
  const direct = ranked.filter((f) => f.rank < FUZZY)
  const sorted = (direct.length > 0 ? direct : ranked).sort(
    (a, b) => a.rank - b.rank || a.file.length - b.file.length || a.file.localeCompare(b.file)
  )
  const found: WorkspaceFile[] = []
  for (const { file } of sorted) {
    if (found.length >= limit) break
    const path = join(root, file)
    if (!(await isExcluded?.(path))) found.push({ path, relative: file })
  }
  return found
}
