/**
 * Chemins raccourcis pour l'affichage d'une carte (fiche 214) : le dossier de la conversation est
 * dit par son nom (`/private/tmp/…/projet/src` → `projet/src`), le dossier personnel par `~`
 * (`/Users/ada/notes` → `~/notes`). Fonctions pures, sans cas particulier d'agent. Elles ne servent
 * qu'à l'AFFICHAGE d'un libellé : jamais au texte d'une commande qu'on autorise (le bloc de la
 * commande reste entier, fiche 203, sécurité M1), jamais à une décision (risque, « hors du
 * dossier »), qui lisent les chemins entiers.
 *
 * Au moindre doute, le chemin reste tel quel : relatif, `~`, variable, segment `..` (un lien
 * symbolique pourrait le faire sortir), dossier racine, voisin au nom qui commence pareil.
 *
 * Windows (fiche 229) : un dossier personnel `C:\Users\ada` (`%USERPROFILE%`) se lit de même,
 * sans casse, `\` et `/` acceptés (`C:\Users\ada\notes` → `~\notes`). Seul un chemin de forme
 * Windows (lettre de lecteur) prend ce chemin-là : un chemin POSIX ne change pas.
 */
import { isDriveAbsolute, isWindowsPath, windowsSegments, windowsWithin } from './windows-paths.ts'

/** Ce qui sert à raccourcir : le dossier de la conversation et le dossier personnel de l'utilisateur. */
export interface PathContext {
  workspace?: string | undefined
  home?: string | undefined
}

/** Chemin Windows normalisé (`C:\a\b`, casse gardée), ou `undefined` au moindre doute. */
function cleanWindows(path: string): string | undefined {
  if (!isDriveAbsolute(path) || /[$%]/.test(path)) return undefined
  const [drive = '', ...parts] = windowsSegments(path).filter((part) => part !== '.')
  if (parts.includes('..')) return undefined
  return `${drive}\\${parts.join('\\')}`
}

/** Chemin absolu normalisé (sans barres en trop ni `.`), ou `undefined` au moindre doute. */
function clean(path: string): string | undefined {
  if (isWindowsPath(path)) return cleanWindows(path)
  if (!path.startsWith('/') || /\$/.test(path)) return undefined
  const parts = path.split('/').filter((part) => part !== '' && part !== '.')
  if (parts.includes('..')) return undefined
  return `/${parts.join('/')}`
}

/** `path` est `base` ou dedans (déjà normalisés) ; `base` jamais la racine. */
const inside = (path: string, base: string) =>
  isDriveAbsolute(base)
    ? !/^[a-z]:\\$/i.test(base) && isDriveAbsolute(path) && windowsWithin(path, base)
    : base !== '/' && (path === base || path.startsWith(`${base}/`))

/** Dernier segment d'un dossier normalisé. */
const lastName = (folder: string) =>
  isDriveAbsolute(folder)
    ? folder.slice(folder.lastIndexOf('\\') + 1)
    : folder.slice(folder.lastIndexOf('/') + 1)

/**
 * Chemin dit court, ou `undefined` s'il n'y a rien de plus court et sûr à en dire. Le dossier de la
 * conversation l'emporte sur le dossier personnel (une conversation dans `~/projets/livres` dit
 * `livres`, pas `~/projets/livres`).
 */
export function shortFolderPath(path: string, context: PathContext): string | undefined {
  const target = clean(path)
  if (!target) return undefined
  const workspace = context.workspace ? clean(context.workspace) : undefined
  if (workspace && inside(target, workspace)) {
    return `${lastName(workspace)}${target.slice(workspace.length)}`
  }
  const home = context.home ? clean(context.home) : undefined
  if (home && inside(target, home)) return `~${target.slice(home.length)}`
  return undefined
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Le dossier personnel remplacé par `~` dans un texte libre (libellé d'une carte) : chaque mot qui
 * commence par lui, au début ou après un espace, un guillemet, `(`, `=` ou `:`, et qui s'arrête à
 * une barre, un espace, un guillemet ou la fin. `/Users/ada2` n'est pas touché pour `/Users/ada`.
 * Sans `home`, le texte reste tel quel.
 */
export function shortenHomeIn(text: string, home: string | undefined): string {
  const base = home ? clean(home) : undefined
  if (!base || base === '/') return text
  if (isDriveAbsolute(base)) {
    // Sans casse, `\` ou `/` entre les segments ; s'arrête à un séparateur, un espace, un guillemet.
    if (/^[a-z]:\\$/i.test(base)) return text
    const at = base.split('\\').map(escapeRegExp).join('[\\\\/]')
    const pattern = `(^|[\\s"'\`(=])${at}(?=[\\\\/]|[\\s"'\`)]|$)`
    return text.replace(new RegExp(pattern, 'gi'), '$1~')
  }
  const at = escapeRegExp(base)
  return text.replace(new RegExp(`(^|[\\s"'\`(=:])${at}(?=/|[\\s"'\`)]|$)`, 'g'), '$1~')
}

/** Dossier personnel de l'utilisateur : posé une fois au démarrage (main et renderer). */
let homeFolder: string | undefined

export function setHomeFolder(home: string | undefined): void {
  homeFolder = home && (home.startsWith('/') || isDriveAbsolute(home)) ? home : undefined
}

export const currentHomeFolder = (): string | undefined => homeFolder

/** Argument ajouté à la ligne de commande du renderer, lu par le preload (comme la langue, fiche 074). */
export const HOME_ARG = '--bobine-home='

export function homeArgument(home: string): string {
  return `${HOME_ARG}${home}`
}

/** Dossier personnel passé au renderer par le main ; vide si l'argument manque ou n'est pas absolu. */
export function homeFromArgv(argv: readonly string[]): string {
  const value = argv.find((arg) => arg.startsWith(HOME_ARG))?.slice(HOME_ARG.length)
  return value && (value.startsWith('/') || isDriveAbsolute(value)) ? value : ''
}
