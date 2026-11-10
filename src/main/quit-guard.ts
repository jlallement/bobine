/**
 * Confirmation avant de quitter quand un agent travaille encore : quitter l'arrêterait en pleine
 * réponse. Jamais pour un arrêt du Mac ni un signal (le système, les essais) : on quitte alors
 * directement.
 */
import { t } from 'i18next'

export interface QuitQuestion {
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
}

/** Question à poser avant de quitter, ou `null` si rien ne travaille. */
export function quitQuestion(working: readonly string[]): QuitQuestion | null {
  if (working.length === 0) return null
  const [first] = working
  const count = working.length
  return {
    message: t('quit.title', { count }),
    detail: t('quit.detail', { count, first: first ?? '' }),
    buttons: [t('quit.confirm'), t('quit.cancel')],
    defaultId: 1,
    cancelId: 1
  }
}

export interface QuitFlowOptions {
  /** Titres des conversations où un agent travaille. */
  busyTitles: () => string[]
  /** Pose la question ; rend vrai si l'utilisateur confirme qu'il veut quitter. */
  ask: (question: QuitQuestion) => Promise<boolean>
  /** Des conversations vides ont une session chez leur agent. */
  hasDraftSessions: () => boolean
  /** Supprime la session des conversations vides chez leur agent (dans un temps borné). */
  dropDraftSessions: () => Promise<void>
  /** Redemande de quitter (Electron rappelle alors `beforeQuit`). */
  quit: () => void
  /**
   * Avant l'arrêt, une fois (fiche 197) : les fils écrits, et l'alerte des conversations non
   * enregistrées s'il en reste. `interactive` est relu : un arrêt du Mac peut survenir pendant.
   */
  keepUnsaved?: (interactive: () => boolean) => Promise<unknown>
  /** Un arrêt du Mac ou un signal survient : une alerte encore ouverte se ferme. */
  stopAsking?: () => void
  /** L'app quitte vraiment : tout s'arrête ; `relaunch` : elle se relance ensuite. */
  shutdown: (relaunch: boolean) => void
}

/**
 * Ce qui se passe quand l'app quitte (fiche 089, sorti de `index.ts`) : confirmation si un agent
 * travaille, puis suppression des sessions des conversations vides chez leur agent (une fois),
 * enfin l'arrêt de tout. `beforeQuit` reçoit l'évènement `before-quit` d'Electron.
 */
export class QuitFlow {
  private readonly options: QuitFlowOptions
  /** Quitter sans demander : confirmé par l'utilisateur, arrêt du Mac ou signal. */
  private confirmed = false
  /** « Relancer » (langue des fenêtres de macOS, fiche 074) : relance une fois l'app quittée. */
  private relaunch = false
  private draftsDropped = false
  private unsavedChecked = false
  /** Arrêt du Mac ou signal : personne pour répondre à une alerte. */
  private fromSystem = false
  /** `shutdown` a eu lieu : un nouveau `before-quit` ne refait rien. */
  private shutDown = false

  constructor(options: QuitFlowOptions) {
    this.options = options
  }

  /** Arrêt du Mac ou signal : on quitte sans poser de question. */
  confirm(): void {
    this.confirmed = true
    this.fromSystem = true
    this.options.stopAsking?.()
  }

  /** Quelqu'un peut répondre à une alerte en quittant (pas un arrêt du Mac ni un signal). */
  get interactive(): boolean {
    return !this.fromSystem
  }

  /** Quitte, puis relance l'app. */
  relaunchAfterQuit(): void {
    this.relaunch = true
    this.options.quit()
  }

  beforeQuit(event: { preventDefault(): void }): void {
    // Déjà arrêtée : `will-quit` a attendu la fin des processus et redemande de quitter (fiche 195).
    if (this.shutDown) return
    const question = this.confirmed ? null : quitQuestion(this.options.busyTitles())
    if (question) {
      event.preventDefault()
      void this.options.ask(question).then((confirmed) => {
        if (!confirmed) {
          this.relaunch = false
          return
        }
        this.confirmed = true
        this.options.quit()
      })
      return
    }
    // Conversations vides : leur session est d'abord supprimée chez l'agent (borné), puis on quitte.
    if (!this.draftsDropped && this.options.hasDraftSessions()) {
      event.preventDefault()
      this.draftsDropped = true
      void this.options.dropDraftSessions().finally(() => this.options.quit())
      return
    }
    // Fils écrits, et ceux qui n'ont pas pu l'être dits (fiche 197), avant que tout s'arrête.
    if (!this.unsavedChecked && this.options.keepUnsaved) {
      event.preventDefault()
      this.unsavedChecked = true
      void this.options
        .keepUnsaved(() => this.interactive)
        .catch(() => {})
        .finally(() => this.options.quit())
      return
    }
    this.shutDown = true
    this.options.shutdown(this.relaunch)
  }
}

/** Ce que `waitForStoppedProcesses` utilise d'`app` (Electron), remplaçable en essai. */
export interface QuittingApp {
  on(event: 'will-quit', listener: (event: { preventDefault(): void }) => void): unknown
  quit(): void
}

/**
 * Dernière étape en quittant (fiche 195) : si des processus arrêtés vivent encore (agent qui
 * ignore SIGTERM), `will-quit` attend `settle` (borné, puis SIGKILL) avant de laisser sortir le
 * main ; une seule fois. Sans rien à attendre, l'app quitte tout de suite.
 */
export function waitForStoppedProcesses(
  app: QuittingApp,
  pending: () => boolean,
  settle: () => Promise<unknown>
): void {
  let settled = false
  app.on('will-quit', (event) => {
    if (settled || !pending()) return
    settled = true
    event.preventDefault()
    void settle()
      .catch(() => {})
      .finally(() => app.quit())
  })
}
