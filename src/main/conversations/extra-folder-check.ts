/**
 * Vérification d'un chemin proposé comme autre dossier d'une conversation (fiche 290). Un seul
 * chemin de code pour les trois sources : fenêtre native, saisie au clavier, dossier glissé (le
 * renderer n'a que la chaîne ; le main décide). Système injecté (`path.win32` et un faux disque
 * dans les essais).
 *
 * **Rien de synchrone sur le disque**, et un seul délai pour tout un ajout (`Budget`) : le fil
 * principal n'attend jamais le disque. Ce qui est garanti face à un partage réseau figé : la
 * réponse arrive dans le délai (raison `timeout`), sans geler l'interface ; l'appel au disque en
 * cours, lui, n'est pas annulable (Node ne le permet pas) et occupe un fil de libuv jusqu'à ce
 * que le système réponde. Pour ne pas les épuiser : une nouvelle vérification du même chemin est
 * refusée tout de suite (`timeout`) tant que la précédente n'a pas répondu, et les clés des
 * dossiers déjà connus sont mémorisées.
 *
 * Règles (tableau complet dans la fiche 290) :
 * - espaces autour et une paire de guillemets autour retirés (un espace en fin de nom est perdu :
 *   accepté) ; vide, démesuré, caractère de contrôle : refusés ;
 * - `file://…` : converti (`fileURLToPath`, à la façon de la plateforme), puis mêmes règles ;
 *   tout autre schéma (`http://…`) : `notLocal` ;
 * - `~` et `~/…` (`~\…` sous Windows) : le dossier personnel ; relatif : refusé, jamais résolu ;
 * - Windows : lettre de lecteur complète ou UNC seulement ; ailleurs, `\` est un caractère du nom ;
 * - normalisé, puis **liens suivis jusqu'au bout** (`realpath` du système) : le dossier réel est
 *   retenu (l'accès donné à l'agent est celui que montre la liste) ;
 * - **identité** : un dossier se reconnaît par son périphérique et son inode (`stat`), en plus de
 *   son chemin. `realpath` ne réécrit pas les firmlinks de macOS (`/System/Volumes/Data/Users/…`
 *   est `/Users/…`) : seule l'identité les reconnaît ;
 * - trop large (`tooBroad`) : tout dossier qui **contient le dossier personnel** (lui compris,
 *   reconnu par identité : `containsHome`), et toute **racine de volume** (racine du disque, d'un
 *   lecteur ou d'un partage, point de montage : son périphérique diffère de celui de son parent).
 *   Un parent du dossier de travail qui ne contient pas le dossier personnel (`~/Dev`) passe ;
 * - absent : `notFound` ; fichier : `notDirectory` ; illisible : `unreadable`, ou `privacy` quand
 *   macOS refuse l'accès (protection des données, `EPERM`).
 *
 * Dossier de travail, sous-dossier de celui-ci, doublon : `additional-directories.ts`, par les clés
 * (identité et chemin) rendues ici, comparées au moment d'écrire la liste.
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

/** Ce que `stat` dit d'un dossier : genre, périphérique, inode (0 : inconnu, FAT par exemple). */
export interface FolderStat {
  dir: boolean
  dev: string
  ino: string
}

/** Ce dont la vérification dépend du système ; par défaut, celui de la machine. */
export interface FolderSystem {
  path: PlatformPath
  /** Dossier personnel, pour `~` et `tooBroad` ; '' si inconnu (`~` refusé). */
  home: string
  /** Chemin réel, liens suivis ; rejette avec `code` (`ENOENT`, `EACCES`…). */
  realpath: (path: string) => Promise<string>
  /** `stat` (liens suivis) ; rejette comme `realpath`. */
  stat: (path: string) => Promise<FolderStat>
  /** Le dossier se lit et se traverse, et sa liste s'ouvre. */
  access: (path: string) => Promise<FolderAccess>
  /** Délai de tout un ajout, en millisecondes. */
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
  stat: async (path) => {
    // `bigint` : un inode de 64 bits ne tient pas dans un nombre JavaScript.
    const s = await stat(path, { bigint: true })
    return { dir: s.isDirectory(), dev: String(s.dev), ino: String(s.ino) }
  },
  access: folderAccess,
  timeoutMs: 5000
}

const isWindows = (p: PlatformPath) => p.sep === '\\'
const TIMED_OUT = Symbol('timeout')

/** Un seul délai pour tout un ajout : chaque attente prend ce qui reste. */
export class Budget {
  private readonly end: number
  constructor(ms: number) {
    this.end = Date.now() + ms
  }
  left(): number {
    return Math.max(0, this.end - Date.now())
  }
}

/**
 * `promise`, ou `TIMED_OUT` quand le budget est épuisé. L'appel au disque en cours n'est pas
 * annulé (Node ne le permet pas) : il finit en arrière-plan, son résultat est ignoré.
 */
async function within<T>(promise: Promise<T>, budget: Budget): Promise<T | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<typeof TIMED_OUT>((done) => {
    timer = setTimeout(() => done(TIMED_OUT), budget.left())
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

/** Sans séparateur final ; sans casse sous Windows : la forme comparée d'un chemin. */
function comparable(path: string, p: PlatformPath): string {
  const trimmed = path.replace(isWindows(p) ? /[\\/]+$/ : /\/+$/, '')
  return isWindows(p) ? windowsKey(trimmed) : trimmed
}

/** Clé de chemin, sans lire le disque. */
export const pathKey = (folder: string, sys: Pick<FolderSystem, 'path'> = NATIVE_FOLDER_SYSTEM) =>
  `path:${comparable(sys.path.resolve(folder), sys.path)}`

/** Clé d'identité (périphérique et inode) ; aucune si l'inode est inconnu. */
const idKeys = (s: FolderStat): string[] => (s.ino && s.ino !== '0' ? [`id:${s.dev}:${s.ino}`] : [])

/** Racine du disque, d'un lecteur ou d'un partage UNC, d'après le seul chemin. */
const isPathRoot = (real: string, p: PlatformPath) =>
  comparable(real, p) === comparable(p.parse(real).root, p)

/**
 * Chemins dont la vérification a dépassé le délai sans que le disque ait encore répondu, par
 * système : une nouvelle vérification du même chemin est refusée tout de suite, sans relancer
 * d'appel (chaque appel figé garde un fil de libuv).
 */
const overdues = new WeakMap<FolderSystem, Set<string>>()
const overdueOf = (sys: FolderSystem) => {
  let set = overdues.get(sys)
  if (!set) overdues.set(sys, (set = new Set()))
  return set
}

/**
 * Les clés d'un dossier : son identité et son chemin réel, ou son chemin seul s'il ne répond pas.
 * Un dossier dont la lecture a dépassé le délai et n'a pas répondu n'est pas relu (`overdueOf`).
 */
async function keysOf(folder: string, sys: FolderSystem, budget: Budget): Promise<string[]> {
  const fallback = [pathKey(folder, sys)]
  const overdue = overdueOf(sys)
  if (overdue.has(folder)) return fallback
  const read = (async () => {
    const real = await sys.realpath(folder)
    return [...idKeys(await sys.stat(real)), pathKey(real, sys), pathKey(folder, sys)]
  })().catch(() => fallback)
  const keys = await within(read, budget)
  if (keys !== TIMED_OUT) return [...new Set(keys)]
  overdue.add(folder)
  void read.finally(() => overdue.delete(folder))
  return fallback
}

/** Clés mémorisées par système (dossiers déjà enregistrés, dossier personnel et ses parents). */
const memories = new WeakMap<FolderSystem, Map<string, string[]>>()
const memoryOf = (sys: FolderSystem) => {
  let memory = memories.get(sys)
  if (!memory) memories.set(sys, (memory = new Map()))
  return memory
}

/**
 * Clés d'un dossier déjà enregistré (dossier de travail, autres dossiers), mémorisées une fois
 * lues pour de bon : un ajout ne relit pas toute la liste. Sans réponse : chemin seul, pas mémorisé.
 */
export async function folderKeys(
  folder: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM,
  budget: Budget = new Budget(sys.timeoutMs)
): Promise<string[]> {
  const memory = memoryOf(sys)
  const known = memory.get(folder)
  if (known) return known
  const keys = await keysOf(folder, sys, budget)
  if (keys.some((k) => k.startsWith('id:'))) memory.set(folder, keys)
  return keys
}

/** Retient les clés d'un dossier vérifié (le dossier retenu lors d'un ajout). */
export function rememberKeys(folder: string, keys: string[], sys: FolderSystem): void {
  memoryOf(sys).set(folder, keys)
}

/** Clés connues sans lire le disque (mémorisées, sinon chemin). Pour la section synchrone. */
export const knownKeys = (folder: string, sys: FolderSystem = NATIVE_FOLDER_SYSTEM) =>
  memoryOf(sys).get(folder) ?? [pathKey(folder, sys)]

/** Clés de chaque dossier de la chaîne qui mène de `real` à la racine (lui compris). */
async function chainKeys(real: string, sys: FolderSystem, budget: Budget): Promise<string[][]> {
  const chain: string[][] = []
  let current = real
  for (;;) {
    chain.push(await folderKeys(current, sys, budget))
    const parent = sys.path.dirname(current)
    if (parent === current) return chain
    current = parent
  }
}

/**
 * `real` contient le dossier personnel (ou l'est) : pour chaque fin du chemin du dossier personnel
 * (`Users/moi`, `moi`, rien), `real/<fin>` est-il le dossier personnel, par identité ? Juste aussi à
 * travers un firmlink ou un montage qui reprend la même arborescence : `/System/Volumes/Data` et
 * `/System/Volumes/Data/Users` contiennent `/Users/moi` sous macOS (D1, D2 du testeur).
 */
async function containsHome(real: string, sys: FolderSystem, budget: Budget): Promise<boolean> {
  if (!sys.home) return false
  const resolved = await within(
    sys.realpath(sys.home).catch(() => sys.path.resolve(sys.home)),
    budget
  )
  const home = resolved === TIMED_OUT ? sys.path.resolve(sys.home) : resolved
  const homeKeys = await folderKeys(home, sys, budget)
  const parts = home.slice(sys.path.parse(home).root.length).split(sys.path.sep).filter(Boolean)
  for (let start = 0; start <= parts.length; start++) {
    const below = sys.path.join(real, ...parts.slice(start))
    if (shares(await folderKeys(below, sys, budget), homeKeys)) return true
  }
  return false
}

const shares = (a: readonly string[], b: readonly string[]) => a.some((key) => b.includes(key))

/** Un dossier vérifié : chemin réel, ses clés, celles de ses parents (pour « est dans »). */
export interface ExaminedFolder {
  ok: true
  folder: string
  keys: string[]
  parents: string[]
}

/** Le disque, une fois le texte lu : dossier réel et ses clés, ou raison. */
async function onDisk(
  asked: string,
  sys: FolderSystem,
  budget: Budget
): Promise<ExaminedFolder | Extract<AddFolderResult, { ok: false }>> {
  let real: string
  try {
    real = await sys.realpath(asked)
  } catch (error) {
    const closed = code(error) === 'EACCES' || code(error) === 'EPERM'
    return { ok: false, reason: closed ? 'unreadable' : 'notFound', folder: asked }
  }
  let info: FolderStat
  try {
    info = await sys.stat(real)
  } catch {
    return { ok: false, reason: 'notFound', folder: asked }
  }
  if (!info.dir) return { ok: false, reason: 'notDirectory', folder: real }
  const keys = [...new Set([...idKeys(info), pathKey(real, sys)])]
  const parent = sys.path.dirname(real)
  // Racine de volume : racine du chemin, ou périphérique différent de celui du parent.
  const mount =
    isPathRoot(real, sys.path) ||
    (await sys
      .stat(parent)
      .then((s) => s.dev !== info.dev)
      .catch(() => false))
  if (mount || (await containsHome(real, sys, budget)))
    return { ok: false, reason: 'tooBroad', folder: real }
  const readable = await sys.access(real)
  if (readable === 'privacy') return { ok: false, reason: 'privacy', folder: real }
  if (readable === 'denied') return { ok: false, reason: 'unreadable', folder: real }
  const parents = parent === real ? [] : (await chainKeys(parent, sys, budget)).flat()
  return { ok: true, folder: real, keys, parents }
}

/**
 * Vérification complète d'un chemin reçu (texte, puis disque dans le budget) : le dossier réel à
 * retenir et ses clés, ou la raison du refus et le chemin compris. Le dossier de travail et les
 * doublons se vérifient à part, au moment d'écrire la liste.
 */
export async function examineFolder(
  raw: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM,
  budget: Budget = new Budget(sys.timeoutMs)
): Promise<ExaminedFolder | Extract<AddFolderResult, { ok: false }>> {
  const parsed = parseFolderInput(raw, sys)
  if (!parsed.ok) return parsed
  const asked = parsed.folder
  const overdue = overdueOf(sys)
  // La vérification précédente de ce chemin a dépassé le délai et n'a pas répondu : pas une de plus.
  if (overdue.has(asked)) return { ok: false, reason: 'timeout', folder: asked }
  const disk = onDisk(asked, sys, budget)
  const result = await within(disk, budget)
  if (result !== TIMED_OUT) return result
  overdue.add(asked)
  void disk.finally(() => overdue.delete(asked)).catch(() => {})
  return { ok: false, reason: 'timeout', folder: asked }
}

/** `examineFolder`, en réponse publique : dossier retenu, ou raison. */
export async function checkExtraFolder(
  raw: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
): Promise<AddFolderResult> {
  const result = await examineFolder(raw, sys)
  return result.ok ? { ok: true, folder: result.folder } : result
}
