/**
 * Canaux IPC des rôles (fiche 223), branchés par `ipc.ts`. Les arguments viennent du renderer :
 * vérifiés ici ; le dossier du projet est déduit de la conversation par le main.
 */
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { RoleFileScope, RoleScope } from '@shared/roles'
import type { RolesChannel } from '@shared/roles-ipc'
import type { RoleLibrary } from './library'
import { parseRolesStartRequest, startRoleChildren, type RoleInvokeHost } from './invoke'
import { roleExportHandlers } from './export/ipc'
import type { RoleExports } from './export/service'

export interface RolesIpcDeps {
  library: RoleLibrary
  /** Dossier du projet d'une conversation (celui de la mère pour une fille) ; `undefined` sans dossier. */
  folderOf: (conversationId: string) => string | undefined
  /** Conversations filles (`@rôle` de la saisie) ; absentes : `roles:startChildren` refusé. */
  children?: () => RoleInvokeHost | undefined
  /** Installer un rôle dans un agent (phase 4) ; absent : canaux refusés. */
  exports?: RoleExports
}

const SCOPES: readonly RoleScope[] = ['builtin', 'user', 'project']

function scopeOf(value: unknown): RoleScope {
  if (!SCOPES.includes(value as RoleScope)) throw new Error('Paramètre invalide : scope')
  return value as RoleScope
}

function fileScope(value: unknown): RoleFileScope {
  const scope = scopeOf(value)
  if (scope === 'builtin') throw new Error(t('roles.error.builtinFile'))
  return scope
}

function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Paramètre invalide : name')
  return value.trim()
}

function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !value) throw new Error('Paramètre invalide : conversationId')
  return value
}

export function rolesHandlers(deps: RolesIpcDeps | undefined): Pick<IpcHandlers, RolesChannel> {
  const available = () => {
    if (!deps) throw new Error(t('ipc.unavailable.roles'))
    return deps
  }
  const folder = (conversationId: unknown) => {
    const id = optionalId(conversationId)
    return id ? available().folderOf(id) : undefined
  }
  return {
    ...roleExportHandlers(() =>
      deps?.exports
        ? { exports: deps.exports, library: deps.library, folderOf: deps.folderOf }
        : undefined
    ),
    'roles:list': (conversationId) => available().library.list(folder(conversationId)),
    'roles:read': (scope, roleName, conversationId) =>
      available().library.definition(scopeOf(scope), name(roleName), folder(conversationId)) ??
      null,
    'roles:save': (scope, role, options) => {
      const target = fileScope(scope)
      if (typeof role !== 'object' || role === null) throw new Error('Paramètre invalide : role')
      const o = (typeof options === 'object' && options !== null ? options : {}) as Record<
        string,
        unknown
      >
      const previous = o['previousName'] === undefined ? undefined : name(o['previousName'])
      const result = available().library.save(
        target,
        role as Parameters<RoleLibrary['save']>[1],
        folder(o['conversationId']),
        previous
      )
      return result.ok ? { ok: true } : result
    },
    'roles:setEnabled': (roleName, enabled) => {
      if (typeof enabled !== 'boolean') throw new Error('Paramètre invalide : enabled')
      available().library.setEnabled(name(roleName), enabled)
      return undefined
    },
    'roles:remove': (scope, roleName, conversationId) =>
      available().library.remove(fileScope(scope), name(roleName), folder(conversationId)),
    'roles:startChildren': (conversationId, request) => {
      const children = available().children?.()
      if (!children) throw new Error(t('ipc.unavailable.children'))
      const id = optionalId(conversationId)
      if (!id) throw new Error('Paramètre invalide : conversationId')
      return startRoleChildren(children, id, parseRolesStartRequest(request))
    }
  }
}
