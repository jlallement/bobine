/**
 * Ce dont les canaux du fil ont besoin, avec Electron (fiche 156) : détection des éditeurs sur le
 * disque et dans le `PATH`, lancement sans shell, glisser natif. En essai, `BOBINE_EDITORS`
 * remplace la détection (« vscode,idea ») et `BOBINE_OPEN_LOG` note le lancement au lieu d'ouvrir
 * une vraie app sur l'écran de l'utilisateur.
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, app, nativeImage } from 'electron'
import { EDITORS } from '@shared/editors'
import { findExecutable } from './agent/profiles'
import { detectEditors, type InstalledEditor, type RunEditor } from './editors/editors'
import { cleanDraggedImages, writeDraggedImage } from './images/image-drag'
import { cleanOutputFiles, toolOutputsDir, writeOutputFile } from './editors/output-file'
import { log } from './log'
import type { ThreadIpcDeps } from './thread-ipc'

/** Éditeurs imposés en essai : leur commande est leur nom, jamais lancée (journal d'ouvertures). */
function imposedEditors(list: string): InstalledEditor[] {
  const ids = list.split(',').map((id) => id.trim())
  return EDITORS.filter((e) => ids.includes(e.id)).map((e) => ({
    id: e.id,
    name: e.name,
    style: e.style,
    launcher: { kind: 'command', command: e.command }
  }))
}

const runDetached: RunEditor = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', shell: false })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })

/** Glisser natif depuis la fenêtre active, avec une vignette de l'image (sinon son icône). */
async function dragFile(file: string): Promise<void> {
  const contents = BrowserWindow.getFocusedWindow()?.webContents
  if (!contents) return
  let icon = nativeImage.createFromPath(file)
  icon = icon.isEmpty() ? await app.getFileIcon(file) : icon.resize({ width: 64 })
  contents.startDrag({ file, icon })
}

/** Dossier des images glissées vers le Finder. */
const DRAGGED_IMAGES = join(tmpdir(), 'bobine-images')

export function threadIpcDeps(env: NodeJS.ProcessEnv = process.env): ThreadIpcDeps {
  const imposed = env['BOBINE_EDITORS']
  const logTo = env['BOBINE_OPEN_LOG']
  // Sorties d'outils ouvertes dans l'éditeur (fiche 192) : dossier temporaire du système, un par
  // profil, hors du profil (fiche 196), vidé au démarrage et à la fermeture.
  const outputs = toolOutputsDir(app.getPath('temp'), app.getPath('userData'))
  cleanOutputFiles(outputs)
  app.once('will-quit', () => cleanOutputFiles(outputs))
  // Au démarrage : les images glissées il y a plus d'un jour ne servent plus.
  void cleanDraggedImages(DRAGGED_IMAGES).catch((error: unknown) =>
    log.warn('Images glissées non nettoyées :', error)
  )
  return {
    editors: () =>
      imposed !== undefined
        ? imposedEditors(imposed)
        : detectEditors({
            home: homedir(),
            exists: existsSync,
            onPath: (command) => findExecutable(command, process.env['PATH'])
          }),
    runEditor: logTo
      ? async (command, args) => appendFileSync(logTo, `editor ${[command, ...args].join(' ')}\n`)
      : runDetached,
    writeOutput: (text) => writeOutputFile(outputs, text),
    dragImage: async (image) => {
      const file = await writeDraggedImage(image, DRAGGED_IMAGES)
      if (logTo) appendFileSync(logTo, `drag ${file}\n`)
      else await dragFile(file)
    }
  }
}
