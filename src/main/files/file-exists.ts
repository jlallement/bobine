/**
 * Liens de fichiers qui mènent quelque part (fiche 272, recette de la rc.3) : un code en ligne de la
 * réponse (`tests/liste.test.js`) ne devient un lien que si le fichier existe. Un aller-retour
 * groupé, borné : nombre de chemins, longueur, `stat` simultanés, durée. Confiné au dossier de la
 * conversation : un chemin qui en sort (`../x.js`, absolu ailleurs, lien symbolique vers le dehors)
 * n'existe pas pour l'app, et reste du code.
 */
import { stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { parseFileLink, type FileLinkCheck } from '@shared/file-links'
import { currentPlatformFeatures } from '../platform'
import { launchSystem, type ProcessSystem } from '../process-launch'
import { real } from './file-links'

/** Chemins vérifiés par appel ; les suivants restent du code. */
export const MAX_CHECKED_LINKS = 200
/** Longueur d'un chemin vérifié ; au-delà, ce n'en est pas un. */
const MAX_LINK_LENGTH = 1024
/**
 * Durée d'une vérification, chemins réels du dossier compris : un partage réseau muet ne fait pas
 * attendre. Ce qui n'a pas répondu à temps est « inconnu », pas « absent ».
 */
const CHECK_TIMEOUT_MS = 2000
/** `stat` simultanés : le pool de libuv (4 fils par défaut) reste disponible pour le reste. */
const CONCURRENCY = 8

/** Liste de liens reçue par l'IPC, vérifiée : des textes, pas plus que la borne. */
export function linkList(hrefs: unknown): string[] {
  if (
    !Array.isArray(hrefs) ||
    hrefs.length > MAX_CHECKED_LINKS ||
    hrefs.some((href) => typeof href !== 'string')
  ) {
    throw new Error('Chemins invalides')
  }
  return hrefs as string[]
}

/**
 * `target` est-il `root` ou dans `root` (chemins résolus) ? Sous Windows, sans tenir compte de la
 * casse, comme le système de fichiers.
 */
export function insideOn(system: ProcessSystem, root: string, target: string): boolean {
  const separator = system === 'windows' ? '\\' : sep
  const [r, t] = system === 'windows' ? [root.toLowerCase(), target.toLowerCase()] : [root, target]
  return t === r || t.startsWith(r.endsWith(separator) ? r : r + separator)
}

/**
 * Parmi `hrefs` (relatifs à `base`, un dossier du dossier de travail, ou au dossier de travail),
 * ceux qui désignent un fichier ou un dossier existant dans le dossier de travail (`existing`), et
 * ceux qui n'ont pas pu être vérifiés à temps (`unknown`) ; les autres n'existent pas.
 */
export async function existingFileLinks(
  workspace: string,
  hrefs: readonly string[],
  options: { base?: string; timeoutMs?: number } = {}
): Promise<FileLinkCheck> {
  const unique = [...new Set(hrefs)]
  const checked = unique.slice(0, MAX_CHECKED_LINKS)
  const existing = new Set<string>()
  const settled = new Set<string>()
  const system = launchSystem()
  const inside = (root: string, target: string) => insideOn(system, root, target)
  const { windowsPaths } = currentPlatformFeatures(process.env, process.platform)
  const work = async () => {
    // Le dossier tel que donné et son chemin réel (`/var/…` et `/private/var/…` sous macOS) : un
    // chemin absolu écrit sous l'une ou l'autre forme est dans le dossier.
    const given = resolve(workspace)
    const root = await real(workspace)
    const base = options.base ? await real(options.base) : root
    const from = inside(root, base) ? base : root
    const exists = async (href: string): Promise<boolean> => {
      if (href.length > MAX_LINK_LENGTH) return false
      // Chemins Windows lus comme des fichiers seulement là où ils en sont (capacité, fiche 229).
      const link = parseFileLink(href, { windowsPaths })
      if (!link) return false
      const target = resolve(from, link.path)
      if (!inside(root, target) && !inside(given, target)) return false
      if (!(await stat(target).catch(() => null))) return false
      // Chemin réel : un lien symbolique du dossier ne mène pas au-dehors en douce.
      return inside(root, await real(target))
    }
    let next = 0
    const worker = async () => {
      while (next < checked.length) {
        const href = checked[next++] as string
        if (await exists(href)) existing.add(href)
        settled.add(href)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, checked.length) }, worker))
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((done) => {
    timer = setTimeout(done, options.timeoutMs ?? CHECK_TIMEOUT_MS)
  })
  try {
    // Une erreur inattendue laisse les chemins non vérifiés « inconnus ».
    await Promise.race([work().catch(() => {}), deadline])
  } finally {
    clearTimeout(timer)
  }
  return {
    existing: checked.filter((href) => existing.has(href)),
    unknown: unique.filter((href) => !settled.has(href))
  }
}
