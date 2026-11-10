/**
 * Ouvrir un fichier du fil dans l'éditeur de l'utilisateur (fiche 156). Détection des éditeurs
 * installés et commande de lancement : des fonctions pures, le disque et le `PATH` injectés.
 * Le lancement se fait sans shell (une commande, une liste d'arguments), et seulement pour un
 * fichier du dossier de la conversation (chemin réel, comme la fiche 114).
 */
import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  EDITORS,
  type EditorDefinition,
  type EditorInfo,
  type EditorOpenOutcome
} from '@shared/editors'
import { inside, real } from '../files/file-links'

/** Comment lancer un éditeur trouvé : sa commande, ou son app par `open` (JetBrains sans lanceur). */
export type EditorLauncher = { kind: 'command'; command: string } | { kind: 'app'; app: string }

export interface InstalledEditor extends EditorInfo {
  style: EditorDefinition['style']
  launcher: EditorLauncher
}

/** Ce que la détection regarde (injecté : testable sans le disque). */
export interface EditorProbe {
  /** Dossier personnel (`~/Applications`). */
  home: string
  /** Le chemin existe-t-il ? */
  exists: (path: string) => boolean
  /** Chemin d'une commande dans le `PATH`, sinon `undefined`. */
  onPath: (command: string) => string | undefined
}

/** Éditeurs installés, dans l'ordre de la table : une app trouvée ou une commande dans le `PATH`. */
export function detectEditors(probe: EditorProbe): InstalledEditor[] {
  return EDITORS.flatMap((editor) => {
    const app = editor.apps
      .flatMap((name) => [join('/Applications', name), join(probe.home, 'Applications', name)])
      .find((path) => probe.exists(path))
    const bundled = app && editor.bundledCommand ? join(app, editor.bundledCommand) : undefined
    const command = bundled && probe.exists(bundled) ? bundled : probe.onPath(editor.command)
    const launcher: EditorLauncher | undefined = command
      ? { kind: 'command', command }
      : app && editor.style === 'jetbrains'
        ? { kind: 'app', app }
        : undefined
    return launcher ? [{ id: editor.id, name: editor.name, style: editor.style, launcher }] : []
  })
}

/** Commande et arguments qui ouvrent `file` (absolu) à `line` ; `workspace` : le projet. */
export function editorLaunch(
  editor: Pick<InstalledEditor, 'style' | 'launcher'>,
  file: string,
  line: number | undefined,
  workspace: string
): { command: string; args: string[] } {
  const at = line ? `${file}:${line}` : file
  const lineArgs = line ? ['--line', String(line)] : []
  const { launcher } = editor
  if (launcher.kind === 'app') {
    return { command: '/usr/bin/open', args: ['-na', launcher.app, '--args', ...lineArgs, file] }
  }
  switch (editor.style) {
    case 'goto':
      // Le dossier d'abord : la fenêtre du projet, pas la dernière ouverte.
      return { command: launcher.command, args: [workspace, '--goto', at] }
    case 'path-line':
      return { command: launcher.command, args: [at] }
    case 'jetbrains':
      return { command: launcher.command, args: [...lineArgs, file] }
  }
}

/** Ouvrir le dossier lui-même (worktree d'une fille, fiche 161) : sa fenêtre de projet. */
export function editorFolderLaunch(
  editor: Pick<InstalledEditor, 'launcher'>,
  folder: string
): { command: string; args: string[] } {
  const { launcher } = editor
  if (launcher.kind === 'app') {
    return { command: '/usr/bin/open', args: ['-na', launcher.app, '--args', folder] }
  }
  return { command: launcher.command, args: [folder] }
}

/** Lance une commande sans shell ; rejette si elle ne démarre pas. */
export type RunEditor = (command: string, args: string[]) => Promise<void>

/**
 * Ouvre `path` (relatif à `base`, un dossier du dossier de travail, ou au dossier de travail) dans
 * `editor`, à `line` ; `.` ouvre le dossier de travail lui-même. Un fichier absent ou hors du dossier (chemin réel) n'est pas ouvert.
 */
export async function openInEditor(
  request: { workspace: string; path: string; line?: number; base?: string },
  editor: InstalledEditor | undefined,
  run: RunEditor
): Promise<EditorOpenOutcome> {
  if (!editor) return { kind: 'no-editor' }
  const root = await real(request.workspace)
  const base = request.base ? await real(request.base) : root
  const target = resolve(inside(root, base) ? base : root, request.path)
  // Hors du dossier d'abord, sans toucher au disque : rien ne dit si un fichier existe au-dehors.
  // Le dossier tel que la conversation le nomme compte aussi (`/var/…` pour `/private/var/…`).
  if (!inside(root, target) && !inside(resolve(request.workspace), target)) {
    return { kind: 'outside', path: target }
  }
  const info = await stat(target).catch(() => null)
  // Le dossier de travail lui-même (`.`) : sa fenêtre de projet (fiche 161).
  if (info?.isDirectory() && (await real(target)) === root) {
    const { command, args } = editorFolderLaunch(editor, root)
    await run(command, args)
    return { kind: 'opened', path: root }
  }
  if (!info?.isFile()) return { kind: 'missing', path: target }
  // Chemin réel ensuite : un lien symbolique du dossier ne mène pas au-dehors en douce.
  const file = await real(target)
  if (!inside(root, file)) return { kind: 'outside', path: target }
  const { command, args } = editorLaunch(editor, file, request.line, root)
  await run(command, args)
  return { kind: 'opened', path: file }
}
