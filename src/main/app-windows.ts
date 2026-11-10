/**
 * Fenêtres de l'app (principale, rapide), par opposition aux popups des sites (fiche 072) : elles
 * seules reçoivent les évènements, et seul leur cadre principal peut appeler l'IPC (fiche 114).
 */
import { BrowserWindow } from 'electron'
import type { IpcEventChannel, IpcEventContract } from '@shared/ipc'
import type { IpcSenderEvent } from './ipc'

const appWindows = new WeakSet<BrowserWindow>()

/** À appeler pour chaque fenêtre du renderer, jamais pour une popup d'un site. */
export function registerAppWindow(win: BrowserWindow): void {
  appWindows.add(win)
}

/** Fenêtres de l'app encore vivantes. */
function* liveAppWindows(): Generator<BrowserWindow> {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!appWindows.has(win) || win.isDestroyed() || win.webContents.isDestroyed()) continue
    yield win
  }
}

/** Évènement envoyé à toutes les fenêtres de l'app. */
export function broadcast<C extends IpcEventChannel>(
  channel: C,
  payload: IpcEventContract[C]
): void {
  for (const win of liveAppWindows()) win.webContents.send(channel, payload)
}

/** Appel IPC digne de confiance : émis par le cadre principal d'une fenêtre de l'app (fiche 114). */
export function trustedSender(event: IpcSenderEvent): boolean {
  for (const win of liveAppWindows()) {
    if (event.sender === win.webContents) return event.senderFrame === win.webContents.mainFrame
  }
  return false
}
