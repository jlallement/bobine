import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { createApi, helpViewApi, type Invoke, type Subscribe } from './api'
import { viewFromArgv } from '@shared/window-view'
import { languageFromArgv } from '@shared/i18n/language'
import { featuresFromArgv } from '@shared/platform'
import { homeFromArgv } from '@shared/path-display'

const invoke: Invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

const subscribe: Subscribe = (channel, listener) => {
  // On ne transmet jamais l'objet `event` d'Electron au renderer.
  const handler = (_event: IpcRendererEvent, payload: Parameters<typeof listener>[0]) =>
    listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = createApi(
  invoke,
  subscribe,
  (file) => webUtils.getPathForFile(file),
  // Langue de l'interface : ajoutée par le main à la ligne de commande du renderer (fiche 074).
  languageFromArgv(process.argv),
  // Capacités de la plateforme (fiche 145), passées de la même façon.
  featuresFromArgv(process.argv),
  // Dossier personnel (fiche 214), passé de la même façon.
  homeFromArgv(process.argv)
)

// Fenêtre d'aide (fiche 186) : seulement ce dont elle a besoin.
contextBridge.exposeInMainWorld(
  'api',
  viewFromArgv(process.argv) === 'help' ? helpViewApi(api) : api
)
