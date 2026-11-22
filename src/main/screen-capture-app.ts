/**
 * Capture d'écran branchée sur l'app (fiche 062, sortie d'`index.ts`) : outil de macOS ou capture
 * simulée, décodage par `nativeImage`, autorisation lue par `systemPreferences`, et fenêtres
 * effacées pendant la sélection puis remontrées.
 */
import { BrowserWindow, nativeImage, systemPreferences, webContents } from 'electron'
import type { ScreenCaptureResult } from '@shared/attachments'
import type { QuickEntry } from './quick-entry'
import { captureScreen, screenAccessOf } from './screen-capture'
import { runCommand } from './simulator/run'

export function appCaptureScreen(
  quickEntry: Pick<QuickEntry, 'setCapturing'>,
  mainWindow: () => BrowserWindow | undefined,
  showInactive: boolean
): () => Promise<ScreenCaptureResult> {
  return () =>
    captureScreen({
      run: runCommand,
      // BOBINE_SCREENCAPTURE : capture simulée (essais de bout en bout).
      command: process.env['BOBINE_SCREENCAPTURE'] || 'screencapture',
      decode: (data) => nativeImage.createFromBuffer(data),
      access: () => screenAccessOf(process.env, systemPreferences),
      // La fenêtre qui demande (et la fenêtre rapide) s'efface pendant la sélection.
      hideWindows: () => {
        // Fenêtre qui a le focus natif : `getFocusedWindow` passe par `isFocused`, que les
        // essais forcent à vrai sur la fenêtre principale (fiche 119) ; on lit le focus réel.
        const focusedContents = webContents.getFocusedWebContents()
        const focused = focusedContents ? BrowserWindow.fromWebContents(focusedContents) : null
        const hidden = BrowserWindow.getAllWindows().filter(
          (w) => w.isVisible() && (w === focused || w !== mainWindow())
        )
        quickEntry.setCapturing(true)
        for (const w of hidden) w.hide()
        return () => {
          // Essais (`BOBINE_SHOW_INACTIVE`, fiche 106) : remontrées sans prendre le focus de
          // la machine. Avec `show()` et `focus()`, l'app d'essai passait au premier plan
          // après chaque capture, et une frappe de l'utilisateur à côté tombait dans la
          // fenêtre rapide (« plus tards » dans la suite `quick`).
          for (const w of hidden) {
            if (!w.isDestroyed()) {
              if (showInactive) w.showInactive()
              else w.show()
            }
          }
          if (focused && !focused.isDestroyed() && !showInactive) focused.focus()
          quickEntry.setCapturing(false)
        }
      }
    })
}
