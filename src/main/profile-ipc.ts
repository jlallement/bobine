/**
 * Canaux de l'intégrité du profil (fiches 196, 197) : état et avis du profil, corbeille des
 * conversations, restauration d'une sauvegarde. Les arguments viennent du renderer : vérifiés ici.
 * Le renderer ne donne jamais un chemin à montrer : il désigne un avis, le main sait son fichier.
 */
import { readOnlyError } from './read-only-error'
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import type { BackupCheck, TrashEntry } from '@shared/profile'
import { RELEASES_URL } from '@shared/profile'
import type { ProfileStatusStore } from './profile-status'
import { checkBackup } from './conversations/backup'
import { requestRestore } from './conversations/restore'
import type { ConversationTrash } from './conversations/trash'

type ProfileChannel =
  | 'profile:status'
  | 'profile:dismiss'
  | 'profile:reveal'
  | 'profile:openReleases'
  | 'trash:list'
  | 'trash:restore'
  | 'trash:erase'
  | 'backup:choose'
  | 'backup:restore'

export interface ProfileIpcDeps {
  status: ProfileStatusStore
  trash: {
    list: () => TrashEntry[]
    restore: (id: string) => unknown
    erase: (id: string) => void
  }
  /** Montre un fichier dans le Finder. */
  reveal: (path: string) => void
  openExternal: (url: string) => void
  /** Choix d'un dossier (dialogue natif) ; `null` si annulé. */
  chooseDirectory: (options: { title: string; buttonLabel: string }) => Promise<string | null>
  /** Ce que contient le dossier choisi (sauvegarde restaurable ?). */
  checkBackup: (folder: string) => BackupCheck
  /** Note la restauration et relance l'app (elle se fait au lancement suivant). */
  restore: (folder: string) => void
}

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function profileHandlers(
  given: ProfileIpcDeps | undefined
): Pick<IpcHandlers, ProfileChannel> {
  // Sans dépendances (essais de l'IPC) : rien à montrer, et toute action est refusée.
  const need = (): ProfileIpcDeps => {
    if (!given) throw new Error('Profil indisponible')
    return given
  }
  const writable = () => {
    if (need().status.readOnly) throw readOnlyError()
  }
  return {
    'profile:status': () => given?.status.status() ?? { readOnly: false, notices: [] },
    'profile:dismiss': (id) => {
      need().status.dismiss(str(id, 'id'))
      return need().status.status()
    },
    'profile:reveal': (id) => {
      const path = need().status.pathOf(str(id, 'id'))
      if (path) need().reveal(path)
      return undefined
    },
    'profile:openReleases': () => {
      need().openExternal(RELEASES_URL)
      return undefined
    },
    'trash:list': () => given?.trash.list() ?? [],
    'trash:restore': (id) => {
      writable()
      need().trash.restore(str(id, 'id'))
      return need().trash.list()
    },
    'trash:erase': (id) => {
      writable()
      need().trash.erase(str(id, 'id'))
      return need().trash.list()
    },
    'backup:choose': async () => {
      writable()
      const folder = await need().chooseDirectory({
        title: t('dialogs.restore.title'),
        buttonLabel: t('dialogs.restore.button')
      })
      return folder ? need().checkBackup(folder) : null
    },
    'backup:restore': (folder) => {
      writable()
      // Revérifiée : le dossier a pu changer entre le choix et la confirmation.
      const check = need().checkBackup(str(folder, 'folder'))
      if (!check.ok) throw new Error(t(`settings.data.restore.${check.reason}`))
      need().restore(check.folder)
      return undefined
    }
  }
}

/** Les dépendances des canaux, assemblées depuis l'app (index.ts). */
export function profileIpcDeps(app: {
  status: ProfileStatusStore
  trash: ConversationTrash
  conversations: { restoreFromTrash: (id: string) => unknown }
  userData: string
  files: { reveal: (path: string) => void; openExternal: (url: string) => Promise<void> }
  chooseDirectory: ProfileIpcDeps['chooseDirectory']
  /** Quitte et relance l'app (la restauration se fait au lancement). */
  relaunch: () => void
}): ProfileIpcDeps {
  return {
    status: app.status,
    trash: {
      list: () => app.trash.list(),
      restore: (id) => app.conversations.restoreFromTrash(id),
      erase: (id) => app.trash.erase(id)
    },
    reveal: (path) => app.files.reveal(path),
    openExternal: (url) => void app.files.openExternal(url),
    chooseDirectory: (options) => app.chooseDirectory(options),
    checkBackup: (folder) => checkBackup(folder, app.userData),
    restore: (folder) => {
      requestRestore(app.userData, folder)
      app.relaunch()
    }
  }
}

/** Titres des conversations dont les derniers messages ne sont pas sur le disque. */
export function unsavedTitles(
  conversations: { state: () => { conversations: { id: string; title: string }[] } },
  writer: { unsavedIds: () => string[] }
): string[] {
  const ids = new Set(writer.unsavedIds())
  return conversations
    .state()
    .conversations.filter((c) => ids.has(c.id))
    .map((c) => c.title)
}
