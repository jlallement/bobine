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
/** L'agent enregistre parfois son coût juste après sa réponse (Bob) : relu un peu plus tard. */
const LATE_READ_MS = 1500

const isToolEnd = (u: SessionUpdate) =>
  u.sessionUpdate === 'tool_call_update' && (u.status === 'completed' || u.status === 'failed')

export class SessionCost {
  /** Dernier coût annoncé. */
  private last: number | undefined
  /** Dernière relecture à la fin d'un outil. */
  private toolReadAt = 0

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
  }

  /** Relit le coût de la session et l'annonce s'il a changé. */
  report(): void {
    const source = this.source
    const sessionId = this.sessionId()
    if (!source || !sessionId) return
    const amount = source.session(sessionId)
    // Une conversation qui commence n'a rien coûté : inutile d'afficher un coût nul.
    if (amount === undefined || amount === this.last || (amount === 0 && this.last === undefined)) {
      return
    }
    this.last = amount
    this.emit({ type: 'usage-report', cost: { amount, currency: source.currency } })
  }

  /** Fin d'un tour : relu tout de suite, puis un peu plus tard. */
  turnEnded(): void {
    this.report()
    setTimeout(() => this.report(), LATE_READ_MS).unref()
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
