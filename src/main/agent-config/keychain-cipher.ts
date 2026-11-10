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
  return { ...(delayMs ? { delayMs } : {}), ...(timeoutMs ? { timeoutMs } : {}) }
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
    }
  }
}
