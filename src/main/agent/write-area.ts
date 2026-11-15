/**
 * Écritures d'une discussion (fiche 224, relecture du tech lead) : ce que Bobine décide seule d'une
 * demande d'écrire, d'après **toutes** ses cibles — les emplacements (`locations`, repris du
 * `tool_call` quand la demande n'en porte pas) et les chemins de ses diffs. Prudent par défaut :
 *
 * - une cible hors du dossier (chemin, ou lien symbolique qui y mène) : refusé ;
 * - accordé une fois seulement si chaque cible est un document du dossier — un nom visible du
 *   premier niveau (ni sous-dossier, ni fichier caché : `.bob/`, `.opencode/` peuvent déclarer des
 *   commandes ou des serveurs), pas un lien symbolique, et pas un fichier à plusieurs noms (lien
 *   physique, fiche 230 : y écrire modifierait aussi l'autre nom, peut-être hors du dossier) ;
 * - tout le reste est posé à l'utilisateur : chemin relatif ou `~` (ACP veut des chemins absolus),
 *   aucune cible connue, emplacements et diffs qui ne disent pas la même chose, déplacement (sa
 *   destination n'est pas toujours dite).
 *
 * Sous Windows (fiche 229, lot 3 ; `windows`), en plus : seul un chemin à lettre de lecteur complet
 * (`C:\…`) peut être accordé — UNC, `\\?\`, `\\.\`, `\Windows` (racine du lecteur de l'app),
 * `/c/…` sont posés ; un nom réservé (`NUL`, `CON.txt`), un flux (`doc.txt:flux`), un point ou un
 * espace final (l'API Win32 les retire : `lien.txt.` écrirait dans `lien.txt`), un nom court 8.3
 * (`ENV~1` pour `.env`) ou un nom qui agit dans l'Explorateur (`desktop.ini`, `*.lnk`) sont posés.
 * Jonctions NTFS et liens symboliques : `lstat` les dit liens et `realpath` les suit (relevé dans la
 * VM, session non élevée comprise) ; liens physiques : `lstat().nlink` juste (fiche 230).
 */
import { lstatSync, realpathSync, type Stats } from 'node:fs'
import { posix, win32, type PlatformPath } from 'node:path'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import { actsWhenShown, isDriveAbsolute, windowsNameProblem } from '../../shared/windows-paths'
import { sharesContent } from './hard-links'

export type WriteAreaVerdict =
  { decision: 'allow'; file: string } | { decision: 'refuse'; file: string } | { decision: 'ask' }

/**
 * Ce dont la décision dépend du système, injecté pour les essais (`path.win32` sur le Mac) ; par
 * défaut, celui de la machine.
 */
export interface WriteAreaSystem {
  path: PlatformPath
  realpath: (path: string) => string
  lstat: (path: string) => Pick<Stats, 'isFile' | 'nlink'>
  /** Règles de noms et de formes de chemins de Windows. */
  windows: boolean
}

/** `node:path` de la machine (le même objet que `posix` ou `win32`). */
const nodePath: PlatformPath = process.platform === 'win32' ? win32 : posix

const NATIVE: WriteAreaSystem = {
  path: nodePath,
  realpath: (path) => realpathSync(path),
  lstat: (path) => lstatSync(path),
  windows: process.platform === 'win32'
}

/** `path` (absolu) est sous `folder` (ou est `folder`), d'après les seuls chemins. */
export function isInside(folder: string, path: string, p: PlatformPath = nodePath): boolean {
  if (!p.isAbsolute(path)) return false
  const rel = p.relative(p.resolve(folder), p.resolve(path))
  return rel === '' || (!rel.startsWith('..') && !p.isAbsolute(rel))
}

/** Chemin réel de l'ancêtre existant le plus profond de `path` (liens symboliques suivis). */
function realAncestor(path: string, sys: WriteAreaSystem): string | undefined {
  let current = sys.path.resolve(path)
  for (;;) {
    try {
      return sys.realpath(current)
    } catch {
      const parent = sys.path.dirname(current)
      if (parent === current) return undefined
      current = parent
    }
  }
}

/** La cible sort du dossier : par son chemin, ou par un lien symbolique en route. */
function escapes(area: string, realArea: string, path: string, sys: WriteAreaSystem): boolean {
  if (!isInside(area, path, sys.path)) return true
  const real = realAncestor(path, sys)
  return real === undefined || !isInside(realArea, real, sys.path)
}

/**
 * Sous Windows, une cible que Bobine ne sait pas juger seule : autre forme qu'une lettre de lecteur
 * complète, ou un segment au nom spécial (réservé, flux, point ou espace final, nom court…).
 */
function windowsDoubt(path: string): boolean {
  if (!isDriveAbsolute(path)) return true
  const names = path.slice(3).split(/[\\/]/)
  return names.some((n) => n !== '' && n !== '.' && n !== '..' && !!windowsNameProblem(n))
}

/**
 * Document du premier niveau, visible, et pas un lien symbolique (ni un dossier), ni un fichier à
 * plusieurs noms (fiche 230). `lstat` sur le chemin même : `escapes` a déjà vérifié par `realpath`
 * que le dossier qui le contient est bien celui de la discussion.
 */
function isDocument(area: string, path: string, sys: WriteAreaSystem): boolean {
  const { relative, resolve, sep } = sys.path
  const rel = relative(resolve(area), resolve(path))
  if (!rel || rel.includes(sep) || rel.startsWith('.')) return false
  if (sys.windows && (rel.includes('/') || actsWhenShown(rel))) return false
  try {
    const stat = sys.lstat(path)
    return stat.isFile() && !sharesContent(stat)
  } catch {
    return true // À créer : son dossier est celui de la discussion.
  }
}

const diffPaths = (toolCall: RequestPermissionRequest['toolCall']): string[] =>
  (toolCall.content ?? []).flatMap((c) => (c.type === 'diff' ? [c.path] : []))

/** Ce que Bobine décide d'une demande d'écrire dans une discussion de dossier `area`. */
export function writeAreaVerdict(
  area: string,
  toolCall: RequestPermissionRequest['toolCall'],
  sys: WriteAreaSystem = NATIVE
): WriteAreaVerdict {
  const { basename, isAbsolute, resolve } = sys.path
  const located = (toolCall.locations ?? []).map((l) => l.path)
  const diffs = diffPaths(toolCall)
  const targets = [...new Set([...located, ...diffs])]
  if (targets.length === 0 || targets.some((p) => !isAbsolute(p))) return { decision: 'ask' }
  if (sys.windows && targets.some(windowsDoubt)) return { decision: 'ask' }
  let realArea: string
  try {
    realArea = sys.realpath(area)
  } catch {
    return { decision: 'ask' }
  }
  const outside = targets.find((p) => escapes(area, realArea, p, sys))
  if (outside) return { decision: 'refuse', file: resolve(outside) }
  if (toolCall.kind === 'move') return { decision: 'ask' }
  const agree = located.length === 0 || diffs.length === 0 || sameSet(located, diffs, sys)
  if (!agree || !targets.every((p) => isDocument(area, p, sys))) return { decision: 'ask' }
  return { decision: 'allow', file: basename(targets[0] ?? '') }
}

const sameSet = (a: readonly string[], b: readonly string[], sys: WriteAreaSystem) => {
  // Sous Windows, `C:\A\b.md` et `c:/a/B.md` sont le même fichier.
  const key = (p: string) => (sys.windows ? sys.path.resolve(p).toLowerCase() : sys.path.resolve(p))
  const left = new Set(a.map(key))
  const right = new Set(b.map(key))
  return left.size === right.size && [...left].every((p) => right.has(p))
}
