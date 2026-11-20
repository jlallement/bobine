/**
 * Canaux IPC de la vue des fichiers (fiche 271, ADR-0065). Le renderer désigne une conversation,
 * une racine (son rang) et un chemin relatif ; le main en déduit les dossiers, vérifie le chemin et
 * lit. Aucun canal n'écrit. Sortis d'`ipc.ts` pour tenir son plafond de lignes.
 */
import type { IpcHandlers } from '@shared/ipc'
import type { FileRoot } from '@shared/files'
import { exclusionsFor } from '../agent-config/exclusions'
import type { ConversationManager } from '../conversations/manager'
import { searchWorkspaceFiles } from '../workspace-files'
import { openWorkspaceFile, type FileOpeners } from './file-links'
import { fileRoots, gitIgnored, listDirectory, readFileForView, resolveInRoot } from './file-tree'

type FilesChannels =
  'files:roots' | 'files:list' | 'files:read' | 'files:search' | 'files:reveal' | 'files:open'

/** Résultats du filtre de l'onglet Fichiers. */
const SEARCH_LIMIT = 50

function str(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Paramètre invalide : ${name}`)
  return value
}

function index(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('Paramètre invalide : root')
  }
  return value
}

export function filesHandlers(
  c: Pick<ConversationManager, 'workspaceOf' | 'view' | 'profileOf'>,
  openers: Pick<FileOpeners, 'openPath' | 'reveal'>
): Pick<IpcHandlers, FilesChannels> {
  /** Racines de la conversation : son dossier (ou worktree), puis ses autres dossiers. */
  const rootsOf = (id: unknown): FileRoot[] => {
    const conversation = str(id, 'id')
    const workspace = c.workspaceOf(conversation)
    return fileRoots(workspace, c.view(conversation, true).summary.additionalDirectories ?? [])
  }
  const rootOf = (id: unknown, root: unknown) => {
    const roots = rootsOf(id)
    const chosen = roots[index(root)]
    if (!chosen) throw new Error('Paramètre invalide : root')
    return { root: chosen, paths: roots.map((r) => r.path) }
  }
  return {
    'files:roots': async (id) => rootsOf(id),
    'files:list': async (id, root, dir) => {
      const { root: chosen, paths } = rootOf(id, root)
      // Exclusions de l'agent (fiche 155) : connues pour le dossier de la conversation seulement.
      const exclusions =
        chosen.index === 0
          ? exclusionsFor(c.profileOf(String(id))?.exclusions, chosen.path)
          : undefined
      return listDirectory({
        root: chosen.path,
        dir: str(dir, 'dir'),
        roots: paths,
        ignored: gitIgnored,
        ...(exclusions ? { isExcluded: exclusions.isExcluded } : {})
      })
    },
    'files:read': async (id, root, path) => {
      const { root: chosen, paths } = rootOf(id, root)
      return readFileForView(chosen.path, str(path, 'path'), paths)
    },
    'files:search': async (id, root, query) => {
      if (typeof query !== 'string' || query.length > 200) throw new Error('Recherche invalide')
      const { root: chosen } = rootOf(id, root)
      const found = await searchWorkspaceFiles(chosen.path, query, SEARCH_LIMIT)
      return found.map((file) => file.relative)
    },
    'files:reveal': async (id, root, path) => {
      const { root: chosen, paths } = rootOf(id, root)
      openers.reveal(await resolveInRoot(chosen.path, str(path, 'path'), paths))
      return undefined
    },
    'files:open': async (id, root, path) => {
      const { root: chosen, paths } = rootOf(id, root)
      await resolveInRoot(chosen.path, str(path, 'path'), paths)
      // Mêmes garde-fous que « Ouvrir » des Modifications : un exécutable n'est que montré.
      return openWorkspaceFile(chosen.path, str(path, 'path'), openers)
    }
  }
}
