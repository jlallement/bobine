/**
 * Modèles d'un agent qu'aucune session n'a encore annoncés (contre-recette du 2026-11-25, N2) :
 * sans eux, le menu du tour de table ne proposait que « OpenCode », sans dire quel modèle
 * répondrait. L'agent est essayé hors conversation, par l'essai du diagnostic (`agent-check.ts` :
 * session supprimée aussitôt, aucune chez un agent qui ne sait pas la supprimer ni en profil
 * jetable) ; les modèles annoncés sont retenus comme ceux d'une conversation (`noteModels`).
 *
 * Un essai à la fois par agent ; un essai sans modèle n'est pas refait avant `RETRY_MS`.
 */
import type { SessionControl } from '@shared/agent'
import { messageOf } from '@shared/errors'
import { modelControl } from '../agent/models-seen'
import { log } from '../log'

/** Un essai sans modèle n'est pas refait avant ce délai. */
export const RETRY_MS = 10 * 60_000

export interface AgentModelsDeps {
  /** Réglages de la session d'essai de l'agent ; `undefined` : aucune session ouverte. */
  check: (profileId: string) => Promise<readonly SessionControl[] | undefined>
  /** Retient les modèles annoncés (`SettingsStore.noteModels`). */
  note: (profileId: string, controls: readonly SessionControl[]) => void
  now?: () => number
}

/** Ce que le menu sait des modèles d'un agent sans session : en cours, ou inconnus. */
export type AgentModelsState = 'loading' | 'default'

export class AgentModels {
  private readonly deps: AgentModelsDeps
  private readonly loading = new Map<string, Promise<void>>()
  private readonly failedAt = new Map<string, number>()

  constructor(deps: AgentModelsDeps) {
    this.deps = deps
  }

  /** Lance l'essai s'il le faut ; rend l'état à montrer en attendant. */
  ensure(profileId: string): AgentModelsState {
    if (this.loading.has(profileId)) return 'loading'
    const failed = this.failedAt.get(profileId)
    if (failed !== undefined && this.now() - failed < RETRY_MS) return 'default'
    const done = this.load(profileId).finally(() => this.loading.delete(profileId))
    this.loading.set(profileId, done)
    return 'loading'
  }

  /** Essai en cours fini (essais). */
  settled(profileId: string): Promise<void> {
    return this.loading.get(profileId) ?? Promise.resolve()
  }

  private async load(profileId: string): Promise<void> {
    const controls = await this.deps.check(profileId).catch((error: unknown) => {
      log.warn(`Modèles de ${profileId} : essai de l'agent en échec (${messageOf(error)})`)
      return undefined
    })
    if (controls && modelControl(controls)?.options.length) {
      this.deps.note(profileId, controls)
      this.failedAt.delete(profileId)
      return
    }
    this.failedAt.set(profileId, this.now())
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }
}
