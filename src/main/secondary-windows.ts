/**
 * Fenêtres secondaires de l'app, sorties d'`index.ts` : À propos (fiche 116), attachée à la
 * fenêtre principale ; aide (fiche 186), posée à côté d'elle sur son écran, la page à ouvrir
 * passant par `help:navigate` une fois chargée.
 */
import { screen, type BrowserWindow } from 'electron'
import type { PlatformFeatures } from '@shared/platform'
import type { AppIpcDeps } from './app-ipc'
import { broadcast } from './app-windows'
import { HelpWindow, helpBounds } from './help-window'
import { AboutWindow } from './about-window'
import { createAboutWindow, createHelpWindow, type ModePreferences } from './renderer-windows'

export function appAboutWindow(
  mainWindow: () => BrowserWindow | undefined,
  settings: { preferences: () => ModePreferences },
  features: PlatformFeatures,
  inactive: boolean
): AboutWindow {
  return new AboutWindow({
    create: (parent) => createAboutWindow(parent, settings.preferences(), features),
    parent: mainWindow,
    inactive
  })
}

export function appHelpWindow(
  mainWindow: () => BrowserWindow | undefined,
  settings: { preferences: () => ModePreferences },
  features: PlatformFeatures,
  inactive: boolean
): HelpWindow {
  return new HelpWindow({
    create: () => {
      const win = mainWindow()
      const main = win && !win.isDestroyed() ? win.getBounds() : undefined
      const display = main ? screen.getDisplayMatching(main) : screen.getPrimaryDisplay()
      return createHelpWindow(helpBounds(main, display.workArea), settings.preferences(), features)
    },
    // À la seule fenêtre d'aide, pas à toutes les fenêtres de l'app.
    navigate: (win, target) => win.webContents.send('help:navigate', target),
    focusSearch: (win) => win.webContents.send('help:focusSearch', null),
    inactive
  })
}

/** Canaux `help:*` : ouvrir, première page, « Nouveautés » dans la fenêtre principale. */
export function helpIpc(help: HelpWindow, focusMainWindow: () => void): AppIpcDeps['help'] {
  return {
    open: (topic) => help.show(topic),
    target: () => help.initialTarget(),
    showChangelog: () => {
      focusMainWindow()
      broadcast('app:showChangelog', null)
    }
  }
}
