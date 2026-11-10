/**
 * Recommencer à neuf (fiche 148), branché sur Electron : le profil de ce lancement (créé à
 * l'import, avant tout usage du dossier de données) et ce que l'interface en demande par IPC.
 */
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import { t } from 'i18next'
import type { FreshStartInfo, ResetPlan } from '@shared/fresh-start'
import type { Message } from '@shared/i18n/message'
import { createFreshStart, resetRelaunch } from './fresh-start'
import { log } from './log'
import {
  launchReset,
  RESET_FAILURE_NAME,
  resetFolderName,
  resetInventory,
  resetPaths,
  takeResetFailure
} from './reset'
import { bundleOf, installDirs, isInstalled } from './self-install'

export const freshStart = createFreshStart({
  hasSwitch: (name) => app.commandLine.hasSwitch(name),
  onWillQuit: (listener) => app.on('will-quit', listener),
  isPackaged: app.isPackaged,
  execPath: process.execPath,
  appPath: () => app.getAppPath()
})

/** Identifiant de l'app installée (`electron-builder.yml`) : ses préférences de macOS. */
const BUNDLE_ID = 'dev.bobine.app'
/** Entrée du trousseau qui chiffre les clés d'API (nom de l'app, voir `index.ts`). */
const KEYCHAIN_SERVICE = 'Bobine Safe Storage'

export interface FreshStartIpc {
  info: FreshStartInfo
  plan: () => Promise<ResetPlan>
  /** Lance l'assistant puis quitte ; `uninstall` : l'app part aussi à la corbeille. */
  reset: (uninstall: boolean) => void
  openTemporary: (freshAgents: boolean) => void
}

/**
 * Relance après la réinitialisation : l'app installée seulement, avec le dossier de données imposé
 * de ce lancement (fiche 187, D24). `BOBINE_RESET_RELAUNCH` (essais) : `off`, pas de relance ; un
 * chemin, un enregistreur appelé à la place de `open`, même pour l'app packagée non installée.
 */
function relaunchAfterReset(installed: string | undefined, userData: string): string[] | undefined {
  const testOpener = process.env['BOBINE_RESET_RELAUNCH']
  if (testOpener === 'off') return undefined
  const bundle = testOpener && app.isPackaged ? bundleOf(process.execPath) : installed
  if (!bundle) return undefined
  return resetRelaunch({
    opener: testOpener || '/usr/bin/open',
    bundle,
    temporary: freshStart.temporary,
    ...(freshStart.isolated ? { userDataDir: resolve(userData) } : {})
  })
}

/** `confirmQuit` : quitter sans la question des conversations en cours (déjà confirmé). */
export function freshStartIpc(confirmQuit: () => void): FreshStartIpc {
  const { isolated } = freshStart
  const userData = () => app.getPath('userData')
  // Dossier de données imposé : le journal y est déjà ; le vrai, et l'ancien dossier, sont à
  // l'utilisateur, pas à ce lancement.
  const outside = () => [
    isolated ? undefined : app.getPath('logs'),
    isolated ? undefined : join(app.getPath('appData'), 'bob-desktop'),
    app.isPackaged && !isolated
      ? join(homedir(), 'Library', 'Saved Application State', `${BUNDLE_ID}.savedState`)
      : undefined
  ]
  const bundle = () => {
    const path = app.isPackaged ? bundleOf(process.execPath) : undefined
    return path && isInstalled(path, installDirs(homedir())) ? path : undefined
  }
  return {
    info: { temporary: freshStart.temporary, askReset: freshStart.askReset },
    plan: async () => ({
      items: await resetInventory(userData(), resetPaths(outside())),
      keychain: !isolated,
      canUninstall: !!bundle()
    }),
    reset: (uninstall) => {
      if (freshStart.temporary) throw new Error(t('settings.data.fresh.temporaryNoReset'))
      const installed = bundle()
      const relaunch = uninstall ? undefined : relaunchAfterReset(installed, userData())
      const file = launchReset(
        {
          pid: process.pid,
          paths: resetPaths([userData(), ...outside(), uninstall ? installed : undefined]),
          trashDir: process.env['BOBINE_TRASH_DIR'] ?? join(homedir(), '.Trash'),
          folderName: resetFolderName(t('settings.data.fresh.trashFolder'), new Date()),
          readmeName: t('settings.data.fresh.readmeName'),
          readme: t('settings.data.fresh.readme'),
          failureFile: join(userData(), RESET_FAILURE_NAME),
          ...(isolated ? {} : { keychain: KEYCHAIN_SERVICE }),
          ...(app.isPackaged && !isolated ? { defaultsDomain: BUNDLE_ID } : {}),
          ...(relaunch ? { relaunch } : {})
        },
        { tmp: tmpdir() }
      )
      log.info(`Réinitialisation demandée (${uninstall ? 'désinstallation' : 'relance'}) : ${file}`)
      confirmQuit()
      // La réponse IPC part d'abord ; l'assistant attend la fin de l'app.
      setTimeout(() => app.quit(), 100)
    },
    openTemporary: (freshAgents) => {
      log.info(`Profil temporaire ouvert${freshAgents ? ', agents comme sur un Mac neuf' : ''}`)
      freshStart.openTemporary(freshAgents)
    }
  }
}

/**
 * Réinitialisation précédente qui n'a rien fait (fiche 187) : sa raison, laissée par l'assistant
 * dans le dossier de données, est montrée une fois au lancement.
 */
export function reportResetFailure(notify: (message: Message) => void): void {
  const failure = takeResetFailure(app.getPath('userData'))
  if (!failure) return
  log.warn(`Réinitialisation précédente non faite, rien n'a été supprimé : ${failure}`)
  notify({ key: 'conversations.notice.resetFailed', params: { detail: failure } })
}
