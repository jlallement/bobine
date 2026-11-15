/**
 * Chiffrement des clés d'API par `safeStorage` d'Electron (fiche 022), et ce que les essais de bout
 * en bout peuvent en régler (fiche 207). N'importe pas `electron` : `safeStorage` est passé.
 */
import type { Cipher } from './api-keys'

/** Les méthodes asynchrones de `safeStorage` dont l'app se sert. */
export interface SafeStorageAsync {
  isAsyncEncryptionAvailable(): Promise<boolean>
  encryptStringAsync(text: string): Promise<Buffer>
  decryptStringAsync(data: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>
  /**
   * Linux : où `safeStorage` range sa clé (`gnome_libsecret`, `kwallet6`…) ; `basic_text` quand il
   * n'y a aucun trousseau de session, et Chromium « chiffre » alors avec une clé fixe, connue de
   * tous (fiche 145, D4).
   */
  getSelectedStorageBackend?(): string
}

/**
 * Réglages d'essai, lus seulement quand le trousseau est le faux de Chromium
 * (`--use-mock-keychain`, posé par les essais de bout en bout) : jamais avec le vrai trousseau,
 * donc jamais dans l'app de l'utilisateur.
 * - `BOBINE_KEYCHAIN_DELAY_MS` : la première question au trousseau tarde d'autant (fenêtre de
 *   macOS qui attend une réponse) ;
 * - `BOBINE_KEYCHAIN_TIMEOUT_MS` : délai d'attente de l'enregistrement, raccourci.
 */
export interface KeychainTestOptions {
  delayMs?: number
  timeoutMs?: number
  /** `BOBINE_KEYCHAIN_BACKEND=basic_text` : Linux sans trousseau, simulé (fiche 145, D4). */
  backend?: string
}

export function keychainTestOptions(
  mockKeychain: boolean,
  env: NodeJS.ProcessEnv
): KeychainTestOptions {
  if (!mockKeychain) return {}
  const read = (name: string) => {
    const value = Number(env[name])
    return Number.isFinite(value) && value > 0 ? value : undefined
  }
  const delayMs = read('BOBINE_KEYCHAIN_DELAY_MS')
  const timeoutMs = read('BOBINE_KEYCHAIN_TIMEOUT_MS')
  const backend = env['BOBINE_KEYCHAIN_BACKEND']
  return {
    ...(delayMs ? { delayMs } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
    ...(backend ? { backend } : {})
  }
}

/**
 * Le chiffrement de `safeStorage`. Avec un délai d'essai, seule la première question tarde, comme
 * l'initialisation du trousseau (une fois répondue, macOS ne redemande plus).
 */
export function safeStorageCipher(
  storage: SafeStorageAsync,
  test: KeychainTestOptions = {}
): Cipher {
  let delayed: Promise<void> | undefined
  const initialized = () => {
    if (!test.delayMs) return Promise.resolve()
    delayed ??= new Promise((resolve) => setTimeout(resolve, test.delayMs))
    return delayed
  }
  return {
    available: async () => {
      await initialized()
      return storage.isAsyncEncryptionAvailable()
    },
    encrypt: async (text) => {
      await initialized()
      return storage.encryptStringAsync(text)
    },
    decrypt: async (data) => {
      await initialized()
      const { result, shouldReEncrypt } = await storage.decryptStringAsync(data)
      return { text: result, reencrypt: shouldReEncrypt }
    },
    // Après `available()` : le choix du trousseau est fait à l'initialisation de `safeStorage`.
    withoutKeychain: async () => {
      await initialized()
      if (test.backend) return test.backend === 'basic_text'
      try {
        return storage.getSelectedStorageBackend?.() === 'basic_text'
      } catch {
        return false
      }
    }
  }
}
