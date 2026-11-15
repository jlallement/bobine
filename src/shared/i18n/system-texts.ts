/**
 * Textes propres au système (fiches 145 et 229) : `fr.json` et `en.json` sont écrits pour macOS
 * (« ce Mac », « Finder », « trousseau macOS ») ; leur section `systemTexts` donne, par groupe, les
 * textes à mettre à la place ailleurs. Le groupe dépend des capacités de la plateforme, jamais du
 * nom du système :
 * - `withoutFinder` : sans la capacité `finder` (Linux, Windows) — textes génériques (« cet
 *   ordinateur », « gestionnaire de fichiers », « trousseau de la session ») ;
 * - `explorer` : avec la capacité `explorer` (Windows), par-dessus — « Explorateur de fichiers »,
 *   « Windows (DPAPI) ».
 * Sur le Mac (`finder`), aucun groupe : les textes restent ceux des fichiers, à l'identique.
 */
import type { PlatformFeatures } from '../platform'

export const SYSTEM_TEXT_GROUPS = ['withoutFinder', 'explorer'] as const
export type SystemTextGroup = (typeof SYSTEM_TEXT_GROUPS)[number]

/** Groupes à appliquer, dans l'ordre (le dernier l'emporte). */
export function systemTextGroups(
  features: Pick<PlatformFeatures, 'finder' | 'explorer'>
): SystemTextGroup[] {
  if (features.finder) return []
  return features.explorer ? ['withoutFinder', 'explorer'] : ['withoutFinder']
}

type Tree = { [key: string]: unknown }
const isTree = (value: unknown): value is Tree =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `base` avec les feuilles de `overlay` à la place des siennes (nouvel objet, `base` intact). */
function overlaid(base: Tree, overlay: Tree): Tree {
  const result: Tree = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key]
    result[key] = isTree(value) && isTree(current) ? overlaid(current, value) : value
  }
  return result
}

/** Les textes d'une langue pour ces capacités : ceux du Mac, recouverts par les groupes. */
export function withSystemTexts<T extends object>(
  messages: T,
  features: Pick<PlatformFeatures, 'finder' | 'explorer'>
): T {
  const groups = systemTextGroups(features)
  if (!groups.length) return messages
  const all = (messages as Tree)['systemTexts']
  if (!isTree(all)) return messages
  let result = messages as Tree
  for (const group of groups) {
    const overlay = all[group]
    if (isTree(overlay)) result = overlaid(result, overlay)
  }
  return result as T
}
