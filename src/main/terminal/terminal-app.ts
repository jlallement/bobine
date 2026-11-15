/**
 * Terminal du système, ouvert dans un dossier (sorti d'`index.ts`, au plafond : fiche 138).
 * macOS : Terminal.app, comme avant. Windows (fiche 229) : Windows Terminal (`wt.exe`) s'il est là,
 * sinon une console PowerShell. Le terminal appartient à l'utilisateur : il survit à l'app.
 */
import { execFile, spawn } from 'node:child_process'
import {
  findProgram,
  launchContext,
  windowsPowerShell,
  type LaunchContext
} from '../process-launch'
import { encodedPowerShell, psLiteral } from '../reset-windows'

/** Programme et arguments qui ouvrent un terminal dans `path` ; `detached` : un lanceur graphique. */
export interface TerminalLaunch {
  command: string
  args: string[]
  detached: boolean
}

/**
 * Windows : `wt.exe -d <dossier>` (un lanceur : il confie la fenêtre au processus de Windows
 * Terminal et rend la main), sinon une console PowerShell créée par `Start-Process`. Vu dans la VM :
 * un PowerShell lancé `detached` n'a pas de console et sort aussitôt, même avec `-NoExit` ; un
 * enfant attaché mourrait avec Bobine. `Start-Process` lui donne sa propre console, hors de l'objet
 * de tâche de libuv ; le PowerShell caché qui l'appelle sort tout de suite.
 */
export function windowsTerminalLaunch(path: string, ctx: LaunchContext): TerminalLaunch {
  const wt = findProgram('wt', ctx)
  if (wt) return { command: wt, args: ['-d', path], detached: true }
  const powershell = windowsPowerShell(ctx.env)
  const start = `Start-Process -FilePath ${psLiteral(powershell)} -WorkingDirectory ${psLiteral(path)} -ArgumentList '-NoLogo','-NoExit'`
  return { command: powershell, args: encodedPowerShell(start), detached: false }
}

/** Ouvre le terminal du système dans un dossier (« lancer bob une fois », approuver le dossier). */
export function openTerminal(path: string, ctx: LaunchContext = launchContext()): Promise<void> {
  if (ctx.system === 'windows') {
    const { command, args, detached } = windowsTerminalLaunch(path, ctx)
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        detached,
        stdio: 'ignore',
        env: ctx.env,
        ...(detached ? {} : { windowsHide: true })
      })
      child.once('error', reject)
      if (detached) {
        child.once('spawn', () => {
          child.unref()
          resolve()
        })
      } else {
        child.once('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`powershell Start-Process: ${code}`))
        )
      }
    })
  }
  return new Promise((resolve, reject) => {
    execFile('open', ['-a', 'Terminal', path], (error) => (error ? reject(error) : resolve()))
  })
}
