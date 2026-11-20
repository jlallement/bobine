/**
 * Erreurs du disque montrées dans l'onglet Fichiers (fiche 271) : un code système (`EACCES`,
 * `ENOENT`) ou un paramètre refusé par le main deviennent une phrase ; un message déjà clair (les
 * refus du main, traduits) passe tel quel.
 */
import i18next from 'i18next'

export function filesErrorText(error: string): string {
  if (/EACCES|EPERM|permission denied|operation not permitted/i.test(error)) {
    return i18next.t('files.error.denied')
  }
  if (/ENOENT|no such file/i.test(error)) return i18next.t('files.error.gone')
  if (/Paramètre invalide/i.test(error)) return i18next.t('files.error.stale')
  if (/ENOTDIR|not a directory/i.test(error)) return i18next.t('files.error.gone')
  return error
}
