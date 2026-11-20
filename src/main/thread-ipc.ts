/**
 * Canaux IPC du fil (fiche 156) : éditeurs installés, « Ouvrir dans l'éditeur », glisser d'une
 * image vers le Finder. Le renderer désigne un fichier et un éditeur ; le main vérifie les deux.
 */
import type { IpcHandlers } from '@shared/ipc'
import { inside, real } from './files/file-links'
import { parseDraggedImage, type DraggedImage } from '@shared/images'
import { editorLaunch, openInEditor, type InstalledEditor, type RunEditor } from './editors/editors'

export interface ThreadIpcDeps {
  /** Éditeurs installés, détectés à chaque demande (une app peut s'installer entre-temps). */
  editors: () => InstalledEditor[]
  /** Lance l'éditeur, sans shell. */
  runEditor: RunEditor
  /** Glisser natif de l'image (fichier temporaire, `webContents.startDrag`). */
  dragImage: (image: DraggedImage) => Promise<void>
  /** Écrit une sortie d'outil dans un fichier temporaire de l'app ; rend son chemin (fiche 192). */
  writeOutput: (text: string) => Promise<string>
}

type ThreadChannels = 'editors:list' | 'editors:open' | 'editors:openText' | 'images:startDrag'

/* Les arguments IPC viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */
function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

function openOptions(value: unknown): { line?: number; base?: string; root?: number } {
  const o = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const line = o['line']
  const root = o['root']
  if (root !== undefined && (typeof root !== 'number' || !Number.isInteger(root) || root < 0)) {
    throw new Error('Paramètre invalide : root')
  }
  return {
    ...(typeof root === 'number' ? { root } : {}),
    ...(typeof line === 'number' && Number.isInteger(line) && line > 0 ? { line } : {}),
    ...(typeof o['base'] === 'string' && o['base'] ? { base: o['base'] } : {})
  }
}

/** L'autre dossier de la conversation qui contient `base` (chemins réels), s'il y en a un. */
async function folderHolding(base: string, directories: readonly string[]) {
  const target = await real(base)
  for (const dir of directories) if (inside(await real(dir), target)) return dir
  return undefined
}

/** Hors du dossier de la conversation, `base` ne compte pas : la ligne seule. */
const lineOnly = (o: { line?: number }) => (o.line ? { line: o.line } : {})

export function threadHandlers(
  deps: ThreadIpcDeps | undefined,
  workspaceOf: (id: string) => string,
  /** Autres dossiers de la conversation (fiche 179), dans l'ordre de leur rang à partir de 1. */
  directoriesOf: (id: string) => readonly string[] = () => []
): Pick<IpcHandlers, ThreadChannels> {
  return {
    'editors:list': () => (deps?.editors() ?? []).map(({ id, name }) => ({ id, name })),
    'editors:open': async (id, editorId, path, options) => {
      const conversation = str(id, 'id')
      const { root, ...rest } = openOptions(options)
      // Onglet Fichiers (C3) : un autre dossier de la conversation, désigné par son rang ; le
      // chemin y est relatif et vérifié comme dans le dossier de la conversation.
      const directories = directoriesOf(conversation)
      // Lien d'un document d'un autre dossier (C6) : le dossier de sa base, comme `openFileLink`.
      const ofBase = rest.base ? await folderHolding(rest.base, directories) : undefined
      const workspace = root ? directories[root - 1] : (ofBase ?? workspaceOf(conversation))
      if (!workspace) throw new Error('Paramètre invalide : root')
      const wanted = str(editorId, 'editorId')
      const editor = deps?.editors().find((e) => e.id === wanted)
      return openInEditor(
        { workspace, path: str(path, 'path'), ...(root ? lineOnly(rest) : rest) },
        editor,
        deps?.runEditor ?? (() => Promise.resolve())
      )
    },
    'editors:openText': async (id, editorId, text) => {
      // Le dossier de la conversation comme projet : jamais le dossier des sorties de l'app.
      const workspace = workspaceOf(str(id, 'id'))
      const wanted = str(editorId, 'editorId')
      if (typeof text !== 'string') throw new Error('Paramètre invalide : text')
      const editor = deps?.editors().find((e) => e.id === wanted)
      if (!deps || !editor) return { kind: 'no-editor' }
      const file = await deps.writeOutput(text)
      const { command, args } = editorLaunch(editor, file, undefined, workspace)
      await deps.runEditor(command, args)
      return { kind: 'opened', path: file }
    },
    'images:startDrag': async (image) => {
      await deps?.dragImage(parseDraggedImage(image))
      return undefined
    }
  }
}
