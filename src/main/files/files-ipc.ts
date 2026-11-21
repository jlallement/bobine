/**
 * Canaux IPC de la vue des fichiers (fiche 271, ADR-0065). Le renderer désigne une conversation,
 * une racine (son rang) et un chemin relatif ; le main en déduit les dossiers, vérifie le chemin et
 * lit. Aucun canal n'écrit. Sortis d'`ipc.ts` pour tenir son plafond de lignes.
 */
import { stat } from 'node:fs/promises'
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { FileRoot } from '@shared/files'
import { exclusionsFor } from '../agent-config/exclusions'
import type { ConversationManager } from '../conversations/manager'
import { searchWorkspaceFiles } from '../workspace-files'
import { mayExecuteOn, shownName, type FileOpeners } from './file-links'
import { launchSystem } from '../process-launch'
import {
  fileRoots,
  gitIgnored,
  listDirectories,
  listDirectory,
  readFileForView,
  resolveInRoot
} from './file-tree'

type FilesChannels =
  | 'files:roots'
  | 'files:list'
  | 'files:listMany'
  | 'files:read'
  | 'files:search'
  | 'files:reveal'
  | 'files:open'

/** Résultats du filtre de l'onglet Fichiers. */
const SEARCH_LIMIT = 50

function str(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Paramètre invalide : ${name}`)
  return value
}

/** Version déjà affichée d'un fichier (`files:read`), vérifiée. */
function knownVersion(value: unknown): { modified: number; size: number } | undefined {
  if (value === undefined) return undefined
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const { modified, size } = v
  if (typeof modified !== 'number' || typeof size !== 'number') {
    throw new Error('Paramètre invalide : known')
  }
  return { modified, size }
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
  /** Exclusions de l'agent (fiche 155) : connues pour le dossier de la conversation seulement. */
  const exclusionsOf = (id: unknown, chosen: FileRoot) =>
    chosen.index === 0 ? exclusionsFor(c.profileOf(String(id))?.exclusions, chosen.path) : undefined
  return {
    'files:roots': async (id) => {
      const view = c.view(str(id, 'id'), true)
      // L'agent ne prend pas d'autres dossiers (fiche 179) : ils sont montrés « non transmis ».
      // Agent pas encore prêt (pas de réponse à `initialize`) : on ne sait pas, rien n'est marqué ;
      // l'onglet relit les racines quand la capacité arrive.
      const known = !!view.snapshot
      const notSent = !view.snapshot?.additionalDirectories
      return Promise.all(
        rootsOf(id).map(async (root) => {
          if (root.index > 0) return known ? { ...root, notSent } : root
          // Dossier de la conversation disparu ou démonté : dit, avec de quoi en choisir un (Q19).
          const info = await stat(root.path).catch(() => null)
          return info?.isDirectory() ? root : { ...root, missing: true as const }
        })
      )
    },
    'files:list': async (id, root, dir) => {
      const { root: chosen, paths } = rootOf(id, root)
      const exclusions = exclusionsOf(id, chosen)
      return listDirectory({
        root: chosen.path,
        dir: str(dir, 'dir'),
        roots: paths,
        ignored: gitIgnored,
        ...(exclusions
          ? { isExcluded: exclusions.isExcluded, exclusionFiles: exclusions.files }
          : {})
      })
    },
    'files:listMany': async (id, root, dirs) => {
      if (!Array.isArray(dirs) || dirs.length > 500 || !dirs.every((d) => typeof d === 'string')) {
        throw new Error('Paramètre invalide : dirs')
      }
      const { root: chosen, paths } = rootOf(id, root)
      const exclusions = exclusionsOf(id, chosen)
      return listDirectories({
        root: chosen.path,
        dirs,
        roots: paths,
        ignored: gitIgnored,
        ...(exclusions
          ? { isExcluded: exclusions.isExcluded, exclusionFiles: exclusions.files }
          : {})
      })
    },
    'files:read': async (id, root, path, known) => {
      const { root: chosen, paths } = rootOf(id, root)
      return readFileForView(chosen.path, str(path, 'path'), paths, knownVersion(known))
    },
    'files:search': async (id, root, query) => {
      if (typeof query !== 'string' || query.length > 200) throw new Error('Recherche invalide')
      const { root: chosen } = rootOf(id, root)
      const found = await searchWorkspaceFiles(chosen.path, query, SEARCH_LIMIT)
      // Exclus pour l'agent : montrés, marqués comme dans l'arbre (M6).
      const isExcluded = exclusionsOf(id, chosen)?.isExcluded
      return Promise.all(
        found.map(async (file) =>
          (await isExcluded?.(file.path))
            ? { path: shownName(file.relative), excluded: true as const }
            : // En NFC sous macOS, comme les chemins de l'arbre (3e revue, 3).
              { path: shownName(file.relative) }
        )
      )
    },
    'files:reveal': async (id, root, path) => {
      const { root: chosen, paths } = rootOf(id, root)
      openers.reveal(await resolveInRoot(chosen.path, str(path, 'path'), paths))
      return undefined
    },
    'files:open': async (id, root, path) => {
      const { root: chosen, paths } = rootOf(id, root)
      // Une seule résolution : le chemin réel vérifié dans les racines est celui qu'on ouvre ; un
      // lien vers un autre dossier de la conversation s'ouvre comme un fichier de ce dossier.
      const target = await resolveInRoot(chosen.path, str(path, 'path'), paths)
      const info = await stat(target).catch(() => null)
      if (!info) return { kind: 'missing', path: target }
      const reveal = (reason: 'folder' | 'executable') => {
        openers.reveal(target)
        return { kind: 'revealed' as const, path: target, reason }
      }
      if (info.isDirectory()) return reveal('folder')
      // FIFO, socket, périphérique : jamais confiés à une app (B1).
      if (!info.isFile()) throw new Error(t('files.error.notFile', { path: String(path) }))
      // Mêmes garde-fous que « Ouvrir » des Modifications : un exécutable n'est que montré.
      if (mayExecuteOn(target, info.mode, launchSystem())) return reveal('executable')
      const error = await openers.openPath(target)
      if (error) throw new Error(error)
      return { kind: 'opened', path: target }
    }
  }
}
