/**
 * Éditeurs de l'utilisateur (fiche 156) : Bobine n'a pas d'éditeur intégré, elle ouvre un fichier
 * cité dans celui de l'utilisateur, à la bonne ligne. Table commune au main (détection, lancement)
 * et au renderer (nom affiché, réglage).
 */

/** Comment l'éditeur reçoit le fichier et la ligne. */
export type EditorStyle =
  /** `<cmd> [dossier] --goto fichier:ligne` (VS Code, Cursor). */
  | 'goto'
  /** `<cmd> fichier:ligne` (Zed). */
  | 'path-line'
  /** `<lanceur> --line N fichier`, ou `open -na "<App>.app" --args --line N fichier` (JetBrains). */
  | 'jetbrains'

export interface EditorDefinition {
  id: string
  /** Nom affiché (« Ouvrir dans VS Code »). */
  name: string
  /** Apps cherchées dans `/Applications` et `~/Applications`, dans cet ordre. */
  apps: string[]
  /** Commande cherchée dans le `PATH`. */
  command: string
  /** Commande fournie dans l'app, relative à son paquet (`Contents/…`), si elle en a une. */
  bundledCommand?: string
  style: EditorStyle
}

export const EDITORS: readonly EditorDefinition[] = [
  {
    id: 'vscode',
    name: 'VS Code',
    apps: ['Visual Studio Code.app', 'Visual Studio Code - Insiders.app'],
    command: 'code',
    bundledCommand: 'Contents/Resources/app/bin/code',
    style: 'goto'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    apps: ['Cursor.app'],
    command: 'cursor',
    bundledCommand: 'Contents/Resources/app/bin/cursor',
    style: 'goto'
  },
  {
    id: 'zed',
    name: 'Zed',
    apps: ['Zed.app', 'Zed Preview.app'],
    command: 'zed',
    bundledCommand: 'Contents/MacOS/cli',
    style: 'path-line'
  },
  {
    id: 'idea',
    name: 'IntelliJ IDEA',
    apps: ['IntelliJ IDEA.app', 'IntelliJ IDEA Ultimate.app', 'IntelliJ IDEA CE.app'],
    command: 'idea',
    style: 'jetbrains'
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    apps: ['WebStorm.app'],
    command: 'webstorm',
    style: 'jetbrains'
  },
  {
    id: 'pycharm',
    name: 'PyCharm',
    apps: ['PyCharm.app', 'PyCharm Professional Edition.app', 'PyCharm CE.app'],
    command: 'pycharm',
    style: 'jetbrains'
  },
  { id: 'goland', name: 'GoLand', apps: ['GoLand.app'], command: 'goland', style: 'jetbrains' },
  {
    id: 'phpstorm',
    name: 'PhpStorm',
    apps: ['PhpStorm.app'],
    command: 'phpstorm',
    style: 'jetbrains'
  },
  {
    id: 'rubymine',
    name: 'RubyMine',
    apps: ['RubyMine.app'],
    command: 'rubymine',
    style: 'jetbrains'
  },
  { id: 'clion', name: 'CLion', apps: ['CLion.app'], command: 'clion', style: 'jetbrains' },
  {
    id: 'rustrover',
    name: 'RustRover',
    apps: ['RustRover.app'],
    command: 'rustrover',
    style: 'jetbrains'
  }
]

export type EditorId = string

/** Éditeur installé, tel que le renderer le voit. */
export interface EditorInfo {
  id: EditorId
  name: string
}

/** Identifiant d'un éditeur connu, sinon `undefined`. */
export function parseEditorId(value: unknown): EditorId | undefined {
  return typeof value === 'string' && EDITORS.some((e) => e.id === value) ? value : undefined
}

/**
 * Éditeur utilisé : celui du réglage s'il est installé, sinon le premier trouvé ; `undefined`
 * quand aucun n'est installé.
 */
export function chosenEditor(
  installed: readonly EditorInfo[],
  preference: EditorId | undefined
): EditorInfo | undefined {
  return installed.find((e) => e.id === preference) ?? installed[0]
}

/** Résultat de « Ouvrir dans l'éditeur ». */
export type EditorOpenOutcome =
  | { kind: 'opened'; path: string }
  | { kind: 'missing'; path: string }
  | { kind: 'outside'; path: string }
  | { kind: 'no-editor' }
