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
import type { Role } from '@shared/roles'
import type { RoleLibrary } from '../library'
import { roleToExport, type RoleExports, type RoleToExport } from './service'

export interface RoleExportIpcDeps {
  exports: RoleExports
  library: Pick<RoleLibrary, 'definition'>
  /** Dossier du projet d'une conversation (celui de la mère pour une fille). */
  folderOf: (conversationId: string) => string | undefined
}

type RoleExportChannel =
  'roles:exportPreview' | 'roles:export' | 'roles:exportStatus' | 'roles:exportRemove'

/** Description traduite de chaque rôle fourni (`builtin.ts`), comme dans Réglages › Rôles. */
const BUILTIN_DESCRIPTIONS: Record<string, () => string> = {
  'ux-ui-expert': () => t('rolesSettings.builtinDescription.uxUiExpert'),
  'flutter-expert': () => t('rolesSettings.builtinDescription.flutterExpert'),
  'front-architect': () => t('rolesSettings.builtinDescription.frontArchitect'),
  'back-architect': () => t('rolesSettings.builtinDescription.backArchitect'),
  'security-expert': () => t('rolesSettings.builtinDescription.securityExpert'),
  'tech-lead': () => t('rolesSettings.builtinDescription.techLead'),
  'code-reviewer': () => t('rolesSettings.builtinDescription.codeReviewer')
}

/**
 * Description écrite dans l'agent : dans la langue de l'interface pour un rôle fourni (elle
 * s'affiche dans la liste des modes de l'agent), telle quelle sinon.
 */
export function exportedDescription(role: Pick<Role, 'name' | 'scope' | 'description'>): string {
  if (role.scope !== 'builtin') return role.description
  return BUILTIN_DESCRIPTIONS[role.name]?.() ?? role.description
}

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
      role: roleToExport(role, exportedDescription(role)),
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
    'roles:exportRemove': (key, force) => {
      if (typeof key !== 'string' || !key) throw new Error('Paramètre invalide : key')
      if (force !== undefined && typeof force !== 'boolean') {
        throw new Error('Paramètre invalide : force')
      }
      return available().exports.remove(key, force === true)
    }
  }
}
