/**
 * Vue des fichiers (fiche 271, ADR-0065) : le main seul lit le disque. Le renderer désigne une
 * racine (dossier de la conversation, puis ses autres dossiers) et un chemin relatif ; ici, le
 * chemin réel est résolu et tout ce qui sort des racines est refusé, liens symboliques compris.
 * Lecture seule : aucune fonction de ce fichier n'écrit.
 */
import { constants, type Dirent } from 'node:fs'
import { lstat, open, readdir, realpath, stat, type FileHandle } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
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

/** Chemins ignorés par git ; `null` si le dossier n'est pas un dépôt (ou sans git). */
export const gitIgnored: IgnoredPaths = async (root, paths) => {
  const ignored = new Set<string>()
  if (paths.length === 0) return ignored
  const outcome = await checkIgnore(root, paths, ignored)
  if (outcome === 'ok') return ignored
  // Échec d'ensemble : hors dépôt (ou sans git), rien n'est marqué.
  const repo = await gitRun('git', ['-C', root, 'rev-parse', '--git-dir'], { timeoutMs: 5000 })
  if (repo.code !== 0) return null
  // Dans un dépôt, un chemin au-delà d'un lien ou dans un sous-module fait échouer tout le lot :
  // il est coupé en deux jusqu'à isoler les fautifs, qui restent sans marque (M4).
  await bisectIgnored(root, paths, ignored)
  return ignored
}

/** `git check-ignore` sur un lot ; `'failed'` si git refuse le lot (au-delà d'un lien…). */
async function checkIgnore(
  root: string,
  paths: readonly string[],
  into: Set<string>
): Promise<'ok' | 'failed'> {
  // Par la file git du dépôt (fiche 138) ; `check-ignore` ne prend aucun verrou. Chemins sur
  // l'entrée standard, séparés par un octet nul : aucun nom n'est mal coupé ni mal cité.
  const result = await gitRun(
    'git',
    ['-C', root, '-c', 'core.quotePath=false', 'check-ignore', '--stdin', '-z'],
    { timeoutMs: 5000, input: paths.map((p) => `${gitName(p)}\0`).join('') }
  )
  // 0 : certains ignorés ; 1 : aucun ; autre : lot refusé.
  if (result.code !== 0 && result.code !== 1) return 'failed'
  for (const path of result.stdout.toString('utf8').split('\0')) {
    // Noms comparés en NFC : macOS rend parfois des noms décomposés, git les recompose.
    if (path) into.add(path.replace(/\/$/, '').normalize('NFC'))
  }
  return 'ok'
}

/**
 * Nom tel que git le compare : sous macOS, git recompose les noms (`core.precomposeUnicode`) mais
 * pas ceux lus sur son entrée standard ; un nom décomposé du disque (NFD) y est recomposé (M4).
 */
const gitName = (path: string) => (process.platform === 'darwin' ? path.normalize('NFC') : path)

async function bisectIgnored(
  root: string,
  paths: readonly string[],
  into: Set<string>
): Promise<void> {
  if (paths.length <= 1) return
  const half = Math.ceil(paths.length / 2)
  for (const part of [paths.slice(0, half), paths.slice(half)]) {
    if ((await checkIgnore(root, part, into)) === 'failed') await bisectIgnored(root, part, into)
  }
}

/** Chemin relatif, séparé par `/` (comme git, quel que soit le système). */
const joinRelative = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

/** Appels au disque menés ensemble, au plus. */
const DISK_PARALLEL = 16

/** `task` sur chaque élément, `limit` à la fois au plus, dans l'ordre des résultats. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await task(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Une entrée telle que `readdir` la donne, avant la borne : son genre seulement. */
interface RawEntry {
  entry: FileEntry
  full: string
}

/** Genre d'une entrée d'après `readdir` ; un lien est suivi (sans jamais sortir des racines). */
async function describeEntry(
  entry: Dirent,
  folder: string,
  dir: string,
  allowed: readonly string[]
): Promise<RawEntry> {
  const full = join(folder, entry.name)
  const path = joinRelative(dir, entry.name)
  if (entry.isSymbolicLink()) {
    const target = await realpath(full).catch(() => null)
    const targetInfo = target ? await stat(target).catch(() => null) : null
    const within = !!target && allowed.some((r) => inside(r, target))
    return {
      full,
      entry: {
        name: entry.name,
        path,
        kind: within && targetInfo?.isDirectory() ? 'dir' : 'file',
        link: within ? 'inside' : 'outside',
        ...(within && targetInfo?.isFile() ? { size: targetInfo.size } : {}),
        // Un lien vers un FIFO, un périphérique… : jamais ouvert (B1).
        ...(within && targetInfo && !targetInfo.isFile() && !targetInfo.isDirectory()
          ? { special: true as const }
          : {})
      }
    }
  }
  if (entry.isDirectory()) return { full, entry: { name: entry.name, path, kind: 'dir' } }
  // Ni fichier, ni dossier, ni lien : FIFO, socket, périphérique. Montré, jamais ouvert (B1).
  if (!entry.isFile())
    return { full, entry: { name: entry.name, path, kind: 'file', special: true } }
  return { full, entry: { name: entry.name, path, kind: 'file' } }
}

/**
 * Un niveau d'un dossier : trié (Q22), borné (Q24), ignorés et exclus marqués, liens qui sortent
 * marqués (jamais suivis), FIFO et périphériques marqués « spéciaux » (jamais ouverts). `.git` et
 * `.DS_Store` ne sont jamais listés. Le genre vient de `readdir` : seules les entrées gardées sous
 * la borne sont interrogées (taille, droits), quelques-unes à la fois (C4).
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
  const all = await mapLimited(raw, DISK_PARALLEL, (e) => describeEntry(e, folder, dir, allowed))
  all.sort((a, b) => compareEntries(a.entry, b.entry))
  const kept = all.slice(0, MAX_DIR_ENTRIES)
  await mapLimited(kept, DISK_PARALLEL, async ({ entry, full }) => {
    if (entry.kind !== 'file' || entry.link || entry.special) return
    const fileInfo = await lstat(full).catch(() => undefined)
    if (!fileInfo) return
    entry.size = fileInfo.size
    // S'exécuterait si on l'« ouvrait » : pas d'« Ouvrir avec l'app par défaut » (fiche 052).
    if (mayExecuteOn(full, fileInfo.mode, launchSystem())) entry.executable = true
  })
  const shown = kept.map((k) => k.entry)
  await markIgnored(root, dir, shown, options.ignored)
  const { isExcluded } = options
  if (isExcluded) {
    await mapLimited(kept, DISK_PARALLEL, async ({ entry, full }) => {
      if (await isExcluded(full)) entry.excluded = true
    })
  }
  const files = options.exclusionFiles?.length ? { exclusionFiles: options.exclusionFiles } : {}
  return { entries: shown, more: all.length - shown.length, ...files }
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
  // Un lien se demande sans `/` : git le voit comme un fichier (`lien/` serait « au-delà d'un lien »).
  const queried = entries.map((e) => (e.kind === 'dir' && !e.link ? `${e.path}/` : e.path))
  const found = await ignored(rootReal, dir ? [`${dir}/`, ...queried] : queried).catch(() => null)
  if (!found) return
  const all = !!dir && found.has(dir.normalize('NFC'))
  for (const entry of entries) {
    if (all || found.has(entry.path.normalize('NFC'))) entry.ignored = true
  }
}

/** Le début du fichier contient-il un octet nul ? (binaire) */
const looksBinary = (buffer: Buffer) => buffer.subarray(0, SNIFF_BYTES).includes(0)

/**
 * UTF-16 sans BOM : un octet nul sur deux, toujours du même côté (texte surtout ASCII). `le` : les
 * nuls aux rangs impairs. Rien si le début ne ressemble pas à de l'UTF-16.
 */
function utf16WithoutBom(buffer: Buffer): 'le' | 'be' | undefined {
  const sample = buffer.subarray(0, SNIFF_BYTES - (SNIFF_BYTES % 2))
  const pairs = Math.floor(sample.length / 2)
  if (pairs < 2) return undefined
  let even = 0
  let odd = 0
  for (let i = 0; i < pairs * 2; i += 2) {
    if (sample[i] === 0) even++
    if (sample[i + 1] === 0) odd++
  }
  // Des nuls d'un seul côté, sur la plupart des paires : c'est de l'UTF-16, pas un binaire.
  if (odd >= pairs * 0.7 && even === 0) return 'le'
  if (even >= pairs * 0.7 && odd === 0) return 'be'
  return undefined
}

/** Encodage d'un texte : BOM, UTF-16 sans BOM, sinon UTF-8 ; `undefined` pour un binaire. */
function textEncoding(buffer: Buffer): 'utf16le' | 'utf16be' | 'utf8' | undefined {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf16le'
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf16be'
  const bare = utf16WithoutBom(buffer)
  if (bare) return bare === 'le' ? 'utf16le' : 'utf16be'
  return looksBinary(buffer) ? undefined : 'utf8'
}

/** UTF-8 strict : `undefined` si le tampon n'en est pas (le dernier caractère coupé est toléré). */
function strictUtf8(buffer: Buffer, truncated: boolean): string | undefined {
  // Un texte coupé à la borne peut finir au milieu d'un caractère : les 3 derniers octets au plus.
  const end = truncated ? Math.max(0, buffer.length - 3) : buffer.length
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, end))
  } catch {
    return undefined
  }
  return buffer.toString('utf8')
}

/**
 * Texte d'un tampon (M5) : UTF-16 (petit ou gros boutiste, avec ou sans BOM), UTF-8 (BOM retiré),
 * et, si ce n'est pas de l'UTF-8 valide, Latin-1 plutôt que des U+FFFD.
 */
function decode(buffer: Buffer, encoding = textEncoding(buffer), truncated = false): string {
  if (encoding === 'utf16le' || encoding === 'utf16be') {
    const bom = buffer[0] === 0xff || buffer[0] === 0xfe ? 2 : 0
    const body = Buffer.from(buffer.subarray(bom, buffer.length - ((buffer.length - bom) % 2)))
    return (encoding === 'utf16be' ? body.swap16() : body).toString('utf16le')
  }
  const utf8 = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
  const body = utf8 ? buffer.subarray(3) : buffer
  return strictUtf8(body, truncated) ?? body.toString('latin1')
}

/**
 * `O_NOFOLLOW` là où il existe (pas sous Windows) : le dernier maillon n'est jamais un lien.
 * `O_NONBLOCK` : un FIFO apparu entre le contrôle et l'ouverture ne fige pas un fil de libuv en
 * attendant un écrivain (B1) ; sans effet sur un fichier ordinaire.
 */
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)

/** Ce que le renderer a déjà de ce fichier : rien n'est relu s'il n'a pas changé (C4). */
export interface KnownVersion {
  modified: number
  size: number
}

/**
 * Le fichier ouvert est-il toujours celui que le chemin désigne, dans les racines ? Un dossier
 * intermédiaire remplacé par un lien entre le contrôle et l'ouverture mènerait ailleurs (M1) :
 * le chemin est résolu à nouveau, et le fichier qu'il désigne doit être le même (appareil, inode).
 */
async function sameFileInRoots(
  handle: FileHandle,
  target: string,
  roots: readonly string[]
): Promise<boolean> {
  const opened = await handle.stat({ bigint: true })
  const now = await real(target).catch(() => null)
  if (!now) return false
  const allowed = await Promise.all(roots.map((r) => real(r)))
  if (!allowed.some((r) => inside(r, now))) return false
  const named = await stat(now, { bigint: true }).catch(() => null)
  return !!named && named.dev === opened.dev && named.ino === opened.ino
}

/**
 * Fichier pour l'affichage (Q39 à Q42) : texte (1 Mo au plus, le reste coupé et dit), image
 * (20 Mo au plus, en `data:`), ou binaire. Un fichier de secret se lit comme un autre (Q8). Ni un
 * FIFO, ni un périphérique : refusés avant et après l'ouverture (B1). `known` : la version que le
 * renderer a déjà ; si rien n'a changé, `unchanged` et rien n'est lu (C4).
 */
export async function readFileForView(
  root: string,
  relative: string,
  roots: readonly string[] = [root],
  known?: KnownVersion
): Promise<FileContent> {
  const target = await resolveInRoot(root, relative, roots)
  const before = await stat(target)
  if (!before.isFile()) throw new Error(t('files.error.notFile', { path: relative }))
  const handle = await open(target, READ_FLAGS)
  try {
    const info = await handle.stat()
    if (!info.isFile()) throw new Error(t('files.error.notFile', { path: relative }))
    if (!(await sameFileInRoots(handle, target, roots))) {
      throw new Error(t('files.error.outside', { path: relative }))
    }
    const modified = Math.round(info.mtimeMs)
    const size = info.size
    if (known && known.modified === modified && known.size === size) {
      return { kind: 'unchanged', size, modified }
    }
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
    const encoding = mime ? undefined : textEncoding(buffer)
    if (!encoding) return { kind: 'binary', size, modified, ...runs }
    const truncated = size > MAX_TEXT_BYTES
    const text = decode(buffer, encoding, truncated)
    return { kind: 'text', text, size, truncated, modified, ...runs }
  } finally {
    await handle.close()
  }
}

async function readStart(handle: FileHandle, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const { bytesRead } = await handle.read(buffer, read, length - read, read)
    if (bytesRead === 0) break
    read += bytesRead
  }
  return buffer.subarray(0, read)
}
