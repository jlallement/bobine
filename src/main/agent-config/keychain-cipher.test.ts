import { describe, expect, it, vi } from 'vitest'
import { keychainTestOptions, safeStorageCipher, type SafeStorageAsync } from './keychain-cipher'

const storage = (): SafeStorageAsync => ({
  isAsyncEncryptionAvailable: vi.fn(() => Promise.resolve(true)),
  encryptStringAsync: vi.fn((text: string) => Promise.resolve(Buffer.from(text))),
  decryptStringAsync: vi.fn((data: Buffer) =>
    Promise.resolve({ result: data.toString(), shouldReEncrypt: false })
  )
})

describe('trousseau des essais (fiche 207)', () => {
  it('réglages d’essai lus seulement avec le faux trousseau de Chromium', () => {
    const env = { BOBINE_KEYCHAIN_DELAY_MS: '4000', BOBINE_KEYCHAIN_TIMEOUT_MS: '2500' }
    expect(keychainTestOptions(false, env)).toEqual({})
    expect(keychainTestOptions(true, env)).toEqual({ delayMs: 4000, timeoutMs: 2500 })
    expect(keychainTestOptions(true, { BOBINE_KEYCHAIN_DELAY_MS: 'x' })).toEqual({})
  })

  it('sans réglage : safeStorage tel quel', async () => {
    const cipher = safeStorageCipher(storage())
    expect(await cipher.available()).toBe(true)
    expect(await cipher.decrypt(await cipher.encrypt('k'))).toEqual({ text: 'k', reencrypt: false })
  })

  it('délai d’essai : seule la première question tarde', async () => {
    vi.useFakeTimers()
    try {
      const safe = storage()
      const cipher = safeStorageCipher(safe, { delayMs: 1000 })
      let answered = false
      const first = cipher.available().then(() => (answered = true))
      await vi.advanceTimersByTimeAsync(999)
      expect(answered).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await first
      expect(answered).toBe(true)
      const second = cipher.encrypt('k')
      await vi.advanceTimersByTimeAsync(0)
      expect((await second).toString()).toBe('k')
    } finally {
      vi.useRealTimers()
    }
  })

  it('Linux sans trousseau (D4) : `basic_text` dit « sans trousseau » ; simulable aux essais', async () => {
    const backend = (name: string) => ({ ...storage(), getSelectedStorageBackend: () => name })
    expect(await safeStorageCipher(backend('basic_text')).withoutKeychain?.()).toBe(true)
    expect(await safeStorageCipher(backend('gnome_libsecret')).withoutKeychain?.()).toBe(false)
    // macOS, Windows : pas de méthode, ou elle lève.
    expect(await safeStorageCipher(storage()).withoutKeychain?.()).toBe(false)
    const throwing = {
      ...storage(),
      getSelectedStorageBackend: (): string => {
        throw new Error('x')
      }
    }
    expect(await safeStorageCipher(throwing).withoutKeychain?.()).toBe(false)
    expect(keychainTestOptions(true, { BOBINE_KEYCHAIN_BACKEND: 'basic_text' })).toEqual({
      backend: 'basic_text'
    })
    expect(keychainTestOptions(false, { BOBINE_KEYCHAIN_BACKEND: 'basic_text' })).toEqual({})
    const simulated = safeStorageCipher(backend('gnome_libsecret'), { backend: 'basic_text' })
    expect(await simulated.withoutKeychain?.()).toBe(true)
  })
})
