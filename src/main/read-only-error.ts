import { t } from 'i18next'
import { READ_ONLY_ERROR } from '@shared/profile'

/** Refus d'une écriture en lecture seule (fiche 196) : la marque, puis le texte pour le journal. */
export function readOnlyError(): Error {
  return new Error(`${READ_ONLY_ERROR}: ${t('profile.readOnly.refused')}`)
}
