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
import type { AddFolderResult } from '@shared/extra-folders'
import {
  checkExtraFolder,
  folderKey,
  isUnder,
  NATIVE_FOLDER_SYSTEM,
  plainKey,
  type FolderSystem
} from './extra-folder-check'
import type { ConversationManager } from './manager'

export type DirectoriesManager = Pick<ConversationManager, 'updateRecord' | 'restart'>
type Manager = DirectoriesManager

/** Ce qu'il faut de la fiche avant de lire le disque : statut, dossier de travail, liste. */
function peek(manager: Manager, id: string) {
  let seen = { workspace: '', folders: [] as readonly string[] }
  const status = manager.updateRecord(id, (record) => {
    seen = { workspace: record.workspace, folders: [...(record.additionalDirectories ?? [])] }
    return false
  })
  return { status, ...seen }
}

/** Clés (chemin réel, ou normalisé si absent ou figé) des dossiers déjà là, lues avant l'écriture. */
async function keysOf(folders: readonly string[], sys: FolderSystem) {
  return new Map(await Promise.all(folders.map(async (f) => [f, await folderKey(f, sys)] as const)))
}

/**
 * Ajoute un dossier à la conversation, d'où que vienne le chemin (fenêtre native, saisie, dossier
 * glissé : fiche 290). Tout ce qui lit le disque est asynchrone et borné : le chemin
 * (`checkExtraFolder`), le dossier de travail et les dossiers déjà là (`folderKey`). Puis, dans
 * la section synchrone d'écriture, une comparaison de chaînes sur la liste fraîche : deux ajouts
 * concurrents du même dossier ne passent pas tous les deux. Pendant une réponse : `busy` (la
 * session ne peut pas repartir), rien d'écrit. Agent prêt et liste changée : session rouverte.
 */
export async function addAdditionalDirectory(
  manager: Manager,
  id: string,
  input: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
): Promise<AddFolderResult> {
  const before = peek(manager, id)
  if (before.status === 'busy') return { ok: false, reason: 'busy' }
  const checked = await checkExtraFolder(input, sys)
  if (!checked.ok) return checked
  const { folder } = checked
  const key = plainKey(folder, sys)
  const workspaceKey = await folderKey(before.workspace, sys)
  if (key === workspaceKey) return { ok: false, reason: 'isWorkspace', folder }
  if (isUnder(key, workspaceKey, sys.path)) return { ok: false, reason: 'insideWorkspace', folder }
  const keys = await keysOf(before.folders, sys)
  let result: AddFolderResult = { ok: true, folder }
  const status = manager.updateRecord(id, (record, current) => {
    if (current === 'busy') result = { ok: false, reason: 'busy' }
    else {
      const list = record.additionalDirectories ?? []
      // Ajoutés depuis la lecture : déjà réels (fiche 290), comparés sans lire le disque.
      if (list.some((f) => (keys.get(f) ?? plainKey(f, sys)) === key))
        result = { ok: false, reason: 'alreadyAdded', folder }
      else record.additionalDirectories = [...list, folder]
    }
    return result.ok
  })
  if (result.ok && status === 'ready') await manager.restart(id)
  return result
}

/**
 * Retire un dossier de la conversation : la même comparaison que l'ajout (chemin réel, ou
 * normalisé). Pendant une réponse : erreur levée (le bouton est déjà désactivé avec sa raison).
 */
export async function removeAdditionalDirectory(
  manager: Manager,
  id: string,
  folder: string,
  sys: FolderSystem = NATIVE_FOLDER_SYSTEM
): Promise<void> {
  const before = peek(manager, id)
  if (before.status === 'busy') throw new Error(t('conversations.error.busyFolders'))
  const target = await folderKey(folder, sys)
  const keys = await keysOf(before.folders, sys)
  let changed = false
  const status = manager.updateRecord(id, (record, current) => {
    if (current === 'busy') throw new Error(t('conversations.error.busyFolders'))
    const list = record.additionalDirectories ?? []
    const kept = list.filter((f) => (keys.get(f) ?? plainKey(f, sys)) !== target)
    changed = kept.length !== list.length
    if (!changed) return false
    if (kept.length > 0) record.additionalDirectories = kept
    else delete record.additionalDirectories
    return true
  })
  if (changed && status === 'ready') await manager.restart(id)
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
