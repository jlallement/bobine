/**
 * Autres dossiers d'une conversation (fiche 179) : ajoutés ou retirés par l'utilisateur, mémorisés
 * dans sa fiche, donnés à l'agent à l'ouverture de la session (`additionalDirectories`, si
 * l'agent les prend : `agent/additional-directories.ts`). Le protocole ne prévoit pas de les
 * changer en cours de session : agent prêt, la session est rouverte (comme « Relancer » : même
 * session, fil gardé).
 */
import { accessSync, constants, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
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

/** Ce qu'il faut savoir d'une conversation pour ouvrir la fenêtre de choix à côté d'elle. */
export interface FolderPlace {
  workspace: string
  space?: string
  /** Racine du dépôt d'une conversation en worktree (`ConversationSummary.project`). */
  project?: string
  branch?: string
  /** Son worktree, s'il est à elle seule : son dossier se retrouve dans le dépôt principal. */
  worktree?: { root: string; path: string }
}

/**
 * Où ouvrir la fenêtre « Ajouter un dossier… » (fiche 287) : le dossier parent du dossier de la
 * conversation, là où sont ses projets voisins — pour un worktree, celui de son dossier dans le
 * dépôt principal (le worktree vit dans un dossier de Bobine). `undefined` (macOS choisit, comme
 * avant) : discussion, pas de dossier, racine du disque, parent absent ou illisible.
 */
export function extraFolderStart(
  place: FolderPlace,
  readable: (dir: string) => boolean
): string | undefined {
  if (place.space || !place.workspace || !isAbsolute(place.workspace)) return undefined
  const { worktree } = place
  const folder = worktree
    ? join(worktree.root, relative(worktree.path, place.workspace))
    : place.branch && place.project
      ? place.project
      : place.workspace
  const parent = dirname(resolve(folder))
  if (parent === resolve(folder)) return undefined
  return readable(parent) ? parent : undefined
}

/** Un dossier qui existe et se lit (fiche 287). */
export function readableDirectory(dir: string): boolean {
  try {
    if (!statSync(dir).isDirectory()) return false
    accessSync(dir, constants.R_OK | constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** `extraFolderStart` d'une conversation du gestionnaire ; inconnue : `undefined`. */
export function extraFolderStartOf(
  manager: Pick<ConversationManager, 'state' | 'worktreeOf'>,
  id: string,
  readable: (dir: string) => boolean = readableDirectory
): string | undefined {
  const summary = manager.state().conversations.find((c) => c.id === id)
  if (!summary) return undefined
  let worktree: { root: string; path: string } | undefined
  try {
    worktree = manager.worktreeOf(id)?.worktree
  } catch {
    worktree = undefined
  }
  return extraFolderStart({ ...summary, ...(worktree ? { worktree } : {}) }, readable)
}

/** Chemins absolus, normalisés, sans doublon, dans l'ordre donné. */
export function normalize(folders: readonly string[]): string[] {
  return [...new Set(folders.filter((f) => isAbsolute(f)).map((f) => resolve(f)))]
}
