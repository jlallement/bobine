/**
 * Ce qui change pour git sous Windows (fiche 229, lot 4), en un seul endroit. Le système est celui
 * des processus (`launchSystem()`, ADR-0050), jamais `BOBINE_PLATFORM` : sur macOS et sous Linux,
 * chaque fonction rend exactement ce qu'elle reçoit. N'importe pas `electron`.
 */
import { basename, win32 } from 'node:path'
import { launchSystem, type ProcessSystem } from '../process-launch'

/**
 * Le programme lancé est-il git ? Unix : `git` exactement, comme avant. Windows : `git` ou
 * `git.exe`, sans casse, quel que soit le séparateur du chemin.
 */
export function isGitProgram(file: string, system: ProcessSystem = launchSystem()): boolean {
  if (system === 'posix') return basename(file) === 'git'
  return /^git(\.exe)?$/i.test(win32.basename(file))
}

/**
 * Chemin rendu par git (`rev-parse --show-toplevel`, `worktree list`, `--git-common-dir`) en chemin
 * du système. Git for Windows écrit `C:/Users/x/dépôt` ; l'app compare et joint des chemins
 * `C:\Users\x\dépôt`. Unix : inchangé.
 */
export function nativeGitPath(path: string, system: ProcessSystem = launchSystem()): string {
  if (system === 'posix' || !path) return path
  // `C:/…` ou `//serveur/partage/…` : absolus ; un chemin relatif garde sa forme (joint ensuite).
  if (!/^([A-Za-z]:[\\/]|[\\/]{2}[^\\/])/.test(path)) return path.replace(/\//g, '\\')
  const normalized = win32.normalize(path)
  // Lecteur en majuscule, comme `process.cwd()` et les boîtes de dialogue de Windows.
  return normalized.replace(/^[a-z]:/, (drive) => drive.toUpperCase())
}

/** Deux chemins du système désignent-ils le même dossier ? Windows : sans casse ni `/` contre `\`. */
export function samePath(a: string, b: string, system: ProcessSystem = launchSystem()): boolean {
  if (system === 'posix') return a === b
  const key = (p: string) =>
    win32.normalize(nativeGitPath(p, system)).replace(/\\+$/, '').toLowerCase()
  return key(a) === key(b)
}

/**
 * Réglages ajoutés aux commandes git de l'app sous Windows, par l'environnement
 * (`GIT_CONFIG_COUNT`, git 2.31+), sans toucher à la configuration de l'utilisateur :
 * `core.longpaths`, car les worktrees (`<dépôt>\.worktrees\<nom>\…`) dépassent vite 260
 * caractères. Un `GIT_CONFIG_COUNT` déjà posé (par l'utilisateur) est prolongé, pas remplacé.
 */
const WINDOWS_GIT_CONFIG: ReadonlyArray<readonly [string, string]> = [['core.longpaths', 'true']]

export function windowsGitConfig(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const start = Number(env['GIT_CONFIG_COUNT'])
  const base = Number.isInteger(start) && start > 0 ? start : 0
  const added: NodeJS.ProcessEnv = {}
  WINDOWS_GIT_CONFIG.forEach(([key, value], i) => {
    added[`GIT_CONFIG_KEY_${base + i}`] = key
    added[`GIT_CONFIG_VALUE_${base + i}`] = value
  })
  return { ...env, ...added, GIT_CONFIG_COUNT: String(base + WINDOWS_GIT_CONFIG.length) }
}
