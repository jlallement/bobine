/**
 * Le profil dans l'app (fiches 196, 197), assemblé pour `index.ts` : ouverture au lancement (avant
 * toute lecture), avis de ce que la lecture a mis de côté, alerte des conversations non enregistrées
 * en quittant, dépendances des canaux `profile:*`, `trash:*`, `backup:*`.
 *
 * N'importe pas `electron` : la boîte d'alerte et le Finder sont injectés.
 */
import { join } from 'node:path'
import type { ProfileStatus } from '@shared/profile'
import { ConversationTrash } from './conversations/trash'
import type { ConversationStore } from './conversations/store'
import { profileIpcDeps, unsavedTitles, type ProfileIpcDeps } from './profile-ipc'
import { guardPrompts, guardReadOnly } from './read-only-guard'
import type { ConversationManager } from './conversations/manager'
import type { IpcHandlers } from '@shared/ipc'
import { noteUnsavedAtQuit, openProfile, reportDamage } from './profile-startup'
import { ProfileStatusStore } from './profile-status'
import { readSettings, type Settings } from './settings'
import { keepUnsaved, type UnsavedDeps, type UnsavedOutcome } from './unsaved-at-quit'

export class AppProfile {
  readonly status = new ProfileStatusStore()
  readonly trash: ConversationTrash
  /** Profil d'une version plus récente : rien ne s'enregistre (fiche 196). */
  readonly readOnly = (): boolean => this.status.readOnly !== false
  private readonly userData: string
  private settingsDamaged: string | undefined
  private outcome: UnsavedOutcome | undefined
  private abortQuestion: (() => void) | undefined

  constructor(userData: string, appVersion: string, now = new Date()) {
    this.userData = userData
    openProfile(userData, appVersion, this.status, now)
    this.trash = new ConversationTrash(join(userData, 'conversations'))
  }

  /** Réglages lus ; un fichier abîmé est noté pour l'avis. */
  readSettings(file: string): Settings {
    const { settings, damaged } = readSettings(file)
    this.settingsDamaged = damaged
    return settings
  }

  /** Les fichiers lus : avis de ce qui a été mis de côté ou retrouvé ; l'interface suit. */
  loaded(
    approvals: { damaged: string | undefined },
    store: Pick<ConversationStore, 'damaged' | 'recovered'>,
    send: (status: ProfileStatus) => void
  ): void {
    reportDamage(this.status, {
      settings: this.settingsDamaged,
      approvals: approvals.damaged,
      history: store.damaged,
      recovered: store.recovered
    })
    this.status.onChange(() => send(this.status.status()))
  }

  /**
   * Avant de quitter (fiche 197) : les fils écrits ; ceux en échec (disque plein) font poser la
   * question, tant que quelqu'un peut répondre ; sinon notés pour le lancement suivant.
   */
  async keepUnsaved(
    interactive: () => boolean,
    conversations: Parameters<typeof unsavedTitles>[0],
    writer: Parameters<typeof unsavedTitles>[1] & {
      lastError: () => unknown
      flushAll: () => Promise<void>
    },
    ask: UnsavedDeps['ask']
  ): Promise<void> {
    this.outcome = await keepUnsaved({
      interactive,
      unsaved: () => unsavedTitles(conversations, writer),
      lastError: () => writer.lastError(),
      retry: () => writer.flushAll(),
      ask,
      note: (titles, error) => noteUnsavedAtQuit(this.userData, titles, error),
      onAbort: (abort) => (this.abortQuestion = abort)
    })
    this.abortQuestion = undefined
  }

  /** Arrêt du Mac ou signal : l'alerte encore ouverte se ferme (la perte sera notée). */
  stopAsking(): void {
    this.abortQuestion?.()
  }

  /**
   * L'app s'arrête, fils écrits une dernière fois : ce qui reste non enregistré est noté pour le
   * lancement suivant, sauf si l'utilisateur a choisi de quitter sans.
   */
  noteUnsaved(
    conversations: Parameters<typeof unsavedTitles>[0],
    writer: Parameters<typeof unsavedTitles>[1] & { lastError: () => unknown }
  ): void {
    if (this.outcome === 'discarded' || this.outcome === 'noted') return
    const titles = unsavedTitles(conversations, writer)
    if (titles.length > 0) noteUnsavedAtQuit(this.userData, titles, writer.lastError())
  }

  ipc(
    conversations: {
      restoreFromTrash: (id: string) => unknown
      prompt: ConversationManager['prompt']
    },
    files: Parameters<typeof profileIpcDeps>[0]['files'],
    chooseDirectory: ProfileIpcDeps['chooseDirectory'],
    quit: { relaunchAfterQuit: () => void }
  ): ProfileIpcDeps {
    // Aucun envoi en lecture seule, même hors de l'interface (fiche 196).
    guardPrompts(conversations, this.readOnly)
    const { status, trash, userData } = this
    const relaunch = () => quit.relaunchAfterQuit()
    return profileIpcDeps({
      status,
      trash,
      conversations,
      userData,
      files,
      chooseDirectory,
      relaunch
    })
  }

  /** Refuse, en lecture seule, les canaux qui changeraient le profil. */
  guard(handlers: IpcHandlers): IpcHandlers {
    return guardReadOnly(handlers, this.readOnly)
  }
}
