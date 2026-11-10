import i18next from 'i18next'
import { messageOf } from '@shared/errors'
import { KEYCHAIN_TIMEOUT_ERROR } from '@shared/agent'
import { READ_ONLY_ERROR } from '@shared/profile'

/**
 * Message d'une erreur venue du main par l'IPC, sans ce qu'Electron met devant
 * (« Error invoking remote method 'canal': Error: ») : seule la cause reste.
 */
export function ipcErrorText(error: unknown): string {
  const text = messageOf(error)
  // Refus de la lecture seule (fiche 196) : dit dans la langue de l'interface.
  if (text.includes(READ_ONLY_ERROR)) return i18next.t('profile.readOnly.refusedShort')
  return text
    .replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
    .replace(`${KEYCHAIN_TIMEOUT_ERROR}: `, '')
}

/** Le trousseau macOS n'a pas répondu à temps (fiche 207) : la clé saisie est gardée, à réessayer. */
export function isKeychainTimeout(error: unknown): boolean {
  return messageOf(error).includes(KEYCHAIN_TIMEOUT_ERROR)
}
