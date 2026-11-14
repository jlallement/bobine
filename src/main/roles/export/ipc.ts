/**
 * Canaux IPC de l'installation des rôles dans les agents (fiche 223, phase 4), branchés par
 * `roles/ipc.ts`. Les arguments viennent du renderer : vérifiés ici ; le rôle est relu par le main
 * (jamais un texte ou un chemin du renderer), le projet déduit de la conversation.
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import {
  parseRoleExportOptions,
  parseRoleExportRef,
  parseRoleExportTarget,
  type RoleExportRef
} from '@shared/role-export'
import type { RoleLibrary } from '../library'
import { roleToExport, type RoleExports, type RoleToExport } from './service'

export interface RoleExportIpcDeps {
  exports: RoleExports
  library: Pick<RoleLibrary, 'definition' | 'list'>
  /** Dossier du projet d'une conversation (celui de la mère pour une fille). */
  folderOf: (conversationId: string) => string | undefined
}

type RoleExportChannel =
  | 'roles:exportPreview'
  | 'roles:export'
  | 'roles:exportStatus'
  | 'roles:exportOrphans'
  | 'roles:exportRemove'

export function roleExportHandlers(
  deps: () => RoleExportIpcDeps | undefined
): Pick<IpcHandlers, RoleExportChannel> {
  const available = () => {
    const found = deps()
    if (!found) throw new Error(t('ipc.unavailable.roles'))
    return found
  }
  const resolve = (value: unknown): { role: RoleToExport; folder?: string } => {
    const ref: RoleExportRef = parseRoleExportRef(value)
    const d = available()
    const folder = ref.conversationId ? d.folderOf(ref.conversationId) : undefined
    const role = d.library.definition(ref.scope, ref.name, folder)
    if (!role) throw new Error(t('rolesSettings.edit.missing'))
    return {
      // Rôle fourni : textes dans la langue de l'interface (ADR-0046), relus à chaque appel.
      role: roleToExport(role),
      ...(folder ? { folder } : {})
    }
  }
  const profileId = (value: unknown) => {
    if (typeof value !== 'string' || !value) throw new Error('Paramètre invalide : profileId')
    return value
  }
  return {
    'roles:exportPreview': (ref, profile) => {
      const { role, folder } = resolve(ref)
      return available().exports.preview(role, profileId(profile), folder)
    },
    'roles:export': (ref, target, options) => {
      const { role, folder } = resolve(ref)
      return available().exports.install(
        role,
        parseRoleExportTarget(target),
        folder,
        parseRoleExportOptions(options)
      )
    },
    'roles:exportStatus': (ref) => {
      const { role, folder } = resolve(ref)
      return available().exports.status(role, folder)
    },
    'roles:exportOrphans': (conversationId) => {
      const d = available()
      if (conversationId !== undefined && (typeof conversationId !== 'string' || !conversationId)) {
        throw new Error('Paramètre invalide : conversationId')
      }
      const folder = conversationId ? d.folderOf(conversationId) : undefined
      // Tous les rôles connus, actifs ou non : un rôle désactivé n'est pas « sans rôle ».
      const names = new Set(d.library.list(folder).roles.map((r) => r.name))
      return d.exports.orphans((name) => names.has(name), folder)
    },
    'roles:exportRemove': (key, force) => {
      if (typeof key !== 'string' || !key) throw new Error('Paramètre invalide : key')
      if (force !== undefined && typeof force !== 'boolean') {
        throw new Error('Paramètre invalide : force')
      }
      return available().exports.remove(key, force === true)
    }
  }
}
