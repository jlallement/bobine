/**
 * Identifiant d'app de Windows (AppUserModelID, fiche 229, lot 6). Windows n'affiche une
 * notification que si l'identifiant du processus est celui d'un raccourci du menu Démarrer :
 * l'installeur NSIS pose ce raccourci avec l'`appId` d'electron-builder.yml (`dev.bobine.app`).
 * Sans cet appel, Electron prend `electron.app.Bobine`, qu'aucun raccourci ne porte : pas de toast.
 *
 * Le vrai système décide (comme le lancement des processus, ADR-0050), jamais `BOBINE_PLATFORM` :
 * l'identifiant n'a de sens que pour Windows lui-même. Rien ne change sur macOS ni sur Linux.
 */
import type { App } from 'electron'

/** Même valeur que `appId` dans electron-builder.yml (vérifié par un test). */
export const APP_USER_MODEL_ID = 'dev.bobine.app'

/** Pose l'identifiant sous Windows ; ne fait rien ailleurs. Dit s'il a été posé. */
export function applyAppUserModelId(
  app: Pick<App, 'setAppUserModelId'>,
  platform: NodeJS.Platform
): boolean {
  if (platform !== 'win32') return false
  app.setAppUserModelId(APP_USER_MODEL_ID)
  return true
}
