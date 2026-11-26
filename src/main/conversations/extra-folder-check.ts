/**
 * Vérification d'un chemin proposé comme autre dossier d'une conversation (fiche 290). Un seul
 * chemin de code pour les trois sources : fenêtre native, saisie au clavier, dossier glissé (le
 * renderer n'a que la chaîne ; le main décide). Système injecté (`path.win32` et un faux disque
 * dans les essais) ; **rien de synchrone sur le disque** : un partage réseau figé ne gèle pas le
 * main, la vérification s'arrête au bout de `timeoutMs` (raison `timeout`).
 *
 * Règles (tableau complet dans la fiche 290) :
 * - espaces autour et une paire de guillemets autour retirés (un espace en fin de nom est perdu :
 *   accepté) ; vide, démesuré, caractère de contrôle : refusés ;
 * - `file://…` : converti (`fileURLToPath`, à la façon de la plateforme), puis mêmes règles ;
 *   tout autre schéma (`http://…`) : `notLocal` ;
 * - `~` et `~/…` (`~\…` sous Windows) : le dossier personnel ; relatif : refusé, jamais résolu ;
 * - Windows : lettre de lecteur complète ou UNC seulement ; ailleurs, `\` est un caractère du nom ;
 * - normalisé, puis **liens suivis jusqu'au bout** (`realpath` du système) : le dossier réel est
 *   retenu (l'accès donné à l'agent est celui que montre la liste ; doublons reconnus ; casse
 *   réelle sous macOS et Windows) ;
 * - trop large (`tooBroad`) : racine du disque, d'un lecteur ou d'un partage, dossier personnel
 *   exact (l'agent aurait `~/.ssh` et les configurations) — un parent du dossier de travail passe ;
 * - absent : `notFound` ; fichier : `notDirectory` ; illisible : `unreadable`, ou `privacy` quand
 *   macOS refuse l'accès (protection des données, `EPERM`).
 *
 * Dossier de travail, sous-dossier de celui-ci, doublon : `folderKey` (asynchrone, avant
 * l'écriture), puis une comparaison de chaînes au moment d'écrire (`additional-directories.ts`).
 */
import { constants } from 'node:fs'
import { access, opendir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { posix, win32, type PlatformPath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_FOLDER_INPUT, type AddFolderResult } from '@shared/extra-folders'
import { isDriveAbsolute, windowsKey } from '@shared/windows-paths'

/** Lecture d'un dossier : `ok`, refusée (`denied`), ou refusée par la protection de macOS. */
export type FolderAccess = 'ok' | 'denied' | 'privacy'

/** Ce dont la vérification dépend du système ; par défaut, celui de la machine. */
export interface FolderSystem {
  path: PlatformPath
  /** Dossier personnel, pour `~` et `tooBroad` ; '' si inconnu (`~` refusé). */
  home: string
  /** Chemin réel, liens suivis ; rejette avec `code` (`ENOENT`, `EACCES`…). */
  realpath: (path: string) => Promise<string>
  isDirectory: (path: string) => Promise<boolean>
  /** Le dossier se lit et se traverse, et sa liste s'ouvre. */
  access: (path: string) => Promise<FolderAccess>
  /** Délai de la vérification sur le disque, en millisecondes. */
  timeoutMs: number
}

const nodePath: PlatformPath = process.platform === 'win32' ? win32 : posix
const code = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code

/** Lecture réelle ; `EPERM` sous macOS : la protection des données (Documents, Bureau…). */
async function folderAccess(path: string): Promise<FolderAccess> {
  try {
    await access(path, constants.R_OK | constants.X_OK)
    // `access` peut dire oui quand macOS refuse la liste : l'ouvrir pour de bon.
    await (await opendir(path)).close()
    return 'ok'
  } catch (error) {
    return process.platform === 'darwin' && code(error) === 'EPERM' ? 'privacy' : 'denied'
  }
}

export const NATIVE_FOLDER_SYSTEM: FolderSystem = {
  path: nodePath,
  home: homedir(),
  // `fs.promises.realpath` est le `realpath` du système : la casse réelle sous macOS et Windows.
  realpath: (path) => realpath(path),
  isDirectory: async (path) => (await stat(path)).isDirectory(),
  access: folderAccess,
  timeoutMs: 5000
}

const isWindows = (p: PlatformPath) => p.sep === '\\'
const TIMED_OUT = Symbol('timeout')

/**
 * `promise`, ou `TIMED_OUT` après `ms`. L'appel au disque en cours n'est pas annulé (Node ne le
 * permet pas) : il finit en arrière-plan, son résultat est ignoré.
 */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<typeof TIMED_OUT>((done) => {
    timer = setTimeout(() => done(TIMED_OUT), ms)
  })
  try {
    return await Promise.race([promise, late])
  } finally {
    clearTimeout(timer)
  }
}

/** Une paire de guillemets autour (`"…"` ou `'…'`), retirée une fois. */
function unquote(text: string): string {
  const quoted = /^(["'])(.*)\1$/s.exec(text)
  return quoted ? (quoted[2] ?? '').trim() : text
}

const CONTROL = /[\u0000-\u001f\u007f]/
/** Un schéma d'adresse (`file://`, `http://`) ; deux lettres au moins : `C://` est un lecteur. */
const SCHEME = /^([a-z][a-z0-9+.-]+):\/\//i

/** `~` et `~/…` (`~\…` sous Windows) : le dossier personnel ; sinon tel quel. */
function expandHome(text: string, sys: Pick<FolderSystem, 'path' | 'home'>): string | undefined {
  if (text !== '~' && !text.startsWith('~/') && !(isWindows(sys.path) && text.startsWith('~\\')))
    return text
  return sys.home ? sys.path.join(sys.home, text.slice(1)) : undefined
}

/** Absolu au sens de la règle (Windows : lecteur complet ou UNC, jamais `\dossier`). */
function absolute(text: string, p: PlatformPath): boolean {
  return isWindows(p)
    ? isDriveAbsolute(text) || /^\\\\[^\\/]+[\\/]+[^\\/]+/.test(text)
    : p.isAbsolute(text)
}

/** `file://…` en chemin de la plateforme, ou la raison du refus. */
function fromFileUrl(text: string, p: PlatformPath): AddFolderResult {
  try {
    return { ok: true, folder: fileURLToPath(text, { windows: isWindows(p) }) }
  } catch (error) {
    // Hôte distant (`file://serveur/…` hors Windows) : pas un dossier de cet ordinateur.
    const remote = code(error) === 'ERR_INVALID_FILE_URL_HOST'
    return { ok: false, reason: remote ? 'notLocal' : 'invalid' }
  }
}

/**
 * Lecture du texte reçu, sans toucher au disque : le chemin absolu normalisé, ou la raison du
 * refus.
 */
export function parseFolderInput(
  raw: string,
  sys: Pick<FolderSystem, 'path' | 'home'>
): AddFolderResult {
  if (raw.length > MAX_FOLDER_INPUT) return { ok: false, reason: 'tooLong' }
  let text = unquote(raw.trim())
  if (!text) return { ok: false, reason: 'empty' }
  if (CONTROL.test(text)) return { ok: false, reason: 'invalid' }
  const scheme = SCHEME.exec(text)?.[1]
  if (scheme) {
    if (scheme.toLowerCase() !== 'file') return { ok: false, reason: 'notLocal' }
    const converted = fromFileUrl(text, sys.path)
    if (!converted.ok) return converted
    text = converted.folder
    if (CONTROL.test(text)) return { ok: false, reason: 'invalid' }
  } else {
    const expanded = expandHome(text, sys)
    if (!expanded) return { ok: false, reason: 'notAbsolute' }
    text = expanded
  }
  if (!absolute(text, sys.path)) return { ok: false, reason: 'notAbsolute' }
  return { ok: true, folder: sys.path.resolve(text) }
}

/** Sans séparateur final ; sans casse sous Windows : la forme comparée. */
function comparable(path: string, p: PlatformPath): string {
  const trimmed = path.replace(isWindows(p) ? /[\\/]+$/ : /\/+$/, '')
  return isWindows(p) ? windowsKey(trimmed) : trimmed
}

/** Racine du disque, d'un lecteur ou d'un partage UNC. */
const isRoot = (real: string, p: PlatformPath) =>
  comparable(real, p) === comparable(p.parse(real).root, p)

/**
 * Clé de comparaison d'un dossier : son chemin réel s'il existe et répond dans le délai, sinon son
 * chemin normalisé (dossier disparu, ou enregistré avant la fiche 290 sur un partage figé).
 */
export async function folderKey(
  folder: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
): Promise<string> {
  const real = await within(
    sys.realpath(folder).catch(() => sys.path.resolve(folder)),
    sys.timeoutMs
  )
  return comparable(real === TIMED_OUT ? sys.path.resolve(folder) : real, sys.path)
}

/** Clé sans lecture du disque : pour un dossier déjà réel (chemin rendu par `checkExtraFolder`). */
export const plainKey = (folder: string, sys: Pick<FolderSystem, 'path'> = NATIVE_FOLDER_SYSTEM) =>
  comparable(sys.path.resolve(folder), sys.path)

/** `inner` est strictement sous `outer` (deux clés). */
export function isUnder(inner: string, outer: string, p: PlatformPath = nodePath): boolean {
  const rel = p.relative(outer, inner)
  return rel !== '' && !rel.startsWith('..') && !p.isAbsolute(rel)
}

/** Le disque, une fois le texte lu : dossier réel ou raison. */
async function onDisk(asked: string, sys: FolderSystem): Promise<AddFolderResult> {
  let real: string
  try {
    real = await sys.realpath(asked)
  } catch (error) {
    const closed = code(error) === 'EACCES' || code(error) === 'EPERM'
    return { ok: false, reason: closed ? 'unreadable' : 'notFound', folder: asked }
  }
  if (isRoot(real, sys.path)) return { ok: false, reason: 'tooBroad', folder: real }
  if (sys.home && comparable(real, sys.path) === (await folderKey(sys.home, sys)))
    return { ok: false, reason: 'tooBroad', folder: real }
  try {
    if (!(await sys.isDirectory(real))) return { ok: false, reason: 'notDirectory', folder: real }
  } catch {
    return { ok: false, reason: 'notFound', folder: asked }
  }
  const readable = await sys.access(real)
  if (readable === 'privacy') return { ok: false, reason: 'privacy', folder: real }
  if (readable === 'denied') return { ok: false, reason: 'unreadable', folder: real }
  return { ok: true, folder: real }
}

/**
 * Vérification complète d'un chemin reçu (texte, puis disque dans le délai) : le dossier réel à
 * retenir, ou la raison du refus et le chemin compris. Le dossier de travail et les doublons se
 * vérifient à part, au moment d'écrire la liste.
 */
export async function checkExtraFolder(
  raw: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
): Promise<AddFolderResult> {
  const parsed = parseFolderInput(raw, sys)
  if (!parsed.ok) return parsed
  const result = await within(onDisk(parsed.folder, sys), sys.timeoutMs)
  return result === TIMED_OUT ? { ok: false, reason: 'timeout', folder: parsed.folder } : result
}
