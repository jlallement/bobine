/**
 * Identifiant d'app de Windows (AppUserModelID, fiche 229, lot 6). Windows n'affiche une
 * notification que si l'identifiant du processus est celui d'un raccourci du menu Démarrer :
 * l'installeur NSIS pose ce raccourci avec l'`appId` d'electron-builder.yml (`dev.bobine.app`).
 * Sans cet appel, Electron prend `electron.app.Bobine`, qu'aucun raccourci ne porte : pas de toast.
 *
 * Le vrai système décide (comme le lancement des processus, ADR-0050), jamais `BOBINE_PLATFORM` :
 * l'identifiant n'a de sens que pour Windows lui-même. Rien ne change sur macOS ni sur Linux.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { App, Shell } from 'electron'

/** Même valeur que `appId` dans electron-builder.yml (vérifié par un test). */
export const APP_USER_MODEL_ID = 'dev.bobine.app'

/**
 * Activateur des toasts (fiche 229) : sans lui, cliquer un toast depuis le centre de notifications
 * le retire sans rien rappeler (vu dans la VM : fenêtre restée réduite). Electron 45 inscrit
 * lui-même l'activateur COM de ce CLSID (`app.setToastActivatorCLSID`) ; il doit être **fixe**,
 * sinon Electron en tire un au hasard à chaque lancement et Windows ne retrouve pas l'app.
 */
export const TOAST_ACTIVATOR_CLSID = '{55D36188-D3A9-490A-8F53-79D773728C1F}'

/** Pose l'identifiant et l'activateur sous Windows ; ne fait rien ailleurs. Dit s'il a été posé. */
export function applyAppUserModelId(
  app: Pick<App, 'setAppUserModelId' | 'setToastActivatorCLSID'>,
  platform: NodeJS.Platform
): boolean {
  if (platform !== 'win32') return false
  app.setAppUserModelId(APP_USER_MODEL_ID)
  app.setToastActivatorCLSID(TOAST_ACTIVATOR_CLSID)
  return true
}

/** Ce que l'activateur demande au raccourci (`shell` d'Electron, injecté pour les essais). */
export type ShortcutShell = Pick<Shell, 'readShortcutLink' | 'writeShortcutLink'>

/**
 * Raccourci du menu Démarrer posé par l'installeur (`shortcutName` d'electron-builder.yml) : NSIS y
 * met l'AUMID mais pas le CLSID de l'activateur ; c'est par lui que Windows rappelle l'app quand
 * on clique un toast depuis le centre de notifications (vu dans la VM : rien sans lui). Mis à jour
 * au lancement, une fois (déjà à jour : rien). Absent (`pnpm dev`, app non installée) : rien.
 * Rend ce qui a été fait.
 */
export function ensureToastShortcut(
  shell: ShortcutShell,
  shortcut: string,
  exists: (path: string) => boolean
): 'absent' | 'up-to-date' | 'updated' | 'failed' {
  if (!exists(shortcut)) return 'absent'
  try {
    const current = shell.readShortcutLink(shortcut)
    const same = (a?: string) => a?.replace(/[{}]/g, '').toLowerCase()
    if (
      same(current.toastActivatorClsid) === same(TOAST_ACTIVATOR_CLSID) &&
      current.appUserModelId === APP_USER_MODEL_ID
    ) {
      return 'up-to-date'
    }
    // `update` garde le reste du raccourci (cible, icône, arguments) ; la cible est redonnée
    // telle quelle (champ obligatoire du type d'Electron).
    const ok = shell.writeShortcutLink(shortcut, 'update', {
      target: current.target,
      toastActivatorClsid: TOAST_ACTIVATOR_CLSID,
      appUserModelId: APP_USER_MODEL_ID
    })
    return ok ? 'updated' : 'failed'
  } catch {
    return 'failed'
  }
}

/**
 * Sous Windows, le raccourci du menu Démarrer de l'installeur (`shortcutName: Bobine`) porte-t-il
 * l'activateur ? Rend ce qui a été fait, ou rien (autre système, ou app non installée).
 */
export function windowsToastShortcut(
  app: Pick<App, 'getPath'>,
  shell: ShortcutShell,
  platform: NodeJS.Platform
): Exclude<ReturnType<typeof ensureToastShortcut>, 'absent'> | undefined {
  if (platform !== 'win32') return undefined
  const programs = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  const done = ensureToastShortcut(shell, join(programs, 'Bobine.lnk'), existsSync)
  return done === 'absent' ? undefined : done
}
