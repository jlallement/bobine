/**
 * « Plein écran » du menu Affichage (fiche 126). Un article au rôle `togglefullscreen` d'Electron
 * fait ajouter à macOS le sien (🌐F) juste à côté : deux « Plein écran », aucun ne disant
 * « Quitter ». L'article de l'app n'a donc pas de rôle : il bascule la fenêtre lui-même, et le menu
 * est reconstruit à chaque entrée et sortie du plein écran pour changer de libellé.
 */
import { app, BrowserWindow } from 'electron'

/**
 * macOS ajoute aussi « Enter Full Screen » au menu Fenêtre de toute app aux fenêtres
 * plein-écran-ables, dans la langue d'AppKit, même sans rôle `togglefullscreen` (recette du
 * 2026-11-20, fiche 272 : « Plein écran » et « Enter Full Screen » côte à côte). La préférence
 * `NSFullScreenMenuItemEverywhere` de l'app le retire : seul reste l'article de l'app, traduit.
 * macOS seulement (la préférence n'existe pas ailleurs), avant la création du menu.
 */
export function hideSystemFullScreenItem(
  platform: NodeJS.Platform,
  prefs: {
    setUserDefault: (key: 'NSFullScreenMenuItemEverywhere', type: 'boolean', value: boolean) => void
  }
): void {
  if (platform !== 'darwin') return
  prefs.setUserDefault('NSFullScreenMenuItemEverywhere', 'boolean', false)
}

export function followFullScreen(refreshMenu: () => void): void {
  const watch = (win: BrowserWindow) => {
    win.on('enter-full-screen', refreshMenu)
    win.on('leave-full-screen', refreshMenu)
  }
  BrowserWindow.getAllWindows().forEach(watch)
  app.on('browser-window-created', (_event, win) => watch(win))
}
