/**
 * Coût de la session lu hors protocole (fiche 157), pour les agents qui ne le transmettent pas
 * (Bob : `costSource` du profil). Rien de propre à un agent : le profil dit où le lire. Relu à la
 * fin de chaque tour, à la fin d'un outil (le plafond le voit pendant le tour), et pendant que des
 * sous-agents tournent ; annoncé seulement quand il change.
 */
import type { AgentEvent } from '@shared/agent'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { AgentProfile } from './profiles'
import type { SubagentTrackerOptions } from './subagent-tracker'

/** Au plus une relecture toutes les 2 s à la fin d'un outil : la lecture est synchrone. */
const TOOL_READ_EVERY_MS = 2000
/**
 * L'agent enregistre parfois son coût juste après sa réponse (Bob) : relu un peu plus tard, puis
 * encore une fois si rien n'a changé. Une seule relecture manquait une écriture tardive (machine
 * chargée, base créée au premier tour), et le coût restait faux jusqu'au tour suivant.
 */
const LATE_READS_MS = [1500, 5000]
/**
 * Après la fin du tour, la source est guettée (si elle sait l'être) jusqu'à ce que le coût change :
 * une écriture plus tardive que les relectures à heure fixe est lue dès qu'elle arrive (CI Windows
 * du 2026-11-18 : écriture du coût après la relecture de 5 s, sous une charge où un tour de 100 ms
 * en prenait 2). Au plus une minute, pour ne pas guetter sans fin un agent qui n'écrit rien.
 */
const WATCH_MAX_MS = 60_000
/** Une écriture fait plusieurs évènements (base, journal) : relu une fois, un peu après. */
const WATCH_SETTLE_MS = 50

const isToolEnd = (u: SessionUpdate) =>
  u.sessionUpdate === 'tool_call_update' && (u.status === 'completed' || u.status === 'failed')

export class SessionCost {
  /** Dernier coût annoncé. */
  private last: number | undefined
  /** Dernière relecture à la fin d'un outil. */
  private toolReadAt = 0
  /** Arrêt de la veille de la source après un tour, s'il y en a une. */
  private unwatch: (() => void) | undefined
  /** Relecture d'après un tour en cours (`cost-reading`), et son numéro (la dernière compte). */
  private reading = false
  private cycle = 0
  /** La dernière lecture a rendu un coût. */
  private readable = false

  private readonly source: AgentProfile['costSource']
  /** Session ouverte de l'hôte, lue à chaque relecture. */
  private readonly sessionId: () => string | undefined
  private readonly emit: (event: AgentEvent) => void

  constructor(
    source: AgentProfile['costSource'],
    sessionId: () => string | undefined,
    emit: (event: AgentEvent) => void
  ) {
    this.source = source
    this.sessionId = sessionId
    this.emit = emit
  }

  /** Nouveau lancement de l'agent : le prochain coût est annoncé, même égal au précédent. */
  reset(): void {
    this.last = undefined
    this.stopWatching()
  }

  /** Fin de la veille de la source (relance, arrêt de l'agent, coût lu). */
  stopWatching(): void {
    this.unwatch?.()
    this.unwatch = undefined
  }

  /** Relit le coût de la session et l'annonce s'il a changé. */
  report(): void {
    const source = this.source
    const sessionId = this.sessionId()
    if (!source || !sessionId) {
      this.readable = false
      return
    }
    const amount = source.session(sessionId)
    this.readable = amount !== undefined
    // Une conversation qui commence n'a rien coûté : inutile d'afficher un coût nul.
    if (amount === undefined || amount === this.last || (amount === 0 && this.last === undefined)) {
      return
    }
    this.last = amount
    this.emit({ type: 'usage-report', cost: { amount, currency: source.currency } })
    // Coût relevé : celui du tour d'avant est connu, la relecture en cours est finie.
    this.endReading()
  }

  /** Fin de la relecture d'après un tour : le coût connu est celui de départ du tour suivant. */
  private endReading(): void {
    if (!this.reading) return
    this.reading = false
    this.emit({ type: 'cost-reading', active: false, ...(this.readable ? {} : { unknown: true }) })
  }

  /** Fin d'un tour : relu tout de suite, puis plus tard jusqu'à ce que le coût change. */
  turnEnded(): void {
    const cycle = ++this.cycle
    if (this.source) {
      this.reading = true
      this.emit({ type: 'cost-reading', active: true })
    }
    this.report()
    const atTurnEnd = this.last
    this.watchUntilChange(atTurnEnd)
    const readLater = ([delay, ...rest]: readonly number[], since: number): void => {
      // Dernière relecture à heure fixe sans changement : fini quand même (rien de plus à
      // attendre), sauf si un tour plus récent a lancé la sienne.
      if (delay === undefined) {
        if (cycle === this.cycle) this.endReading()
        return
      }
      setTimeout(() => {
        this.report()
        if (this.last === atTurnEnd) readLater(rest, delay)
      }, delay - since).unref()
    }
    readLater(LATE_READS_MS, 0)
  }

  /** Guette la source jusqu'à ce que le coût change, ou une minute au plus. */
  private watchUntilChange(atTurnEnd: number | undefined): void {
    this.stopWatching()
    const watch = this.source?.watch
    if (!watch) return
    let settle: ReturnType<typeof setTimeout> | undefined
    const stop = watch(() => {
      if (settle) return
      settle = setTimeout(() => {
        settle = undefined
        this.report()
        if (this.last !== atTurnEnd) this.stopWatching()
      }, WATCH_SETTLE_MS)
      settle.unref()
    })
    const limit = setTimeout(() => this.stopWatching(), WATCH_MAX_MS)
    limit.unref()
    this.unwatch = () => {
      stop()
      clearTimeout(limit)
      if (settle) clearTimeout(settle)
    }
  }

  /** Mise à jour du fil : relu à la fin d'un outil (fiche 157 ; Bob : à vérifier). */
  noteUpdate(update: SessionUpdate): void {
    if (!isToolEnd(update) || Date.now() - this.toolReadAt < TOOL_READ_EVERY_MS) return
    this.toolReadAt = Date.now()
    this.report()
  }

  /** Coût des sous-agents (fiche 053), lu à la même source, s'il y en a un. */
  subagentOptions(): Pick<SubagentTrackerOptions, 'costs' | 'onPoll'> {
    const source = this.source
    if (!source?.subagents) return {}
    return {
      costs: {
        read: () => {
          const sessionId = this.sessionId()
          return sessionId ? source.subagents?.(sessionId) : undefined
        },
        currency: source.currency
      },
      onPoll: () => this.report()
    }
  }
}
