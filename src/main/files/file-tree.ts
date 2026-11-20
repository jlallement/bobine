/**
 * Vue des fichiers (fiche 271, ADR-0065) : le main seul lit le disque. Le renderer désigne une
 * racine (dossier de la conversation, puis ses autres dossiers) et un chemin relatif ; ici, le
 * chemin réel est résolu et tout ce qui sort des racines est refusé, liens symboliques compris.
 * Lecture seule : aucune fonction de ce fichier n'écrit.
 */
import { constants } from 'node:fs'
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve, sep } from 'node:path'
import { t } from 'i18next'
import {
  compareEntries,
  imageType,
  MAX_DIR_ENTRIES,
  MAX_IMAGE_BYTES,
  MAX_TEXT_BYTES,
  NEVER_LISTED,
  type FileContent,
  type FileEntry,
  type FileListing,
  type FileRoot
} from '@shared/files'
import { gitRun } from '../git/git-queue'
import { inside, mayExecuteOn, real } from './file-links'
import { launchSystem } from '../process-launch'

/** Octets lus pour reconnaître un fichier binaire (un octet nul). */
const SNIFF_BYTES = 8192
/** Chemins passés à `git check-ignore` par appel (ligne de commande bornée sous Windows). */
const IGNORE_BATCH = 100

/** Ce qui sait dire quels chemins (relatifs à `root`) git ignore ; `null` hors dépôt. */
export type IgnoredPaths = (root: string, paths: readonly string[]) => Promise<Set<string> | null>

/** Racines de la conversation : son dossier (ou worktree), puis ses autres dossiers (fiche 179). */
export function fileRoots(workspace: string, additional: readonly string[] = []): FileRoot[] {
  return [workspace, ...additional].map((path, index) => ({
    index,
    name: basename(path) || path,
    path
  }))
}

/**
 * Chemin absolu réel de `relative` dans `root`, refusé s'il sort des racines (`..`, chemin
 * absolu, lien symbolique qui mène ailleurs). `roots` : chemins réels de toutes les racines, où un
 * lien peut mener.
 */
export async function resolveInRoot(
  root: string,
  relative: string,
  roots: readonly string[] = [root]
): Promise<string> {
  if (typeof relative !== 'string' || relative.includes('\0') || isAbsolute(relative)) {
    throw new Error(t('files.error.outside', { path: String(relative) }))
  }
  const rootReal = await real(root)
  const target = resolve(rootReal, relative)
  if (!inside(rootReal, target)) throw new Error(t('files.error.outside', { path: relative }))
  const targetReal = await real(target)
  const allowed = await Promise.all(roots.map((r) => real(r)))
  if (!allowed.some((r) => inside(r, targetReal))) {
    throw new Error(t('files.error.outside', { path: relative }))
  }
  return targetReal
}

/** Chemins ignorés par git, par lots ; `null` si le dossier n'est pas un dépôt (ou sans git). */
export const gitIgnored: IgnoredPaths = async (root, paths) => {
  const ignored = new Set<string>()
  for (let i = 0; i < paths.length; i += IGNORE_BATCH) {
    const batch = paths.slice(i, i + IGNORE_BATCH)
    // Par la file git du dépôt (fiche 138) ; `check-ignore` ne prend aucun verrou.
    const result = await gitRun(
      'git',
      ['-C', root, '-c', 'core.quotePath=false', 'check-ignore', '--', ...batch],
      {
        timeoutMs: 5000
      }
    )
    // 0 : certains ignorés ; 1 : aucun ; autre : pas un dépôt, ou git absent.
    if (result.code !== 0 && result.code !== 1) return null
    // Un chemin par ligne (`-z` exige `--stdin`, que la file git ne passe pas).
    for (const path of result.stdout.toString('utf8').split('\n')) {
      if (path) ignored.add(path.replace(/\/$/, ''))
    }
  }
  return ignored
}

/** Chemin relatif, séparé par `/` (comme git, quel que soit le système). */
const joinRelative = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

/**
 * Un niveau d'un dossier : trié (Q22), borné (Q24), ignorés et exclus marqués, liens qui sortent
 * marqués (jamais suivis). `.git` et `.DS_Store` ne sont jamais listés.
 */
export async function listDirectory(options: {
  root: string
  dir: string
  /** Toutes les racines de la conversation (où un lien symbolique peut mener). */
  roots: readonly string[]
  ignored?: IgnoredPaths
  /** Exclu pour l'agent (chemin absolu) ; absent : rien n'est marqué. */
  isExcluded?: (path: string) => Promise<boolean>
  /** Fichiers d'où viennent ces exclusions (`.bobignore`…), rendus avec la liste. */
  exclusionFiles?: string[]
}): Promise<FileListing> {
  const { root, dir, roots } = options
  const folder = await resolveInRoot(root, dir, roots)
  const info = await stat(folder)
  if (!info.isDirectory()) throw new Error(t('files.error.notFolder', { path: dir }))
  const allowed = await Promise.all(roots.map((r) => real(r)))
  const raw = (await readdir(folder, { withFileTypes: true })).filter(
    (entry) => !NEVER_LISTED.has(entry.name)
  )
  const entries: FileEntry[] = []
  for (const entry of raw) {
    const full = join(folder, entry.name)
    const path = joinRelative(dir, entry.name)
    if (entry.isSymbolicLink()) {
      const target = await realpath(full).catch(() => null)
      const targetInfo = target ? await stat(target).catch(() => null) : null
      const within = !!target && allowed.some((r) => inside(r, target))
      entries.push({
        name: entry.name,
        path,
        kind: within && targetInfo?.isDirectory() ? 'dir' : 'file',
        link: within ? 'inside' : 'outside',
        ...(within && targetInfo?.isFile() ? { size: targetInfo.size } : {})
      })
    } else if (entry.isDirectory()) {
      entries.push({ name: entry.name, path, kind: 'dir' })
    } else {
      const info = await lstat(full).catch(() => undefined)
      entries.push({
        name: entry.name,
        path,
        kind: 'file',
        ...(info ? { size: info.size } : {}),
        // S'exécuterait si on l'« ouvrait » : pas d'« Ouvrir avec l'app par défaut » (fiche 052).
        ...(info && mayExecuteOn(full, info.mode, launchSystem()) ? { executable: true } : {})
      })
    }
  }
  entries.sort(compareEntries)
  const shown = entries.slice(0, MAX_DIR_ENTRIES)
  await markIgnored(root, dir, shown, options.ignored)
  if (options.isExcluded) {
    for (const entry of shown) {
      if (await options.isExcluded(join(folder, entry.name))) entry.excluded = true
    }
  }
  const files = options.exclusionFiles?.length ? { exclusionFiles: options.exclusionFiles } : {}
  return { entries: shown, more: entries.length - shown.length, ...files }
}

/** Marque les entrées ignorées par git ; tout le dossier s'il est lui-même ignoré. */
async function markIgnored(
  root: string,
  dir: string,
  entries: FileEntry[],
  ignored: IgnoredPaths | undefined
): Promise<void> {
  if (!ignored || entries.length === 0) return
  const rootReal = await real(root)
  const queried = entries.map((e) => (e.kind === 'dir' ? `${e.path}/` : e.path))
  const found = await ignored(rootReal, dir ? [`${dir}/`, ...queried] : queried).catch(() => null)
  if (!found) return
  const all = !!dir && found.has(dir)
  for (const entry of entries) if (all || found.has(entry.path)) entry.ignored = true
}

/** Le début du fichier contient-il un octet nul ? (binaire) */
const looksBinary = (buffer: Buffer) => buffer.subarray(0, SNIFF_BYTES).includes(0)

/** Texte d'un tampon : UTF-16 si son BOM le dit, UTF-8 sinon (BOM retiré). */
function decode(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le')
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8')
  }
  return buffer.toString('utf8')
}

/** `O_NOFOLLOW` là où il existe (pas sous Windows) : le dernier maillon n'est jamais un lien. */
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)

/**
 * Fichier pour l'affichage (Q39 à Q42) : texte (1 Mo au plus, le reste coupé et dit), image
 * (20 Mo au plus, en `data:`), ou binaire. Un fichier de secret se lit comme un autre (Q8).
 */
export async function readFileForView(
  root: string,
  relative: string,
  roots: readonly string[] = [root]
): Promise<FileContent> {
  const target = await resolveInRoot(root, relative, roots)
  const handle = await open(target, READ_FLAGS)
  try {
    const info = await handle.stat()
    if (!info.isFile()) throw new Error(t('files.error.notFile', { path: relative }))
    const modified = Math.round(info.mtimeMs)
    const size = info.size
    const runs = mayExecuteOn(target, info.mode, launchSystem())
      ? { executable: true as const }
      : {}
    const mime = imageType(target)
    if (mime && size <= MAX_IMAGE_BYTES) {
      const buffer = await readStart(handle, size)
      const svg = mime === 'image/svg+xml'
      return {
        kind: 'image',
        url: `data:${mime};base64,${buffer.toString('base64')}`,
        size,
        modified,
        ...runs,
        ...(svg && size <= MAX_TEXT_BYTES ? { text: decode(buffer) } : {})
      }
    }
    const buffer = await readStart(handle, Math.min(size, MAX_TEXT_BYTES))
    const utf16 = buffer[0] === 0xff && buffer[1] === 0xfe
    if (mime || (!utf16 && looksBinary(buffer))) return { kind: 'binary', size, modified, ...runs }
    const text = decode(buffer)
    return { kind: 'text', text, size, truncated: size > MAX_TEXT_BYTES, modified, ...runs }
  } finally {
    await handle.close()
  }
}

async function readStart(
  handle: Awaited<ReturnType<typeof open>>,
  length: number
): Promise<Buffer> {
  const buffer = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const { bytesRead } = await handle.read(buffer, read, length - read, read)
    if (bytesRead === 0) break
    read += bytesRead
  }
  return buffer.subarray(0, read)
}

/** Chemin relatif d'un chemin absolu dans une racine, séparé par `/` ; `undefined` s'il en sort. */
export async function relativeInRoot(root: string, absolute: string): Promise<string | undefined> {
  const rootReal = await real(root)
  const target = await real(absolute)
  if (!inside(rootReal, target)) return undefined
  return target === rootReal
    ? ''
    : target
        .slice(rootReal.length + 1)
        .split(sep)
        .join('/')
}
