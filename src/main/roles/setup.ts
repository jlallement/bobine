/**
 * Rôles de l'app (fiche 223) : la bibliothèque (rôles personnels dans `<données>/roles/`, noms
 * désactivés dans les réglages), l'installation des rôles dans les agents (phase 4 : registre et
 * copies dans `<données>/role-exports/`) et ce que demandent leurs canaux IPC.
 */
import { join } from 'node:path'
import type { ChildConversations, ChildOptions } from '../conversations/children'
import type { ConversationManager } from '../conversations/manager'
import { log } from '../log'
import type { SettingsStore } from '../settings-store'
import { builtinRoles } from './builtin'
import type { ExportLocations } from './export/format'
import { RoleExportRegistry } from './export/registry'
import { RoleExports, type ExportProfile } from './export/service'
import type { RolesIpcDeps } from './ipc'
import { RoleLibrary } from './library'

export function appRoles(
  userData: string,
  settings: Pick<SettingsStore, 'rolesOff' | 'setRoleEnabled'>,
  /** Conversations, et leurs filles (`@rôle` de la saisie, phase 3B) : créées après. */
  live: () => {
    conversations: Pick<ConversationManager, 'state'>
    children?: ChildConversations | undefined
  },
  /** Profils et dossier personnel de leurs fichiers (jamais les vrais dans les essais). */
  agents: { profiles: readonly ExportProfile[]; locations: ExportLocations }
): {
  library: RoleLibrary
  exports: RoleExports
  ipc: RolesIpcDeps
  /** Ce que les conversations filles en reçoivent (`setupChildren`). */
  forChildren: Pick<ChildOptions, 'roles' | 'nativeRoleMode'>
} {
  const library = new RoleLibrary({
    userDir: join(userData, 'roles'),
    builtin: builtinRoles,
    off: () => settings.rolesOff(),
    setEnabled: (name, enabled) => settings.setRoleEnabled(name, enabled),
    log: (message) => log.info(message)
  })
  const exports = new RoleExports({
    profiles: () => agents.profiles,
    locations: agents.locations,
    registry: new RoleExportRegistry(join(userData, 'role-exports', 'registry.json')),
    backupDir: join(userData, 'role-exports', 'backups'),
    log: (message) => log.info(message)
  })
  // Le projet d'une fille est le dossier de sa mère : un rôle non commité n'est pas dans son worktree.
  const folderOf = (id: string) => {
    const list = live().conversations.state().conversations
    const conversation = list.find((c) => c.id === id)
    if (!conversation) return undefined
    const mother =
      conversation.startedFrom && list.find((c) => c.id === conversation.startedFrom?.id)
    return (mother ?? conversation).workspace || undefined
  }
  return {
    library,
    exports,
    ipc: { library, folderOf, children: () => live().children, exports },
    forChildren: {
      roles: library,
      nativeRoleMode: (profileId, role, conversationId) =>
        exports.nativeMode(profileId, role, folderOf(conversationId))
    }
  }
}
