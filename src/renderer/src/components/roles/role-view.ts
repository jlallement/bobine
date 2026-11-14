/**
 * Ce que l'interface dit d'un rôle au travail (fiche 223, phase 3B), sans React : l'agent qui le
 * fera tourner et sa lecture seule telle qu'elle sera (garantie, ou seulement demandée à un agent
 * qui écrit sans demander, `ProfileSummary.writesWithoutAsking`). Aucun nom d'agent n'est testé
 * ici : seule la capacité déclarée par le profil compte (ADR-0011).
 */
import type { ProfileSummary } from '@shared/agent'
import type { RoleDefinition, RoleView } from '@shared/roles'
import { shownDescription } from '../../roles/role-text'

type Profiles = readonly Pick<
  ProfileSummary,
  'id' | 'label' | 'available' | 'writesWithoutAsking'
>[]

/** Profil de la fille d'un rôle : celui du rôle s'il est disponible, sinon celui de la mère. */
export function roleProfile(
  role: Pick<RoleDefinition, 'agent'>,
  profiles: Profiles,
  motherProfileId: string | undefined
): Profiles[number] | undefined {
  if (role.agent) {
    const wanted = role.agent.toLowerCase()
    const found =
      profiles.find((p) => p.id.toLowerCase() === wanted) ??
      profiles.find((p) => p.label.toLowerCase() === wanted)
    if (found?.available) return found
  }
  return profiles.find((p) => p.id === motherProfileId)
}

/**
 * Lecture seule d'une fille telle qu'elle sera : `enforced` (l'agent demande avant d'écrire,
 * Bobine refuse), `requested` (l'agent écrit sans demander : seulement demandée, dossier
 * surveillé), rien pour un rôle qui écrit.
 */
export function readOnlyShown(
  readOnly: boolean | undefined,
  profile: Pick<ProfileSummary, 'writesWithoutAsking'> | undefined
): 'enforced' | 'requested' | undefined {
  if (!readOnly) return undefined
  return profile?.writesWithoutAsking ? 'requested' : 'enforced'
}

/**
 * Description d'un rôle telle que l'interface l'affiche et la cherche (menu `@`, jeton, infobulles,
 * Réglages › Rôles, section Équipe) : le seul endroit où l'interface la lit. Traduite pour un rôle
 * fourni (`shownDescription`), celle du fichier sinon ; l'agent, lui, reçoit toujours celle du
 * fichier (ADR-0014).
 */
export function roleDescription(role: Pick<RoleView, 'name' | 'scope' | 'description'>): string {
  return shownDescription(role)
}
