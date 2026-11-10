/**
 * Avis de l'app (fiche 194) : erreur interne du main, plantage du lancement précédent. N'importe
 * pas `electron` : la fenêtre est prévenue par `send`.
 *
 * Erreur interne : un seul avis par lancement. Tant qu'il est ouvert, les erreurs suivantes
 * augmentent son compte ; fermé, il ne revient pas avant le prochain lancement (tout va au journal).
 */
import type { AppAlert, AppAlertKind } from '@shared/app-alerts'
import { messageOf } from '@shared/errors'

/** Détail technique gardé pour l'avis (le journal a tout). */
const DETAIL_MAX = 4000

export class AppAlerts {
  private internal: { count: number; detail: string } | undefined
  private internalDismissed = false
  private crashReport: string | undefined
  private readonly send: (alerts: AppAlert[]) => void

  constructor(send: (alerts: AppAlert[]) => void) {
    this.send = send
  }

  list(): AppAlert[] {
    return [
      ...(this.internal ? [{ kind: 'internal-error' as const, ...this.internal }] : []),
      ...(this.crashReport ? [{ kind: 'crashed' as const, report: this.crashReport }] : [])
    ]
  }

  /** Exception non rattrapée dans le main (déjà écrite au journal par l'appelant). */
  internalError(error: unknown): void {
    if (this.internalDismissed) return
    if (this.internal) this.internal.count++
    else {
      const stack = error instanceof Error && error.stack ? error.stack : messageOf(error)
      this.internal = { count: 1, detail: stack.slice(0, DETAIL_MAX) }
    }
    this.changed()
  }

  /** Le lancement précédent a planté : rapport rangé dans `dir`. */
  crashed(dir: string): void {
    this.crashReport = dir
    this.changed()
  }

  /** Avis fermé par ✕ : ne revient pas (erreur interne : pas avant le prochain lancement). */
  dismiss(kind: AppAlertKind): void {
    if (kind === 'internal-error') {
      this.internal = undefined
      this.internalDismissed = true
    } else this.crashReport = undefined
    this.changed()
  }

  /** Dossier du rapport du plantage précédent, s'il est encore annoncé. */
  get report(): string | undefined {
    return this.crashReport
  }

  private changed(): void {
    this.send(this.list())
  }
}

/**
 * Plantages de l'interface (fiche 194) : rechargée au plus trois fois par minute ; au-delà,
 * `give-up` (l'app pose la question au lieu d'une fenêtre blanche).
 */
export class RendererCrashes {
  private readonly times: number[] = []

  next(now = Date.now()): 'reload' | 'give-up' {
    while (this.times.length && now - (this.times[0] ?? 0) > 60_000) this.times.shift()
    if (this.times.length >= 3) return 'give-up'
    this.times.push(now)
    return 'reload'
  }
}

/** Réponse au dialogue après trois plantages de l'interface. */
export type CrashChoice = 'relaunch' | 'log' | 'quit'

/**
 * Dialogue après trois plantages (fiche 194) : « Relancer Bobine » (repart de l'accueil),
 * « Afficher le journal » (puis la question revient), « Quitter » (aussi Échap). Rend le choix final.
 */
export async function askAfterCrashes(
  ask: () => Promise<CrashChoice>,
  showLog: () => void
): Promise<Exclude<CrashChoice, 'log'>> {
  for (;;) {
    const choice = await ask()
    if (choice !== 'log') return choice
    showLog()
  }
}

/**
 * Sortie après le dialogue des trois plantages (fiche 194) : l'utilisateur a déjà répondu, la
 * confirmation « un agent travaille » ne revient pas (sinon, annulée, la fenêtre resterait blanche
 * et la relance armée). « Relancer » quitte puis relance (sur l'accueil), sinon on quitte.
 */
export function leaveAfterCrashes(
  choice: Exclude<CrashChoice, 'log'>,
  flow: { confirm(): void; relaunchAfterQuit(): void },
  quit: () => void
): void {
  flow.confirm()
  if (choice === 'relaunch') flow.relaunchAfterQuit()
  else quit()
}
