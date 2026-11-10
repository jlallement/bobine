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

/** Vue d'un profil, telle que l'hôte d'agent la reçoit. */
export interface RefusedModelsOfProfile {
  has: (model: string) => boolean
  add: (model: string) => void
  remove: (model: string) => void
  clear: () => void
}

export class RefusedModels {
  private readonly byProfile = new Map<string, Set<string>>()

  has(profileId: string, model: string): boolean {
    return this.byProfile.get(profileId)?.has(model) === true
  }

  add(profileId: string, model: string): void {
    const models = this.byProfile.get(profileId) ?? new Set<string>()
    models.add(model)
    this.byProfile.set(profileId, models)
  }

  remove(profileId: string, model: string): void {
    this.byProfile.get(profileId)?.delete(model)
  }

  clear(profileId: string): void {
    this.byProfile.delete(profileId)
  }

  of(profileId: string): RefusedModelsOfProfile {
    return {
      has: (model) => this.has(profileId, model),
      add: (model) => this.add(profileId, model),
      remove: (model) => this.remove(profileId, model),
      clear: () => this.clear(profileId)
    }
  }
}

/**
 * Réglages de l'instantané, avec `authRequired` sur les options refusées du réglage de modèle.
 * Inchangés (même tableau) sans réglage de modèle ou sans modèle refusé.
 */
export function markRefused(
  controls: SessionControl[],
  refused: Pick<RefusedModelsOfProfile, 'has'> | undefined
): SessionControl[] {
  const model = modelControl(controls)
  if (!refused || !model || !model.options.some((o) => refused.has(o.value))) return controls
  return controls.map((control) =>
    control !== model
      ? control
      : {
          ...control,
          options: control.options.map((o) =>
            refused.has(o.value) ? { ...o, authRequired: true as const } : o
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
