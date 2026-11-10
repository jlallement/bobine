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
 */

/** Ce qui sert à raccourcir : le dossier de la conversation et le dossier personnel de l'utilisateur. */
export interface PathContext {
  workspace?: string | undefined
  home?: string | undefined
}

/** Chemin absolu normalisé (sans barres en trop ni `.`), ou `undefined` au moindre doute. */
function clean(path: string): string | undefined {
  if (!path.startsWith('/') || /\$/.test(path)) return undefined
  const parts = path.split('/').filter((part) => part !== '' && part !== '.')
  if (parts.includes('..')) return undefined
  return `/${parts.join('/')}`
}

/** `path` est `base` ou dedans (déjà normalisés) ; `base` jamais la racine. */
const inside = (path: string, base: string) =>
  base !== '/' && (path === base || path.startsWith(`${base}/`))

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
    const name = workspace.slice(workspace.lastIndexOf('/') + 1)
    return `${name}${target.slice(workspace.length)}`
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
  const at = escapeRegExp(base)
  return text.replace(new RegExp(`(^|[\\s"'\`(=:])${at}(?=/|[\\s"'\`)]|$)`, 'g'), '$1~')
}

/** Dossier personnel de l'utilisateur : posé une fois au démarrage (main et renderer). */
let homeFolder: string | undefined

export function setHomeFolder(home: string | undefined): void {
  homeFolder = home && home.startsWith('/') ? home : undefined
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
  return value?.startsWith('/') ? value : ''
}
