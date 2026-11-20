/**
 * Modèles refusés faute de connexion (fiche 210) : un agent qui liste les modèles d'un fournisseur
 * auquel il n'est pas (ou plus) connecté ne le dit qu'en refusant le message (OpenCode 2.2.5 :
 * `-32000` « provider authentication required »). L'app retient `(profil, modèle)` pour marquer ce
 * modèle « connexion à faire » dans le sélecteur, sans le retirer ni rien supposer de son
 * identifiant (jamais découpé en fournisseur / modèle), et sans jamais sonder un modèle.
 *
 * En mémoire seulement, une par app : oublié en quittant. Effacé par un tour réussi avec ce modèle,
 * ou pour tout le profil à une reconnexion (« Réessayer » de la carte, `authenticate`).
 */
import type { SessionControl } from '@shared/agent'
import { modelControl } from './models-seen'
import { currentModel } from './session-controls'
import { modelProvider } from '@shared/models'
import { isFreeModel } from '@shared/usage'

/** Vue d'un profil, telle que l'hôte d'agent la reçoit. */
export interface RefusedModelsOfProfile {
  has: (model: string) => boolean
  add: (model: string) => void
  remove: (model: string) => void
  clear: () => void
  /** A répondu une fois avec ce profil (fiche 266) : jamais « connexion sans doute à faire ». */
  answered?: (model: string) => boolean
}

export class RefusedModels {
  private readonly byProfile = new Map<string, Set<string>>()
  /** Modèles qui ont répondu, par profil (fiche 266) : leur connexion est faite. */
  private readonly answeredBy = new Map<string, Set<string>>()

  has(profileId: string, model: string): boolean {
    return this.byProfile.get(profileId)?.has(model) === true
  }

  add(profileId: string, model: string): void {
    const models = this.byProfile.get(profileId) ?? new Set<string>()
    models.add(model)
    this.byProfile.set(profileId, models)
  }

  /** Tour réussi avec ce modèle : plus refusé, et sa connexion est faite. */
  remove(profileId: string, model: string): void {
    this.byProfile.get(profileId)?.delete(model)
    const answered = this.answeredBy.get(profileId) ?? new Set<string>()
    answered.add(model)
    this.answeredBy.set(profileId, answered)
  }

  answered(profileId: string, model: string): boolean {
    return this.answeredBy.get(profileId)?.has(model) === true
  }

  clear(profileId: string): void {
    this.byProfile.delete(profileId)
  }

  of(profileId: string): RefusedModelsOfProfile {
    return {
      has: (model) => this.has(profileId, model),
      add: (model) => this.add(profileId, model),
      remove: (model) => this.remove(profileId, model),
      answered: (model) => this.answered(profileId, model),
      clear: () => this.clear(profileId)
    }
  }
}

/**
 * Réglages de l'instantané, avec `authRequired` sur les options refusées du réglage de modèle, et
 * `authLikely` (fiche 266, D31) sur celles du même fournisseur, lu dans le nom affiché
 * (`modelProvider`), sauf le modèle choisi, un modèle qui se dit gratuit ou qui a déjà répondu.
 * Inchangés (même tableau) sans réglage de modèle ou sans modèle refusé.
 */
export function markRefused(
  controls: SessionControl[],
  refused: Pick<RefusedModelsOfProfile, 'has' | 'answered'> | undefined
): SessionControl[] {
  const model = modelControl(controls)
  if (!refused || !model || !model.options.some((o) => refused.has(o.value))) return controls
  const providers = new Set(
    model.options.flatMap((o) => {
      const provider = refused.has(o.value) ? modelProvider(o.name) : undefined
      return provider ? [provider] : []
    })
  )
  const likely = (o: SessionControl['options'][number]): boolean => {
    const provider = modelProvider(o.name)
    return (
      provider !== undefined &&
      providers.has(provider) &&
      o.value !== model.currentValue &&
      !isFreeModel(o) &&
      refused.answered?.(o.value) !== true
    )
  }
  return controls.map((control) =>
    control !== model
      ? control
      : {
          ...control,
          options: control.options.map((o) =>
            refused.has(o.value)
              ? { ...o, authRequired: true as const }
              : likely(o)
                ? { ...o, authLikely: true as const }
                : o
          )
        }
  )
}

/** Tour réussi : le modèle de la session a répondu, il n'est plus « connexion à faire ». */
export function noteAnswered(
  refused: Pick<RefusedModelsOfProfile, 'remove'> | undefined,
  controls: readonly SessionControl[]
): void {
  const model = currentModel(controls)
  if (refused && model) refused.remove(model.id)
}
