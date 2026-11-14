/**
 * Rôles de l'app (fiche 223) : la bibliothèque (rôles personnels dans `<données>/roles/`, noms
 * désactivés dans les réglages) et ce que demandent ses canaux IPC.
 */
import { join } from 'node:path'
import type { ConversationManager } from '../conversations/manager'
import { log } from '../log'
import type { SettingsStore } from '../settings-store'
import { builtinRoles } from './builtin'
import type { RolesIpcDeps } from './ipc'
import { RoleLibrary } from './library'

export function appRoles(
  userData: string,
  settings: Pick<SettingsStore, 'rolesOff' | 'setRoleEnabled'>,
  conversations: () => Pick<ConversationManager, 'state'>
): { library: RoleLibrary; ipc: RolesIpcDeps } {
  const library = new RoleLibrary({
    userDir: join(userData, 'roles'),
    builtin: builtinRoles,
    off: () => settings.rolesOff(),
    setEnabled: (name, enabled) => settings.setRoleEnabled(name, enabled),
    log: (message) => log.info(message)
  })
  // Le projet d'une fille est le dossier de sa mère : un rôle non commité n'est pas dans son worktree.
  const folderOf = (id: string) => {
    const list = conversations().state().conversations
    const conversation = list.find((c) => c.id === id)
    if (!conversation) return undefined
    const mother =
      conversation.startedFrom && list.find((c) => c.id === conversation.startedFrom?.id)
    return (mother ?? conversation).workspace || undefined
  }
  return { library, ipc: { library, folderOf } }
}
