/**
 * Clé des empreintes de la mémoire (fiche 182, ADR-0040) : un souvenir n'est donné aux agents que
 * si son contenu porte l'empreinte posée au clic de l'utilisateur. L'empreinte est un HMAC-SHA-256
 * à clé aléatoire, gardée chiffrée par le trousseau (`safeStorage`) dans `memory.key` du profil :
 * un agent qui écrit dans le dossier de la mémoire ne peut pas la calculer sans ouvrir le
 * trousseau (invite visible). La clé est lue une fois par lancement, à la première empreinte.
 *
 * Trois cas à ne pas confondre :
 * - pas de trousseau du tout (Linux sans trousseau, ou `basic_text` : mot de passe écrit en dur
 *   dans Chromium) **et** jamais eu de clé : repli documenté, SHA-256, une ligne au journal
 *   (`none`). On ne redescend jamais d'un cran : une clé ou une empreinte `hmac:` déjà là et un
 *   trousseau qui devient indisponible (un agent peut arrêter le trousseau sous Linux) donnent
 *   `locked`, jamais `none` ;
 * - clé présente mais illisible (accès au trousseau refusé, trousseau réinitialisé) : **aucune**
 *   empreinte ne correspond, rien n'est donné aux agents, rien ne se valide, et la clé n'est
 *   jamais remplacée (`locked`) ;
 * - clé absente : créée (`created`) ; des empreintes d'avant ne correspondent plus.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isReadOnly } from '../storage'
import { atomicWrite } from './store'

/** Chiffrement par le trousseau (`safeStorage` d'Electron ; un faux dans les essais). */
export interface KeyCipher {
  available(): Promise<boolean>
  /** Chiffrement sans secret (`basic_text` de Linux) : vaut « pas de trousseau ». */
  weak?(): boolean
  encrypt(text: string): Promise<Buffer>
  decrypt(data: Buffer): Promise<string>
}

/** État de la clé pour ce lancement. */
export type KeyState = 'ok' | 'created' | 'none' | 'locked'

export interface ApprovalSigner {
  /** Empreinte d'un contenu ; `undefined` si la clé est illisible (rien ne correspond). */
  sign(content: string): Promise<string | undefined>
  state(): Promise<KeyState>
}

/** Empreinte sans clé : essais, et machine sans trousseau. */
export const plainSigner: ApprovalSigner = {
  sign: (content) =>
    Promise.resolve(`sha256:${createHash('sha256').update(content).digest('hex')}`),
  state: () => Promise.resolve('ok')
}

export function approvalSigner(
  file: string,
  cipher: KeyCipher,
  log: (message: string) => void,
  /** Des empreintes à clé (`hmac:`) existent déjà (fichier des empreintes). */
  hasKeyedApprovals: () => boolean = () => false
): ApprovalSigner {
  let loading: Promise<{ key?: Buffer; state: KeyState }> | undefined
  const load = async (): Promise<{ key?: Buffer; state: KeyState }> => {
    let data: Buffer | undefined
    try {
      data = await readFile(file)
    } catch {
      data = undefined
    }
    const usable = (await cipher.available().catch(() => false)) && !cipher.weak?.()
    if (!usable) {
      // Jamais de repli quand une clé a existé : le trousseau a pu être arrêté exprès.
      if (data || hasKeyedApprovals()) {
        log(
          'Mémoire : trousseau indisponible alors qu’une clé existe, aucun souvenir donné aux agents'
        )
        return { state: 'locked' }
      }
      log('Mémoire : trousseau indisponible, empreintes sans clé (SHA-256)')
      return { state: 'none' }
    }
    if (data) {
      try {
        const key = Buffer.from(await cipher.decrypt(data), 'base64')
        if (key.length === 32) return { key, state: 'ok' }
      } catch {
        // Accès refusé : la clé n'est jamais remplacée (tout serait à re-valider).
      }
      log('Mémoire : clé des empreintes illisible, aucun souvenir donné aux agents')
      return { state: 'locked' }
    }
    // Profil en lecture seule (fiche 196) : jamais de clé créée ; rien n'est donné aux agents.
    if (isReadOnly(file)) return { state: 'locked' }
    const key = randomBytes(32)
    await atomicWrite(file, await cipher.encrypt(key.toString('base64')))
    log('Mémoire : clé des empreintes créée')
    return { key, state: 'created' }
  }
  const loaded = () => (loading ??= load())
  return {
    async sign(content) {
      const { key, state } = await loaded()
      if (key) return `hmac:${createHmac('sha256', key).update(content).digest('hex')}`
      return state === 'none' ? plainSigner.sign(content) : undefined
    },
    async state() {
      return (await loaded()).state
    }
  }
}
