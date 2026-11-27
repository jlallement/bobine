/**
 * Canaux IPC des autres dossiers d'une conversation (fiche 179), branchés par `ipc.ts` comme ceux
 * de l'aparté. Les arguments viennent du renderer : vérifiés ici.
 */
import type { IpcHandlers } from '@shared/ipc'
import { log } from '../log'
import {
  addAdditionalDirectory,
  dialogLabels,
  removeAdditionalDirectory,
  type DirectoriesManager
} from './additional-directories'

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function folderHandlers(
  manager: DirectoriesManager,
  chooseDirectory: (options: {
    title: string
    buttonLabel: string
    defaultPath?: string
  }) => Promise<string | null>,
  /** Où ouvrir la fenêtre de choix (fiche 287) ; `undefined` : là où macOS veut. */
  startOf: (id: string) => string | undefined = () => undefined
): Pick<IpcHandlers, 'conversation:addFolder' | 'conversation:removeFolder'> {
  return {
    // Sans chemin : la fenêtre native ; avec : celui saisi ou glissé (fiche 290). Même
    // vérification dans les deux cas (`addAdditionalDirectory`).
    'conversation:addFolder': async (id, path) => {
      const conversation = str(id, 'id')
      if (path !== undefined && typeof path !== 'string')
        throw new Error('Paramètre invalide : path')
      let input = path
      if (input === undefined) {
        const start = startOf(conversation)
        const chosen = await chooseDirectory({
          ...dialogLabels(),
          ...(start ? { defaultPath: start } : {})
        })
        if (chosen === null) return null
        input = chosen
      }
      const result = await addAdditionalDirectory(manager, conversation, input)
      if (!result.ok) log.info('Autre dossier refusé :', result.reason, result.folder ?? '')
      return result
    },
    'conversation:removeFolder': async (id, folder) => {
      await removeAdditionalDirectory(manager, str(id, 'id'), str(folder, 'folder'))
      return undefined
    }
  }
}
