/**
 * Autres dossiers d'une conversation (fiche 179) : ajoutés ou retirés par l'utilisateur, mémorisés
 * dans sa fiche, donnés à l'agent à l'ouverture de la session (`additionalDirectories`, si
 * l'agent les prend : `agent/additional-directories.ts`). Le protocole ne prévoit pas de les
 * changer en cours de session : agent prêt, la session est rouverte (comme « Relancer » : même
 * session, fil gardé).
 */
import { isAbsolute, resolve } from 'node:path'
import { t } from 'i18next'
import type { ConversationManager } from './manager'

export type DirectoriesManager = Pick<ConversationManager, 'updateRecord' | 'restart'>
type Manager = DirectoriesManager

/** Change la liste des autres dossiers ; rouvre la session si l'agent est prêt. */
async function changeDirectories(
  manager: Manager,
  id: string,
  edit: (current: readonly string[]) => readonly string[]
): Promise<void> {
  let changed = false
  const status = manager.updateRecord(id, (record, current) => {
    // Pendant une réponse, la session ne peut pas être rouverte : rien ne change.
    if (current === 'busy') throw new Error(t('conversations.error.busyFolders'))
    const before = record.additionalDirectories ?? []
    const workspace = resolve(record.workspace)
    const kept = normalize(edit(before)).filter((f) => f !== workspace)
    changed = kept.join('\n') !== before.join('\n')
    if (kept.length > 0) record.additionalDirectories = kept
    else delete record.additionalDirectories
  })
  if (changed && status === 'ready') await manager.restart(id)
}

/** Ajoute un dossier à la conversation (sans doublon, ni le dossier de travail lui-même). */
export function addAdditionalDirectory(manager: Manager, id: string, folder: string) {
  return changeDirectories(manager, id, (current) => [...current, folder])
}

/** Retire un dossier de la conversation. */
export function removeAdditionalDirectory(manager: Manager, id: string, folder: string) {
  return changeDirectories(manager, id, (current) => current.filter((f) => f !== folder))
}

/** Titre et bouton du dialogue « Ajouter un dossier à la conversation ». */
export function dialogLabels(): { title: string; buttonLabel: string } {
  return { title: t('dialogs.extraFolder.title'), buttonLabel: t('dialogs.extraFolder.button') }
}

/** Chemins absolus, normalisés, sans doublon, dans l'ordre donné. */
export function normalize(folders: readonly string[]): string[] {
  return [...new Set(folders.filter((f) => isAbsolute(f)).map((f) => resolve(f)))]
}
