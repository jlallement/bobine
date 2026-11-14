/**
 * Canaux IPC des rôles (fiche 223), sortis de `ipc.ts` (taille bornée, fiche 089) : le contrat
 * `IpcInvokeContract` les reprend (`extends`), `IPC_CHANNELS` aussi. Ils servent Réglages › Rôles,
 * le menu `@` de la saisie (`roles:startChildren`, phase 3B) et l'assistant de création.
 *
 * Le projet est désigné par une conversation (`conversationId`), jamais par un chemin venu du
 * renderer : le main en déduit le dossier (celui de la mère pour une fille).
 */
import type {
  Role,
  RoleDefinition,
  RoleError,
  RoleFileScope,
  RoleScope,
  RolesListing
} from './roles'
import type {
  RoleExportOptions,
  RoleExportPreview,
  RoleExportRef,
  RoleExportRemoveResult,
  RoleExportResult,
  RoleExportStatus,
  RoleExportTarget
} from './role-export'

/** `@rôle …` envoyé depuis la saisie : une fille par rôle cité, avec le même texte (phase 3B). */
export interface RolesStartRequest {
  /** Noms des rôles (`security-expert`), dans l'ordre du message ; doublons ignorés. */
  roles: string[]
  /** La demande, sans les `@rôle`. */
  text: string
}

/** Ce qui est parti : une fille par rôle lancé, et pourquoi un rôle n'a pas pu partir. */
export interface RolesStartResult {
  started: { role: string; childId: string }[]
  failed: { role: string; error: string }[]
}

/** Rôles cités au plus dans un message (au-delà, refusé : le plafond des filles tranche avant). */
export const MAX_ROLES_PER_MESSAGE = 10

export interface RolesIpcContract extends RoleExportIpcContract {
  /** Rôles connus (fournis, personnels, du projet de la conversation), actifs ou non, et fichiers écartés. */
  'roles:list': { args: [conversationId?: string]; result: RolesListing }
  /** Définition d'un rôle d'une portée, pour le formulaire ; `null` s'il n'y est pas. */
  'roles:read': {
    args: [scope: RoleScope, name: string, conversationId?: string]
    result: Role | null
  }
  /** Écrit un rôle personnel ou du projet ; `previousName` : renommage. */
  'roles:save': {
    args: [
      scope: RoleFileScope,
      role: RoleDefinition,
      options?: { conversationId?: string; previousName?: string }
    ]
    result: { ok: true } | { ok: false; error: RoleError }
  }
  /** Active ou désactive un rôle, par nom (toutes portées). */
  'roles:setEnabled': { args: [name: string, enabled: boolean]; result: undefined }
  /** Supprime le fichier d'un rôle personnel ou du projet ; `false` s'il n'existe pas. */
  'roles:remove': {
    args: [scope: RoleFileScope, name: string, conversationId?: string]
    result: boolean
  }
  /**
   * Lance une fille par rôle cité, depuis la conversation `conversationId` (sa mère) : l'envoi
   * vient de l'utilisateur, aucune carte d'accord. L'agent et le modèle du rôle sont repris quand
   * le profil le permet, comme pour `start_child`.
   */
  'roles:startChildren': {
    args: [conversationId: string, request: RolesStartRequest]
    result: RolesStartResult
  }
}

/**
 * Installer un rôle dans un agent (phase 4, ADR-0047) : agents proposés = profils qui déclarent
 * `roleExport` (`ProfileSummary.roleExport`). Le rôle est désigné comme dans Réglages › Rôles.
 */
export interface RoleExportIpcContract {
  /** Ce qui serait écrit, et où (feuille « Installer dans… »). */
  'roles:exportPreview': {
    args: [role: RoleExportRef, profileId: string]
    result: RoleExportPreview
  }
  /** Installe ou met à jour ; refusé sans rien changer si l'entrée n'est pas à Bobine. */
  'roles:export': {
    args: [role: RoleExportRef, target: RoleExportTarget, options: RoleExportOptions]
    result: RoleExportResult
  }
  /** Installations de ce rôle (projet : celles du dossier de la conversation). */
  'roles:exportStatus': { args: [role: RoleExportRef]; result: RoleExportStatus[] }
  /** Installations dont le rôle n'existe plus (renommé, supprimé) : Réglages › Rôles. */
  'roles:exportOrphans': { args: [conversationId?: string]; result: RoleExportStatus[] }
  /** Retire l'entrée de Bobine ; `force` : même modifiée à la main (après confirmation). */
  'roles:exportRemove': { args: [key: string, force?: boolean]; result: RoleExportRemoveResult }
}

export const ROLES_CHANNELS = [
  'roles:list',
  'roles:read',
  'roles:save',
  'roles:setEnabled',
  'roles:remove',
  'roles:startChildren',
  'roles:exportPreview',
  'roles:export',
  'roles:exportStatus',
  'roles:exportOrphans',
  'roles:exportRemove'
] as const

export type RolesChannel = (typeof ROLES_CHANNELS)[number]
