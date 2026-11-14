/**
 * Gestes des rôles partagés par la fenêtre (fiche 223, phase 3A) : un seul point d'entrée pour
 * ouvrir l'assistant de création (`openRoleWizard`, éventuellement prérempli) et pour confier un
 * travail à un rôle (`openRoleChild`). Les écrans qui les appellent (section Équipe, Réglages ›
 * Rôles, menu `@` et « Enregistrer comme rôle » de la phase 3B) n'ont rien à recevoir en
 * propriété : `RolesHost`, monté une fois avec les dialogues de l'app, les affiche.
 *
 * `rolesChanged` prévient les listes ouvertes après un enregistrement ; elles se relisent aussi
 * quand la fenêtre reprend le focus (un fichier de rôle modifié à la main, un `git pull`).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { RolesListing } from '@shared/roles'
import type { RoleDraft } from './role-draft'

export interface RolesUiState {
  /** Assistant ouvert, avec son préremplissage ; `seq` change à chaque ouverture. */
  wizard: { prefill: Partial<RoleDraft>; seq: number } | null
  /** « Confier à ce rôle » ouvert : le nom du rôle. */
  child: { role: string; seq: number } | null
  /** Change à chaque rôle enregistré, supprimé, activé ou désactivé. */
  version: number
}

let state: RolesUiState = { wizard: null, child: null, version: 0 }
let seq = 0
const listeners = new Set<() => void>()

function update(next: Partial<RolesUiState>): void {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Ouvre l'assistant de création d'un rôle (3 étapes). `prefill` : champs déjà remplis (menu `@`
 * avec le texte tapé, « Enregistrer comme rôle » avec la consigne d'une fille…) ; un libellé sans
 * nom donne le nom, une icône ou une couleur données ne sont plus suggérées.
 */
export function openRoleWizard(prefill: Partial<RoleDraft> = {}): void {
  update({ wizard: { prefill, seq: ++seq } })
}

export function closeRoleWizard(): void {
  update({ wizard: null })
}

/** Ouvre « Confier à <rôle> » : une consigne, puis une conversation fille avec ce rôle. */
export function openRoleChild(role: string): void {
  update({ child: { role, seq: ++seq } })
}

export function closeRoleChild(): void {
  update({ child: null })
}

/** Un rôle a été enregistré, supprimé, activé ou désactivé : les listes se relisent. */
export function rolesChanged(): void {
  update({ version: state.version + 1 })
}

export function useRolesUi(): RolesUiState {
  return useSyncExternalStore(subscribe, () => state)
}

/** Remet l'état à zéro (essais). */
export function resetRolesUi(): void {
  state = { wizard: null, child: null, version: 0 }
}

/**
 * Rôles connus pour le projet de cette conversation (`roles:list`), relus après un changement et
 * au retour du focus. `null` tant que la première lecture n'est pas arrivée ; une lecture qui
 * échoue laisse la dernière liste (et `error`).
 */
export function useRolesListing(conversationId?: string | null): {
  listing: RolesListing | null
  error: unknown
  reload: () => void
} {
  const { version } = useRolesUi()
  const [listing, setListing] = useState<RolesListing | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [focusSeq, setFocusSeq] = useState(0)
  const reload = useCallback(() => setFocusSeq((n) => n + 1), [])
  useEffect(() => {
    const onFocus = () => setFocusSeq((n) => n + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  useEffect(() => {
    let alive = true
    const roles = window.api.roles as typeof window.api.roles | undefined
    if (!roles) return
    roles.list(conversationId ?? undefined).then(
      (next) => {
        if (!alive) return
        setListing(next)
        setError(null)
      },
      (e: unknown) => alive && setError(e)
    )
    return () => {
      alive = false
    }
  }, [conversationId, version, focusSeq])
  return { listing, error, reload }
}
