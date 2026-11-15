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
 */
import { lstatSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import { sharesContent } from './hard-links'

export type WriteAreaVerdict =
  { decision: 'allow'; file: string } | { decision: 'refuse'; file: string } | { decision: 'ask' }

/** `path` (absolu) est sous `folder` (ou est `folder`), d'après les seuls chemins. */
export function isInside(folder: string, path: string): boolean {
  if (!isAbsolute(path)) return false
  const rel = relative(resolve(folder), resolve(path))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Chemin réel de l'ancêtre existant le plus profond de `path` (liens symboliques suivis). */
function realAncestor(path: string): string | undefined {
  let current = resolve(path)
  for (;;) {
    try {
      return realpathSync(current)
    } catch {
      const parent = dirname(current)
      if (parent === current) return undefined
      current = parent
    }
  }
}

/** La cible sort du dossier : par son chemin, ou par un lien symbolique en route. */
function escapes(area: string, realArea: string, path: string): boolean {
  if (!isInside(area, path)) return true
  const real = realAncestor(path)
  return real === undefined || !isInside(realArea, real)
}

/**
 * Document du premier niveau, visible, et pas un lien symbolique (ni un dossier), ni un fichier à
 * plusieurs noms (fiche 230). `lstat` sur le chemin même : `escapes` a déjà vérifié par `realpath`
 * que le dossier qui le contient est bien celui de la discussion.
 */
function isDocument(area: string, path: string): boolean {
  const rel = relative(resolve(area), resolve(path))
  if (!rel || rel.includes(sep) || rel.startsWith('.')) return false
  try {
    const stat = lstatSync(path)
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
  toolCall: RequestPermissionRequest['toolCall']
): WriteAreaVerdict {
  const located = (toolCall.locations ?? []).map((l) => l.path)
  const diffs = diffPaths(toolCall)
  const targets = [...new Set([...located, ...diffs])]
  if (targets.length === 0 || targets.some((p) => !isAbsolute(p))) return { decision: 'ask' }
  let realArea: string
  try {
    realArea = realpathSync(area)
  } catch {
    return { decision: 'ask' }
  }
  const outside = targets.find((p) => escapes(area, realArea, p))
  if (outside) return { decision: 'refuse', file: resolve(outside) }
  if (toolCall.kind === 'move') return { decision: 'ask' }
  const agree = located.length === 0 || diffs.length === 0 || sameSet(located, diffs)
  if (!agree || !targets.every((p) => isDocument(area, p))) return { decision: 'ask' }
  return { decision: 'allow', file: basename(targets[0] ?? '') }
}

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a.map((p) => resolve(p)))
  const right = new Set(b.map((p) => resolve(p)))
  return left.size === right.size && [...left].every((p) => right.has(p))
}
