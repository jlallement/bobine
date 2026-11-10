/**
 * « Plein écran » du menu Affichage (fiche 126). Un article au rôle `togglefullscreen` d'Electron
 * fait ajouter à macOS le sien (🌐F) juste à côté : deux « Plein écran », aucun ne disant
 * « Quitter ». L'article de l'app n'a donc pas de rôle : il bascule la fenêtre lui-même, et le menu
 * est reconstruit à chaque entrée et sortie du plein écran pour changer de libellé.
 */
import { app, BrowserWindow } from 'electron'

export function followFullScreen(refreshMenu: () => void): void {
  const watch = (win: BrowserWindow) => {
    win.on('enter-full-screen', refreshMenu)
    win.on('leave-full-screen', refreshMenu)
  }
  BrowserWindow.getAllWindows().forEach(watch)
  app.on('browser-window-created', (_event, win) => watch(win))
}
