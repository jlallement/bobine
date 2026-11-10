import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { KEYCHAIN_TIMEOUT_ERROR } from '@shared/agent'
import { ApiKeyStore, KeychainTimeout, withEnvChanges, type Cipher } from './api-keys'

/** Faux chiffrement réversible (inversion des octets), et indisponible à la demande. */
const fakeCipher = (available = true, reencrypt = false): Cipher => ({
  available: () => Promise.resolve(available),
  encrypt: (text) => Promise.resolve(Buffer.from(`enc:${text}`).reverse()),
  decrypt: (data) => {
    const text = Buffer.from(data).reverse().toString()
    if (!text.startsWith('enc:')) return Promise.reject(new Error('illisible'))
    return Promise.resolve({ text: text.slice(4), reencrypt })
  }
})

/** Le même, chaque appel compté : un appel, c'est le trousseau macOS consulté (fiche 100). */
const countingCipher = (available = true) => {
  const base = fakeCipher(available)
  const cipher = {
    available: vi.fn(base.available),
    encrypt: vi.fn(base.encrypt),
    decrypt: vi.fn(base.decrypt)
  }
  const calls = () =>
    cipher.available.mock.calls.length +
    cipher.encrypt.mock.calls.length +
    cipher.decrypt.mock.calls.length
  return { cipher, calls }
}

const BOB = [{ env: 'BOB_API_KEY', label: 'Clé d’API Bob', aliases: ['BOBSHELL_API_KEY'] }]
const file = () => join(mkdtempSync(join(tmpdir(), 'api-keys-')), 'api-keys.json')

describe('clés d’API (fiche 022)', () => {
  it('enregistre chiffré (fichier 0600), relit, pose la clé et retire l’ancien nom', async () => {
    const path = file()
    await new ApiKeyStore(path, fakeCipher()).set('bob', 'BOB_API_KEY', '  secret-123  ')
    const text = readFileSync(path, 'utf8')
    expect(text).not.toContain('secret-123')
    expect(statSync(path).mode & 0o777).toBe(0o600)
    const store = new ApiKeyStore(path, fakeCipher())
    expect(store.has('bob', 'BOB_API_KEY')).toBe(true)
    expect(await store.credentials('bob', BOB)).toEqual({
      BOBSHELL_API_KEY: undefined,
      BOB_API_KEY: 'secret-123'
    })
    expect(await store.credentials('opencode', BOB)).toEqual({})
  })

  it('info : jamais la valeur ; clé fournie par l’environnement (ancien nom compris)', async () => {
    const store = new ApiKeyStore(file(), fakeCipher())
    await store.set('bob', 'BOB_API_KEY', 'secret')
    const info = store.info('bob', BOB, { BOBSHELL_API_KEY: 'x' })
    expect(info).toEqual([
      { env: 'BOB_API_KEY', label: 'Clé d’API Bob', stored: true, fromEnvironment: true }
    ])
    expect(JSON.stringify(info)).not.toContain('secret')
  })

  it('supprime ; refuse une clé vide, avec espaces, ou sans trousseau', async () => {
    const path = file()
    const store = new ApiKeyStore(path, fakeCipher())
    await store.set('bob', 'BOB_API_KEY', 'a')
    store.remove('bob', 'BOB_API_KEY')
    expect(store.has('bob', 'BOB_API_KEY')).toBe(false)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ version: 1, keys: {} })
    await expect(store.set('bob', 'BOB_API_KEY', '  ')).rejects.toThrow('vide')
    await expect(store.set('bob', 'BOB_API_KEY', 'a b')).rejects.toThrow('invalide')
    await expect(
      new ApiKeyStore(file(), fakeCipher(false)).set('bob', 'BOB_API_KEY', 'a')
    ).rejects.toThrow('trousseau')
  })

  it('clé indéchiffrable (trousseau changé) : ignorée, signalée à ressaisir ; fichier abîmé : ignoré', async () => {
    const path = file()
    writeFileSync(path, JSON.stringify({ version: 1, keys: { bob: { BOB_API_KEY: 'zzz' } } }))
    const { cipher, calls } = countingCipher()
    const store = new ApiKeyStore(path, cipher)
    // Pas encore lue par un agent : on la sait enregistrée, pas encore illisible.
    expect(store.info('bob', BOB, {})[0]?.unreadable).toBeUndefined()
    expect(calls()).toBe(0)
    expect(await store.credentials('bob', BOB)).toEqual({})
    expect(await store.credentials('bob', BOB)).toEqual({})
    expect(cipher.decrypt).toHaveBeenCalledTimes(1)
    expect(store.info('bob', BOB, {})).toEqual([
      {
        env: 'BOB_API_KEY',
        label: 'Clé d’API Bob',
        stored: true,
        unreadable: true,
        fromEnvironment: false
      }
    ])
    await store.set('bob', 'BOB_API_KEY', 'nouvelle')
    expect(store.info('bob', BOB, {})[0]?.unreadable).toBeUndefined()
    writeFileSync(path, 'pas du json')
    expect(new ApiKeyStore(path, fakeCipher()).has('bob', 'BOB_API_KEY')).toBe(false)
  })

  it('trousseau à la demande (fiche 100) : jamais sans clé, à la saisie, une lecture par lancement', async () => {
    const path = file()
    const empty = countingCipher()
    const none = new ApiKeyStore(path, empty.cipher)
    expect(none.has('bob', 'BOB_API_KEY')).toBe(false)
    expect(none.info('bob', BOB, {})[0]?.stored).toBe(false)
    expect(await none.credentials('bob', BOB)).toEqual({})
    none.remove('bob', 'BOB_API_KEY')
    expect(empty.calls()).toBe(0)

    // Saisie : disponibilité vérifiée à ce moment, chiffrée ; la valeur saisie sert ensuite.
    await none.set('bob', 'BOB_API_KEY', 'secret')
    expect(empty.cipher.available).toHaveBeenCalledTimes(1)
    expect(empty.cipher.encrypt).toHaveBeenCalledTimes(1)
    expect((await none.credentials('bob', BOB))['BOB_API_KEY']).toBe('secret')
    expect(empty.cipher.decrypt).not.toHaveBeenCalled()

    // Lancement suivant de l'app : la liste sans rien ouvrir, un seul déchiffrement pour tous les
    // lancements d'agent.
    const next = countingCipher()
    const store = new ApiKeyStore(path, next.cipher)
    expect(store.info('bob', BOB, {})[0]).toEqual({
      env: 'BOB_API_KEY',
      label: 'Clé d’API Bob',
      stored: true,
      fromEnvironment: false
    })
    expect(next.calls()).toBe(0)
    for (let i = 0; i < 3; i++)
      expect((await store.credentials('bob', BOB))['BOB_API_KEY']).toBe('secret')
    expect(next.calls()).toBe(1)
    expect(next.cipher.decrypt).toHaveBeenCalledTimes(1)

    // Supprimée : oubliée aussi en mémoire.
    store.remove('bob', 'BOB_API_KEY')
    expect(await store.credentials('bob', BOB)).toEqual({})
  })

  it('trousseau indisponible à la saisie : le message d’aujourd’hui, rien d’enregistré', async () => {
    const path = file()
    const { cipher } = countingCipher(false)
    const store = new ApiKeyStore(path, cipher)
    await expect(store.set('bob', 'BOB_API_KEY', 'secret')).rejects.toThrow(
      'Le trousseau macOS n’est pas disponible\u00a0: la clé ne peut pas être enregistrée.'
    )
    expect(cipher.encrypt).not.toHaveBeenCalled()
    expect(store.has('bob', 'BOB_API_KEY')).toBe(false)
    expect(await store.credentials('bob', BOB)).toEqual({})
  })

  it('lancements simultanés : un seul déchiffrement ; clé du trousseau renouvelée : rechiffrée', async () => {
    const path = file()
    await new ApiKeyStore(path, fakeCipher()).set('bob', 'BOB_API_KEY', 'secret')
    const before = readFileSync(path, 'utf8')
    const base = fakeCipher(true, true)
    const cipher = { ...base, encrypt: vi.fn(base.encrypt), decrypt: vi.fn(base.decrypt) }
    const store = new ApiKeyStore(path, cipher)
    const read = await Promise.all([1, 2, 3].map(() => store.credentials('bob', BOB)))
    expect(read.map((env) => env['BOB_API_KEY'])).toEqual(['secret', 'secret', 'secret'])
    expect(cipher.decrypt).toHaveBeenCalledTimes(1)
    expect(cipher.encrypt).toHaveBeenCalledTimes(1)
    // Même faux chiffrement, même texte : réécrit, toujours lisible et jamais en clair.
    expect(readFileSync(path, 'utf8')).toBe(before)
    expect(await new ApiKeyStore(path, fakeCipher()).credentials('bob', BOB)).toMatchObject({
      BOB_API_KEY: 'secret'
    })
  })

  it('withEnvChanges pose et retire sans toucher l’original', () => {
    const base = { A: '1', BOBSHELL_API_KEY: 'old' }
    expect(withEnvChanges(base, { BOBSHELL_API_KEY: undefined, BOB_API_KEY: 'k' })).toEqual({
      A: '1',
      BOB_API_KEY: 'k'
    })
    expect(base).toEqual({ A: '1', BOBSHELL_API_KEY: 'old' })
  })
})

/** Trousseau dont la fenêtre attend l'utilisateur : `answer` y répond (fiche 207). */
const waitingCipher = () => {
  const base = fakeCipher()
  let answer: (ok: boolean) => void = () => {}
  const asked = new Promise<boolean>((resolve) => (answer = resolve))
  const cipher = {
    available: vi.fn(() => asked),
    encrypt: vi.fn(base.encrypt),
    decrypt: vi.fn(base.decrypt)
  }
  return { cipher, answer: (ok = true) => answer(ok) }
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('trousseau qui ne répond pas (fiche 207)', () => {
  it('délai dépassé : erreur reconnaissable, rien d’enregistré, réponse tardive ignorée', async () => {
    const path = file()
    const { cipher, answer } = waitingCipher()
    const store = new ApiKeyStore(path, cipher, { timeoutMs: 20 })
    const failure = await store.set('bob', 'BOB_API_KEY', 'secret').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(KeychainTimeout)
    expect(String((failure as Error).message)).toContain(KEYCHAIN_TIMEOUT_ERROR)
    // Le trousseau finit par répondre : rien n'est chiffré ni écrit en silence.
    answer()
    await tick(10)
    expect(cipher.encrypt).not.toHaveBeenCalled()
    expect(store.has('bob', 'BOB_API_KEY')).toBe(false)
    expect(existsSync(path)).toBe(false)
  })

  it('Réessayer attend la même question au trousseau, sans en poser une autre', async () => {
    const { cipher, answer } = waitingCipher()
    const store = new ApiKeyStore(file(), cipher, { timeoutMs: 30 })
    await expect(store.set('bob', 'BOB_API_KEY', 'premiere')).rejects.toBeInstanceOf(
      KeychainTimeout
    )
    const retry = store.set('bob', 'BOB_API_KEY', 'seconde')
    answer()
    await retry
    expect(cipher.available).toHaveBeenCalledTimes(1)
    expect(cipher.encrypt).toHaveBeenCalledTimes(1)
    expect(await store.credentials('bob', BOB)).toMatchObject({ BOB_API_KEY: 'seconde' })
  })

  it('trousseau répondu à temps : enregistré, et la question suivante est reposée', async () => {
    const { cipher, answer } = waitingCipher()
    const store = new ApiKeyStore(file(), cipher, { timeoutMs: 1000 })
    const saving = store.set('bob', 'BOB_API_KEY', 'secret')
    answer()
    await saving
    expect(store.has('bob', 'BOB_API_KEY')).toBe(true)
    await store.set('bob', 'BOB_API_KEY', 'autre')
    expect(cipher.available).toHaveBeenCalledTimes(2)
  })
})
