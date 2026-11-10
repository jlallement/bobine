/**
 * Canaux IPC des autres dossiers d'une conversation (fiche 179), branchés par `ipc.ts` comme ceux
 * de l'aparté. Les arguments viennent du renderer : vérifiés ici.
 */
import type { IpcHandlers } from '@shared/ipc'
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
  chooseDirectory: (labels: { title: string; buttonLabel: string }) => Promise<string | null>
): Pick<IpcHandlers, 'conversation:addFolder' | 'conversation:removeFolder'> {
  return {
    'conversation:addFolder': async (id) => {
      const conversation = str(id, 'id')
      const folder = await chooseDirectory(dialogLabels())
      if (folder) await addAdditionalDirectory(manager, conversation, folder)
      return folder
    },
    'conversation:removeFolder': async (id, folder) => {
      await removeAdditionalDirectory(manager, str(id, 'id'), str(folder, 'folder'))
      return undefined
    }
  }
}
