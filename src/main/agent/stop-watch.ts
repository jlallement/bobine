/**
 * Pourquoi l'app a arrêté le processus d'un agent (fiche 195, sorti de l'hôte d'agent pour tenir son
 * plafond de taille) : agent figé qui ignore « Stop » (délai de grâce, fiche 041), ou connexion
 * coupée alors que le processus vivait. La sortie du processus dit alors cette cause plutôt qu'un
 * « SIGTERM » trompeur.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { t } from 'i18next'
import { killIfConnectionLost, killTree } from './process-utils'

export class StopWatch {
  private cause: 'unresponsive' | 'connection' | undefined
  private cancelTimer: ReturnType<typeof setTimeout> | undefined

  /** Nouveau processus : aucune cause, aucun délai en cours. */
  reset(): void {
    this.clearCancel()
    this.cause = undefined
  }

  /**
   * Après « Stop » : un agent figé ignore `session/cancel`. Passé `graceMs`, si le tour est encore
   * le même (`still`), son processus est arrêté et la conversation peut être relancée.
   */
  armCancel(child: ChildProcessWithoutNullStreams, graceMs: number, still: () => boolean): void {
    if (this.cancelTimer) return
    this.cancelTimer = setTimeout(() => {
      this.cancelTimer = undefined
      if (!still()) return
      this.cause = 'unresponsive'
      killTree(child)
    }, graceMs)
    this.cancelTimer.unref()
  }

  clearCancel(): void {
    if (this.cancelTimer) clearTimeout(this.cancelTimer)
    this.cancelTimer = undefined
  }

  /** Connexion coupée, processus vivant (`current` : c'est toujours le processus de l'hôte). */
  watchConnection(
    signal: AbortSignal,
    child: ChildProcessWithoutNullStreams,
    current: () => boolean
  ): void {
    killIfConnectionLost(signal, child, current, () => (this.cause = 'connection'))
  }

  /** Ce que la conversation dit de la sortie du processus. */
  exitReason(code: number | null, signal: NodeJS.Signals | null, hint: string): string {
    if (this.cause === 'unresponsive') return t('agentHost.exit.unresponsive')
    if (this.cause === 'connection') return t('agentHost.exit.connectionLost')
    return t('agentHost.exit.status', {
      status: signal ?? t('agentHost.exit.code', { code: String(code) }),
      hint
    })
  }
}
