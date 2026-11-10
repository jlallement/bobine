/**
 * Clés d'API des agents (fiche 022), saisies dans l'app : chiffrées (trousseau macOS, via
 * `safeStorage`) dans un fichier des données de l'app, jamais renvoyées au renderer, et posées dans
 * l'environnement de l'agent à son lancement.
 *
 * Le trousseau n'est touché que lorsqu'une clé sert (fiche 100) : saisie (`set`) ou lancement de
 * l'agent qui la lit (`credentials`, une fois par clé et par lancement de l'app). Savoir qu'une clé
 * existe (`has`, `info`) ne déchiffre rien : l'app signée ad hoc ferait sinon redemander le mot de
 * passe du trousseau à chaque démarrage.
 */
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { KEYCHAIN_TIMEOUT_ERROR, type ApiKeyInfo } from '@shared/agent'
import { readJson, writeFileAtomic } from '../storage'
import { t } from 'i18next'

/**
 * Chiffrement des valeurs (`safeStorage` d'Electron, ses méthodes asynchrones depuis Electron 45 ;
 * un faux dans les tests). Chaque appel peut ouvrir le trousseau macOS.
 */
export interface Cipher {
  available(): Promise<boolean>
  encrypt(text: string): Promise<Buffer>
  /** `reencrypt` : la clé du trousseau a changé, la valeur est à rechiffrer. */
  decrypt(data: Buffer): Promise<{ text: string; reencrypt: boolean }>
}

/** Clé d'API qu'un agent accepte, déclarée par son profil. */
export interface ApiKeySpec {
  /** Variable d'environnement lue par l'agent (Bob : `BOB_API_KEY`). */
  env: string
  label: string
  /** Où obtenir la clé. */
  help?: string
  /** Anciens noms, retirés quand l'app pose la clé (Bob refuse deux valeurs différentes). */
  aliases?: string[]
}

/** Variables à poser (texte) ou à retirer (`undefined`) dans l'environnement de l'agent. */
export type EnvChanges = Record<string, string | undefined>

type Stored = Record<string, Record<string, string>>

/** Longueur maximale d'une clé : au-delà, c'est sûrement autre chose qu'une clé. */
const MAX_KEY_LENGTH = 4096

/**
 * Attente maximale du trousseau à l'enregistrement (fiche 207) : l'app signée ad hoc fait
 * redemander l'autorisation à chaque version, et la fenêtre de macOS peut rester cachée. Au-delà,
 * l'enregistrement est dit raté plutôt que de laisser le bouton tourner sans fin.
 */
export const KEYCHAIN_TIMEOUT_MS = 60_000

/** Le trousseau n'a pas répondu à temps : rien n'est enregistré (le renderer le reconnaît). */
export class KeychainTimeout extends Error {
  readonly ms: number
  constructor(ms: number) {
    super(
      `${KEYCHAIN_TIMEOUT_ERROR}: ${t('apiKeys.keychainTimeout', { seconds: Math.round(ms / 1000) })}`
    )
    // Nom laissé à « Error » : le renderer n'en voit que le message (préfixe d'Electron retiré).
    this.ms = ms
  }
}

export class ApiKeyStore {
  private readonly file: string
  private readonly cipher: Cipher
  private keys: Stored
  /**
   * Valeurs déjà déchiffrées (ou en cours de déchiffrement) ou saisies pendant ce lancement, par
   * `agent:variable` : deux lancements simultanés n'ouvrent pas deux fois le trousseau.
   */
  private readonly plain = new Map<string, Promise<string | undefined>>()
  /** Clés que le trousseau n'a pas su déchiffrer pendant ce lancement : à ressaisir. */
  private readonly failed = new Set<string>()
  /**
   * Question « trousseau disponible ? » encore sans réponse (fenêtre de macOS ouverte) : un nouvel
   * essai l'attend au lieu d'en poser une autre (fiche 207). Electron fait de même (une seule
   * initialisation, les appels suivants mis en file) ; gardé ici pour ne pas en dépendre.
   */
  private availability: Promise<boolean> | undefined
  private readonly timeoutMs: number

  constructor(file: string, cipher: Cipher, options: { timeoutMs?: number } = {}) {
    this.file = file
    this.cipher = cipher
    this.keys = load(file)
    this.timeoutMs = options.timeoutMs ?? KEYCHAIN_TIMEOUT_MS
  }

  has(profileId: string, env: string): boolean {
    return typeof this.keys[profileId]?.[env] === 'string'
  }

  async set(profileId: string, env: string, value: string): Promise<void> {
    const key = value.trim()
    if (!key) throw new Error(t('apiKeys.empty'))
    if (key.length > MAX_KEY_LENGTH || /\s/.test(key)) throw new Error(t('apiKeys.invalid'))
    // Délai dépassé : une réponse tardive du trousseau est ignorée, rien n'est enregistré en silence.
    let late = false
    const encrypting = (async () => {
      if (!(await this.keychainAvailable())) throw new Error(t('apiKeys.noKeychain'))
      if (late) return undefined
      return this.cipher.encrypt(key)
    })()
    const encrypted = await withTimeout(encrypting, this.timeoutMs, () => {
      late = true
      return new KeychainTimeout(this.timeoutMs)
    })
    if (!encrypted) throw new KeychainTimeout(this.timeoutMs)
    this.store(profileId, env, encrypted.toString('base64'))
    this.plain.set(slot(profileId, env), Promise.resolve(key))
    this.failed.delete(slot(profileId, env))
  }

  /** Une seule question au trousseau à la fois ; oubliée une fois répondue (ou en échec). */
  private keychainAvailable(): Promise<boolean> {
    if (!this.availability) {
      const pending = this.cipher.available()
      this.availability = pending
      const forget = () => {
        if (this.availability === pending) this.availability = undefined
      }
      pending.then(forget, forget)
    }
    return this.availability
  }

  remove(profileId: string, env: string): void {
    const rest = Object.fromEntries(
      Object.entries(this.keys[profileId] ?? {}).filter(([name]) => name !== env)
    )
    const others = Object.fromEntries(Object.entries(this.keys).filter(([id]) => id !== profileId))
    this.keys = Object.keys(rest).length ? { ...others, [profileId]: rest } : others
    this.save()
    this.plain.delete(slot(profileId, env))
    this.failed.delete(slot(profileId, env))
  }

  /**
   * Environnement de l'agent : ses clés enregistrées, et leurs anciens noms retirés. Une clé
   * illisible (trousseau changé…) est ignorée : l'agent démarre sans, et demandera une connexion.
   */
  async credentials(profileId: string, specs: readonly ApiKeySpec[]): Promise<EnvChanges> {
    const changes: EnvChanges = {}
    for (const spec of specs) {
      const value = await this.read(profileId, spec.env)
      if (value === undefined) continue
      for (const alias of spec.aliases ?? []) changes[alias] = undefined
      changes[spec.env] = value
    }
    return changes
  }

  /** État des clés d'un agent pour l'interface : jamais les valeurs. */
  info(profileId: string, specs: readonly ApiKeySpec[], env: NodeJS.ProcessEnv): ApiKeyInfo[] {
    return specs.map((spec) => ({
      env: spec.env,
      label: spec.label,
      ...(spec.help ? { help: spec.help } : {}),
      stored: this.has(profileId, spec.env),
      ...(this.has(profileId, spec.env) && this.failed.has(slot(profileId, spec.env))
        ? { unreadable: true }
        : {}),
      fromEnvironment: [spec.env, ...(spec.aliases ?? [])].some((name) => !!env[name])
    }))
  }

  /**
   * Valeur en clair d'une clé enregistrée, déchiffrée au plus une fois par lancement. Échec : le
   * trousseau ne sait plus la déchiffrer (l'entrée porte l'ancien nom de l'app, « Bob Desktop »,
   * ADR-0012, ou elle a été supprimée) ; retenu, et dit « illisible » par `info`.
   */
  private read(profileId: string, env: string): Promise<string | undefined> {
    const encrypted = this.keys[profileId]?.[env]
    if (!encrypted) return Promise.resolve(undefined)
    const id = slot(profileId, env)
    const known = this.plain.get(id)
    if (known) return known
    if (this.failed.has(id)) return Promise.resolve(undefined)
    const reading = this.decrypt(profileId, env, encrypted).then((text) => {
      // Échec retenu, sauf si la clé a été ressaisie ou retirée entre-temps.
      if (text === undefined && this.plain.get(id) === reading) {
        this.plain.delete(id)
        this.failed.add(id)
      }
      return text
    })
    this.plain.set(id, reading)
    return reading
  }

  /** Valeur en clair, `undefined` si le trousseau ne sait pas la déchiffrer. */
  private async decrypt(
    profileId: string,
    env: string,
    encrypted: string
  ): Promise<string | undefined> {
    let decrypted: { text: string; reencrypt: boolean }
    try {
      decrypted = await this.cipher.decrypt(Buffer.from(encrypted, 'base64'))
    } catch {
      return undefined
    }
    // Clé du trousseau renouvelée : la valeur est rechiffrée, au mieux (l'ancienne reste lisible).
    if (decrypted.reencrypt) {
      try {
        const again = (await this.cipher.encrypt(decrypted.text)).toString('base64')
        if (this.keys[profileId]?.[env] === encrypted) this.store(profileId, env, again)
      } catch {
        // Rien : l'ancienne valeur se déchiffre toujours.
      }
    }
    return decrypted.text
  }

  private store(profileId: string, env: string, encrypted: string): void {
    this.keys = { ...this.keys, [profileId]: { ...this.keys[profileId], [env]: encrypted } }
    this.save()
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileAtomic(this.file, `${JSON.stringify({ version: 1, keys: this.keys }, null, 2)}\n`, {
      mode: 0o600
    })
    chmodSync(this.file, 0o600)
  }
}

/** `work`, ou l'erreur de `onTimeout` passé `ms` ; l'issue tardive de `work` est alors ignorée. */
function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), ms)
  })
  work.catch(() => {})
  return Promise.race([work, expired]).finally(() => clearTimeout(timer))
}

function slot(profileId: string, env: string): string {
  return `${profileId}:${env}`
}

function load(file: string): Stored {
  const read = readJson(file)
  if (!read.ok) return {}
  const keys = (read.value as { keys?: unknown } | null)?.keys
  if (typeof keys !== 'object' || keys === null) return {}
  const stored: Stored = {}
  for (const [profileId, entries] of Object.entries(keys)) {
    if (typeof entries !== 'object' || entries === null) continue
    const valid = Object.entries(entries).filter(
      (e): e is [string, string] => typeof e[1] === 'string'
    )
    if (valid.length) stored[profileId] = Object.fromEntries(valid)
  }
  return stored
}

/** Applique des changements à un environnement (sans le modifier). */
export function withEnvChanges(base: NodeJS.ProcessEnv, changes: EnvChanges): NodeJS.ProcessEnv {
  const env = { ...base }
  for (const [name, value] of Object.entries(changes)) {
    if (value === undefined) Reflect.deleteProperty(env, name)
    else env[name] = value
  }
  return env
}
