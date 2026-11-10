/**
 * Premier plan des fenêtres pour le suivi des PR (fiche 176) : sans fenêtre de l'app au premier
 * plan, la relève s'espace puis se met en veille ; elle reprend au retour.
 */
import { app, BrowserWindow } from 'electron'
import type { PrWatcher } from './pr-watch'

export function watchFocus(watcher: Pick<PrWatcher, 'setFocused'>): void {
  const update = () => watcher.setFocused(BrowserWindow.getFocusedWindow() !== null)
  app.on('browser-window-focus', update)
  // Passage d'une fenêtre de l'app à une autre : la perte du focus arrive avant le gain.
  app.on('browser-window-blur', () => setTimeout(update, 0))
}
