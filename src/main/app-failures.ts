/**
 * Pannes de l'app elle-même (fiche 194, sorti d'`index.ts`) : rapports de plantage locaux (sans
 * aucun envoi), erreurs non rattrapées du main dites à l'utilisateur, interface qui plante en
 * boucle. Les avis passent par `AppAlerts` ; la décision est dans `app-alerts.ts` (testée).
 */
import { app, crashReporter, dialog, shell, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { t } from 'i18next'
import {
  AppAlerts,
  askAfterCrashes,
  leaveAfterCrashes,
  RendererCrashes,
  type CrashChoice
} from './app-alerts'
import { broadcast } from './app-windows'
import type { AppAlertKind } from '@shared/app-alerts'
import { endRunMark, startRunMark } from './crash-marker'
import { disableConsole, isBrokenPipe, log, logFile } from './log'
import { settleStoppedGroups, stoppingGroups } from './process-group'
import { waitForStoppedProcesses, type QuitFlow } from './quit-guard'

/** Sortie de l'app (fiche 089), posée par `start()` : le dialogue des plantages passe par elle. */
let quitFlow: Pick<QuitFlow, 'confirm' | 'relaunchAfterQuit'> | undefined
export function useQuitFlow(flow: Pick<QuitFlow, 'confirm' | 'relaunchAfterQuit'>): void {
  quitFlow = flow
}

/** Avis de l'app de ce lancement (erreur interne, plantage précédent). */
export const appAlerts = new AppAlerts((alerts) => broadcast('app:alerts', alerts))

/** Ce que l'IPC en expose : la liste, ✕, et « Afficher le rapport » (sélectionné dans le Finder). */
export const alertsIpc = {
  list: () => appAlerts.list(),
  dismiss: (kind: AppAlertKind) => appAlerts.dismiss(kind),
  showReport: () => {
    const report = appAlerts.report
    if (report) shell.showItemInFolder(report)
  }
}

/**
 * Au démarrage, avant tout le reste : minidumps de `crashReporter` gardés dans le profil, jamais
 * envoyés (`uploadToServer: false`) ; marque « en cours », et rapport du lancement précédent s'il
 * s'est arrêté sans quitter. La marque part en quittant.
 */
export function setupCrashReports(userData: string): void {
  const dumpsDir = join(userData, 'crash-dumps')
  app.setPath('crashDumps', dumpsDir)
  crashReporter.start({ uploadToServer: false, compress: true })
  const report = startRunMark(userData, {
    version: app.getVersion(),
    electron: process.versions.electron,
    os: process.getSystemVersion(),
    dumpsDir,
    ...(logFile() ? { logFile: logFile() } : {})
  })
  if (report) appAlerts.crashed(report)
  app.on('quit', () => endRunMark(userData))
}

/**
 * Erreurs non rattrapées du main : écrites au journal, et un avis (un seul par lancement) au lieu
 * de la fenêtre d'erreur d'Electron ; l'app continue (une conversation en échec ne doit pas
 * emporter les autres). Sortie standard fermée (app lancée par un processus qui s'est arrêté) : on
 * cesse d'y écrire, sans erreur.
 */
export function watchMainErrors(): void {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (error) => {
      if (isBrokenPipe(error)) disableConsole()
    })
  }
  process.on('uncaughtException', (error) => {
    if (isBrokenPipe(error)) return disableConsole()
    log.error('Exception non rattrapée :', error)
    appAlerts.internalError(error)
  })
  process.on('unhandledRejection', (reason) => {
    log.error('Promesse rejetée non gérée :', reason)
    appAlerts.internalError(reason)
  })
}

/**
 * Interface plantée (mémoire, bug de Chromium) : rechargée, au plus trois fois par minute. Au-delà,
 * un dialogue natif (il ne dépend pas de l'interface qui plante) : « Relancer Bobine » repart de
 * l'accueil, « Quitter » (Échap) ne fait rien perdre.
 */
export function watchRendererCrashes(win: BrowserWindow, showLog: () => void): void {
  const crashes = new RendererCrashes()
  let asking = false
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('Interface arrêtée :', details)
    if (details.reason === 'clean-exit' || win.isDestroyed() || asking) return
    if (crashes.next() === 'reload') return win.webContents.reload()
    asking = true
    const ask = async (): Promise<CrashChoice> => {
      const choices: CrashChoice[] = ['relaunch', 'log', 'quit']
      const { response } = await dialog.showMessageBox({
        type: 'error',
        message: t('dialogs.rendererCrashed.title'),
        detail: t('dialogs.rendererCrashed.message'),
        buttons: [
          t('dialogs.rendererCrashed.relaunch'),
          t('dialogs.rendererCrashed.showLog'),
          t('dialogs.rendererCrashed.quit')
        ],
        defaultId: 0,
        cancelId: 2
      })
      return choices[response] ?? 'quit'
    }
    // La relance repart de l'accueil : un nouveau lancement ouvre une conversation vierge, pas
    // celle qui faisait planter l'interface.
    void askAfterCrashes(ask, showLog).then((choice) => {
      if (quitFlow) return leaveAfterCrashes(choice, quitFlow, () => app.quit())
      // Avant le démarrage complet (pas encore de `QuitFlow`) : rien ne travaille encore.
      if (choice === 'relaunch') app.relaunch()
      app.quit()
    })
  })
}

/** En quittant (fiche 195) : SIGKILL aux groupes arrêtés qui vivent encore, avant la sortie du main. */
export function settleProcessesOnQuit(): void {
  waitForStoppedProcesses(
    app,
    () => stoppingGroups().length > 0,
    () => settleStoppedGroups()
  )
}
