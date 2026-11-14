/**
 * Canaux IPC des rôles (fiche 223), sortis de `ipc.ts` (taille bornée, fiche 089) : le contrat
 * `IpcInvokeContract` les reprend (`extends`), `IPC_CHANNELS` aussi. Pas encore d'écran (phase 3) :
 * ils servent Réglages › Rôles, le menu `@` et l'assistant de création.
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

export interface RolesIpcContract {
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
}

export const ROLES_CHANNELS = [
  'roles:list',
  'roles:read',
  'roles:save',
  'roles:setEnabled',
  'roles:remove'
] as const

export type RolesChannel = (typeof ROLES_CHANNELS)[number]
