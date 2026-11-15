import { join } from 'node:path'
import { app, dialog } from 'electron'
import { t } from 'i18next'
import { log } from './log'
import { migrateUserData } from './user-data-migration'

/**
 * Ancien nom (fiche 069, ADR-0013) : le dossier `bob-desktop` devient `bobine` au premier lancement.
 * Rend vrai si l'ancienne app est encore ouverte : elle écrit dans ce dossier, on attend qu'elle
 * soit fermée.
 */
export function oldAppStillOpen(isolated: boolean, userData: string): boolean {
  if (isolated) return false
  const previous = join(app.getPath('appData'), 'bob-desktop')
  try {
    const migration = migrateUserData(previous, userData)
    if (migration.kind === 'moved') log.info(`Dossier de données repris de ${previous}`)
    if (migration.kind === 'imported') {
      log.info(`Conversations reprises de ${previous} : ${migration.conversations}`)
    }
    if (migration.kind !== 'busy') return false
  } catch (error) {
    log.error('Reprise du dossier de données impossible :', error)
    return false
  }
  dialog.showErrorBox(t('dialogs.oldApp.title'), t('dialogs.oldApp.message'))
  return true
}
