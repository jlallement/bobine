/**
 * Gestes des rôles partagés par la fenêtre (fiche 223) : un seul point d'entrée pour ouvrir
 * l'assistant de création (`openRoleWizard`, éventuellement prérempli) et pour confier un travail
 * à un rôle (`invokeRole` : le jeton `@rôle` dans la saisie, le seul chemin pour invoquer un rôle
 * depuis l'interface). Les écrans qui les appellent (section Équipe, Réglages › Rôles, menu `@`,
 * « Enregistrer comme rôle » d'une fille) n'ont rien à recevoir en propriété : `RolesHost`, monté
 * une fois avec les dialogues de l'app, affiche l'assistant ; la saisie reçoit les jetons.
 *
 * `rolesChanged` prévient les listes ouvertes après un enregistrement ; elles se relisent aussi
 * quand la fenêtre reprend le focus (un fichier de rôle modifié à la main, un `git pull`) et quand
 * la langue de l'interface change (rôles fournis dans la nouvelle langue, ADR-0046).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import type { RolesListing } from '@shared/roles'
import type { RoleDraft } from './role-draft'

export interface RolesUiState {
  /** Assistant ouvert, avec son préremplissage ; `seq` change à chaque ouverture. */
  wizard: { prefill: Partial<RoleDraft>; seq: number } | null
  /** Change à chaque rôle enregistré, supprimé, activé ou désactivé. */
  version: number
}

let state: RolesUiState = { wizard: null, version: 0 }
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

/**
 * Assistant ouvert depuis le menu `@` (« + Nouveau rôle », « Créer un rôle ») : ce qui était tapé
 * après `@` devient le nom du rôle (`perf-expert` → « Perf expert », identifiant `perf-expert`).
 */
export function openRoleWizardNamed(typed?: string): void {
  openRoleWizard(typed?.trim() ? { label: roleLabelFromTyped(typed) } : {})
}

/** `perf-expert` → « Perf expert » : tirets et soulignés en espaces, première lettre en capitale. */
export function roleLabelFromTyped(typed: string): string {
  const words = typed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function closeRoleWizard(): void {
  update({ wizard: null })
}

const invoked = new Set<(name: string) => void>()
/** Rôle invoqué sans saisie montée (page « Mon activité »…) : remis à la prochaine, peu après. */
let waiting: { name: string; at: number } | null = null
const WAITING_MS = 10_000

/**
 * Confie un travail à un rôle : son jeton `@rôle` est posé dans la saisie de la conversation
 * affichée, qui prend le focus ; l'utilisateur écrit sa demande et envoie (une fille avec ce rôle,
 * fiche 223 phase 3B). `false` si aucune saisie ne l'a reçu : il attend alors (10 s) la prochaine
 * qui s'abonne — l'appelant ramène la conversation à l'écran.
 */
export function invokeRole(name: string): boolean {
  if (invoked.size === 0) {
    waiting = { name, at: Date.now() }
    return false
  }
  waiting = null
  for (const listener of invoked) listener(name)
  return true
}

/** La saisie qui reçoit les jetons (celle de la conversation affichée) ; rend le désabonnement. */
export function onRoleInvoked(listener: (name: string) => void): () => void {
  invoked.add(listener)
  const pending = waiting
  waiting = null
  if (pending && Date.now() - pending.at < WAITING_MS) listener(pending.name)
  return () => invoked.delete(listener)
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
  state = { wizard: null, version: 0 }
  waiting = null
}

/**
 * Rôles connus pour le projet de cette conversation (`roles:list`), relus après un changement, au
 * retour du focus et au changement de langue (le main a déjà changé la sienne). `null` tant que la première lecture n'est pas arrivée ; une lecture qui
 * échoue laisse la dernière liste (et `error`).
 */
export function useRolesListing(conversationId?: string | null): {
  listing: RolesListing | null
  error: unknown
  reload: () => void
} {
  const { version } = useRolesUi()
  const { i18n } = useTranslation()
  const language = i18n.language
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
  }, [conversationId, version, focusSeq, language])
  return { listing, error, reload }
}
