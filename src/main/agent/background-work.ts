/**
 * Travail de l'agent après la fin de son tour (fiche 255). La fin de tour ACP (`end_turn`) n'est
 * pas toujours la fin du travail : un sous-agent lancé en arrière-plan (fiche 122) travaille
 * encore, puis l'agent répond de lui-même, hors tour, à son rapport (OpenCode 2.3.0, fiche 232).
 * Rien dans le protocole ne dit quand ce travail finit ; l'app le sait par ce qu'elle voit :
 *
 * - un sous-agent en arrière-plan est en cours de son lancement (`background`) à sa fin vue par
 *   le suivi (`endedAt`) ou à la perte de son suivi (`lost`) ;
 * - l'agent parle hors de tout tour (message, réflexion, outil) ;
 * - et rien de tout cela depuis `quietMs` : la réponse attendue après la fin d'un sous-agent, et la
 *   fin de son écriture, que rien ne marque.
 *
 * Aucune attente sans borne : sans sous-agent en cours, `quietMs` après la dernière activité, c'est
 * fini. Évènement `background-work` à chaque passage ; à la retombée, `at` : heure de la dernière
 * parole hors tour (s'il y en a eu et qu'aucun tour n'est en cours), que le fil donne à ces
 * réponses, qui finissent le tour.
 */
import type { AgentEvent } from '@shared/agent'
import type { SubagentRun } from '@shared/subagent'

/** Silence qui clôt le travail après le tour : réponse au rapport d'un sous-agent observée 1 à 4 s après sa fin. */
export const BACKGROUND_QUIET_MS = 5000

export interface BackgroundWorkOptions {
  emit: (event: AgentEvent) => void
  /** Un tour est en cours : sa fin datera elle-même ses réponses. */
  busy: () => boolean
  quietMs?: number | undefined
  now?: () => number
}

export class BackgroundWork {
  private readonly running = new Set<string>()
  private quiet: ReturnType<typeof setTimeout> | undefined
  /** Dernière parole hors tour depuis que le travail a commencé. */
  private spokeAt: number | undefined
  private wasActive = false
  private readonly options: BackgroundWorkOptions

  constructor(options: BackgroundWorkOptions) {
    this.options = options
  }

  /** Des sous-agents travaillent encore, ou l'agent vient de parler hors tour (moins de `quietMs`). */
  get active(): boolean {
    return this.running.size > 0 || this.quiet !== undefined
  }

  /** Ce que le suivi des sous-agents a vu d'un sous-agent (`subagent-run`). */
  run(toolCallId: string, run: SubagentRun): void {
    if (run.endedAt !== undefined || run.lost) {
      if (!this.running.delete(toolCallId)) return
      // Fini pendant le tour : le tour continue, sa fin dira le reste.
      if (this.options.busy()) return this.update()
      return this.touch()
    }
    if (run.background && !this.running.has(toolCallId)) {
      this.running.add(toolCallId)
      // Annoncé à chaque lancement, même déjà en cours : un fil qui l'a oublié (agent relancé
      // après un plantage, statut passé par « démarre ») le revoit.
      this.wasActive = true
      this.options.emit({ type: 'background-work', active: true })
    }
  }

  /** L'agent parle hors de tout tour (ni tour en cours, ni rejeu). */
  spoke(): void {
    this.spokeAt = this.now()
    this.touch()
  }

  /** Agent arrêté, nouvelle session : plus rien n'est suivi, sans annonce (le statut le dira). */
  reset(): void {
    this.running.clear()
    if (this.quiet) clearTimeout(this.quiet)
    this.quiet = undefined
    this.spokeAt = undefined
    this.wasActive = false
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  /** Activité hors tour : la fenêtre de silence repart. */
  private touch(): void {
    if (this.quiet) clearTimeout(this.quiet)
    this.quiet = setTimeout(() => {
      this.quiet = undefined
      this.update()
    }, this.options.quietMs ?? BACKGROUND_QUIET_MS)
    this.quiet.unref?.()
    this.update()
  }

  private update(): void {
    const active = this.active
    if (active === this.wasActive) return
    this.wasActive = active
    if (active) return this.options.emit({ type: 'background-work', active: true })
    const at = this.spokeAt
    this.spokeAt = undefined
    const dated = at !== undefined && !this.options.busy()
    this.options.emit({ type: 'background-work', active: false, ...(dated ? { at } : {}) })
  }
}
