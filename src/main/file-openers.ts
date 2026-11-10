import { appendFileSync } from 'node:fs'
import { shell } from 'electron'

/**
 * Ouvrir un fichier ou le montrer dans le Finder (fiches 021, 052). En essai, `BOBINE_OPEN_LOG` note
 * ces demandes dans un fichier au lieu d'ouvrir une vraie app sur l'écran de l'utilisateur.
 */
export function fileOpeners(): {
  openPath: (path: string) => Promise<string>
  reveal: (path: string) => void
  openExternal: (url: string) => Promise<void>
} {
  const logTo = process.env['BOBINE_OPEN_LOG']
  if (logTo) {
    return {
      openPath: async (path) => {
        appendFileSync(logTo, `open ${path}\n`)
        return ''
      },
      reveal: (path) => appendFileSync(logTo, `reveal ${path}\n`),
      openExternal: async (url) => appendFileSync(logTo, `external ${url}\n`)
    }
  }
  return {
    openPath: (path) => shell.openPath(path),
    reveal: (path) => shell.showItemInFolder(path),
    openExternal: (url) => shell.openExternal(url)
  }
}
