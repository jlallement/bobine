/** Terminal.app de macOS, ouvert dans un dossier (sorti d'`index.ts`, au plafond : fiche 138). */
import { execFile } from 'node:child_process'

/** Ouvre Terminal.app dans un dossier (pour « lancer bob une fois » et approuver le dossier). */
export function openTerminal(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('open', ['-a', 'Terminal', path], (error) => (error ? reject(error) : resolve()))
  })
}
