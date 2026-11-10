/**
 * Premier lancement (fiche 188) : le dossier d'essai vide (« Pour découvrir sans rien toucher »), et
 * ce que la première conversation propose d'après le dossier choisi. N'importe pas `electron`.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { FolderHints } from '@shared/onboarding'

/** Au-delà, on renonce (un dossier `essai-100` n'arrive pas par hasard). */
const MAX_TRIES = 100

/**
 * Crée un dossier neuf `<parent>/<nom>`, sinon `<nom>-2`, `<nom>-3`… : jamais un dossier qui
 * existe déjà (même vide), jamais un lien. La création est atomique (`mkdir` sans `recursive`
 * échoue si le nom est pris, lien compris). Le parent ne doit pas être un lien, et son chemin réel
 * reste sous celui de `root` (le dossier personnel).
 */
export function createTrialFolder(parent: string, name: string, root: string): string {
  mkdirSync(parent, { recursive: true })
  if (lstatSync(parent).isSymbolicLink())
    throw new Error(`Trial folder parent is a link: ${parent}`)
  const realRoot = realpathSync(root)
  const realParent = realpathSync(parent)
  if (realParent !== realRoot && !realParent.startsWith(realRoot + sep)) {
    throw new Error(`Trial folder parent outside ${root}: ${parent}`)
  }
  for (let i = 1; i <= MAX_TRIES; i++) {
    const candidate = join(realParent, i === 1 ? name : `${name}-${i}`)
    try {
      mkdirSync(candidate)
      return candidate
    } catch (error) {
      if ((error as { code?: string }).code !== 'EEXIST') throw error
    }
  }
  throw new Error(`No free trial folder in ${parent}`)
}

/** Chemin montré à l'utilisateur : `~` pour le dossier personnel. */
export function displayPath(path: string, home: string): string {
  return path === home || path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path
}

export function folderHints(folder: string): FolderHints {
  const testCommand = packageTestCommand(folder)
  return testCommand ? { testCommand } : {}
}

/** `pnpm test`, `yarn test`, `bun test` ou `npm test`, si `package.json` déclare `test`. */
function packageTestCommand(folder: string): string | undefined {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
    const scripts = (manifest as { scripts?: Record<string, unknown> } | null)?.scripts
    if (typeof scripts?.['test'] !== 'string') return undefined
  } catch {
    return undefined
  }
  const has = (file: string) => existsSync(join(folder, file))
  if (has('pnpm-lock.yaml')) return 'pnpm test'
  if (has('yarn.lock')) return 'yarn test'
  if (has('bun.lockb') || has('bun.lock')) return 'bun test'
  return 'npm test'
}
