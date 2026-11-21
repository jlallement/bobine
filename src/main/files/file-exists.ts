/**
 * Liens de fichiers qui mènent quelque part (fiche 272, recette de la rc.3) : un code en ligne de la
 * réponse (`tests/liste.test.js`) ne devient un lien que si le fichier existe. Un seul aller-retour
 * par message, borné : nombre de chemins, longueur, durée. Confiné au dossier de la conversation :
 * un chemin qui en sort (`../x.js`, absolu ailleurs, lien symbolique vers le dehors) n'existe pas
 * pour l'app, et reste du code.
 */
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseFileLink } from '@shared/file-links'
import { currentPlatformFeatures } from '../platform'
import { inside, real } from './file-links'

/** Chemins vérifiés par appel ; les suivants restent du code. */
export const MAX_CHECKED_LINKS = 200
/** Longueur d'un chemin vérifié ; au-delà, ce n'en est pas un. */
const MAX_LINK_LENGTH = 1024
/** Durée d'une vérification : un partage réseau muet ne fait pas attendre (ce qui n'a pas répondu reste du code). */
const CHECK_TIMEOUT_MS = 2000

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
 * Parmi `hrefs` (relatifs à `base`, un dossier du dossier de travail, ou au dossier de travail),
 * ceux qui désignent un fichier ou un dossier existant dans le dossier de travail.
 */
export async function existingFileLinks(
  workspace: string,
  hrefs: readonly string[],
  options: { base?: string; timeoutMs?: number } = {}
): Promise<string[]> {
  const root = await real(workspace)
  const base = options.base ? await real(options.base) : root
  const from = inside(root, base) ? base : root
  const { windowsPaths } = currentPlatformFeatures(process.env, process.platform)
  const check = async (href: string): Promise<string | null> => {
    if (href.length > MAX_LINK_LENGTH) return null
    // Chemins Windows lus comme des fichiers seulement là où ils en sont (capacité, fiche 229).
    const link = parseFileLink(href, { windowsPaths })
    if (!link) return null
    const target = resolve(from, link.path)
    if (!inside(root, target)) return null
    if (!(await stat(target).catch(() => null))) return null
    // Chemin réel : un lien symbolique du dossier ne mène pas au-dehors en douce.
    return inside(root, await real(target)) ? href : null
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<null>((done) => {
    timer = setTimeout(() => done(null), options.timeoutMs ?? CHECK_TIMEOUT_MS)
  })
  try {
    const unique = [...new Set(hrefs)].slice(0, MAX_CHECKED_LINKS)
    const found = await Promise.all(unique.map((href) => Promise.race([check(href), deadline])))
    return found.filter((href): href is string => href !== null)
  } finally {
    clearTimeout(timer)
  }
}
