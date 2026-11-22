/**
 * Avis de nouvelle version branché sur l'app (fiche 274, sorti d'`index.ts`) : `net.fetch`
 * d'Electron, réglage et lecture seule du profil, page ouverte dans le navigateur du Mac, état
 * renvoyé aux fenêtres ; vérification automatique quelques secondes après le lancement.
 */
import { app, net, shell } from 'electron'
import type { SendEvent } from './ipc'
import { log } from './log'
import type { SettingsStore } from './settings-store'
import type { UpdateChecker } from './update-check'
import { setupUpdateCheck, UPDATE_LAUNCH_DELAY_MS } from './update-check-electron'

export function startUpdateCheck(deps: {
  userData: string
  settings: Pick<SettingsStore, 'onChange' | 'preferences'>
  readOnly: () => boolean
  send: SendEvent
}): UpdateChecker {
  const updates = setupUpdateCheck({
    userData: deps.userData,
    version: app.getVersion(),
    packaged: app.isPackaged,
    env: process.env,
    fetch: (url, init) => net.fetch(url, init),
    enabled: () => deps.settings.preferences().updateCheck,
    readOnly: deps.readOnly,
    openExternal: (url) => void shell.openExternal(url),
    log: (message) => log.info(message),
    changed: (view) => deps.send('app:update', view)
  })
  deps.settings.onChange(updates.settingsChanged)
  setTimeout(() => void updates.checkOnLaunch().catch(() => {}), UPDATE_LAUNCH_DELAY_MS).unref()
  return updates
}
