/**
 * Attente qu'une conversation ne travaille plus (« Arrêter le tour de table », fiche 285) : le tour
 * passe à « arrêté » seulement une fois ses participants vraiment arrêtés, pour que la carte, la
 * barre latérale et le panneau Session disent la même chose.
 */
import type { AgentEvent } from '@shared/agent'

/** Échéance de la relecture du coût après un tour (`session-cost.ts` : une minute au plus). */
export const LATE_COST_MS = 65_000

/** Attente d'un tour, au plus, avant de regarder de nouveau (un tour long se réattend). */
const REST_WAIT_MS = 10_000

/** États où l'agent d'une conversation travaille encore. */
const BUSY: ReadonlySet<string> = new Set(['busy', 'starting', 'needs-action'])

export class IdleWaiters {
  private readonly waiters = new Map<string, Set<() => void>>()
  /**
   * Coût lu hors protocole après la fin du dernier tour (`usage-report` qui suit `turn-end`) :
   * l'agent d'un participant au coût lu après coup (Bob) peut alors être libéré (contre-recette N1).
   */
  private readonly costRead = new Set<string>()
  private readonly costWaiters = new Map<string, Set<() => void>>()
  private readonly status: (id: string) => string | undefined
  /** Messages en file d'attente de la conversation (lève si elle n'existe plus). */
  private readonly queued: (id: string) => number

  constructor(
    status: (id: string) => string | undefined,
    queued: (id: string) => number = () => 0
  ) {
    this.status = status
    this.queued = queued
  }

  onEvent(id: string, event: AgentEvent): void {
    if (event.type === 'status' && !BUSY.has(event.snapshot.status)) this.release(id)
    if (event.type === 'turn-end' || event.type === 'turn-error') {
      this.costRead.delete(id)
      this.release(id)
    }
    if (event.type === 'usage-report' && event.cost) {
      this.costRead.add(id)
      const waiting = this.costWaiters.get(id)
      this.costWaiters.delete(id)
      for (const resolve of waiting ?? []) resolve()
    }
  }

  /**
   * Agents des participants arrêtés une fois au repos (recette réelle, G1) ; au coût lu après
   * coup (`lateCost`, Bob), une fois ce coût lu, au plus à l'échéance (contre-recette N1), sinon
   * le plafond de la réplique ne le verrait qu'après son envoi. `release` revérifie le tour.
   */
  releaseSeats(
    seats: readonly { childId?: string; removed?: true }[],
    lateCost: (id: string) => boolean,
    lateCostMs: number | undefined,
    release: (id: string) => void
  ): void {
    for (const { childId: id, removed } of seats) {
      if (!id || removed) continue
      void this.wait(id, REST_WAIT_MS)
        .then(() => (lateCost(id) ? this.costAfterTurn(id, lateCostMs ?? LATE_COST_MS) : undefined))
        .then(() => release(id))
    }
  }

  /** Résolue quand le coût du dernier tour est lu (tout de suite s'il l'est), ou à `timeoutMs`. */
  costAfterTurn(id: string, timeoutMs: number): Promise<void> {
    if (this.costRead.has(id)) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        this.costWaiters.get(id)?.delete(done)
        resolve()
      }
      const timer = setTimeout(done, timeoutMs)
      timer.unref()
      const set = this.costWaiters.get(id) ?? new Set<() => void>()
      set.add(done)
      this.costWaiters.set(id, set)
    })
  }

  /** Conversation partie : plus rien à attendre. */
  release(id: string): void {
    const waiting = this.waiters.get(id)
    if (!this.status(id)) this.forgetCost(id)
    this.waiters.delete(id)
    for (const resolve of waiting ?? []) resolve()
  }

  /** Conversation partie : son coût n'est plus attendu. */
  private forgetCost(id: string): void {
    this.costRead.delete(id)
    const waiting = this.costWaiters.get(id)
    this.costWaiters.delete(id)
    for (const resolve of waiting ?? []) resolve()
  }

  /** L'agent de la conversation travaille encore. */
  busy(id: string): boolean {
    return BUSY.has(this.status(id) ?? '')
  }

  /** L'agent travaille, ou des messages attendent leur tour. */
  restless(id: string): boolean {
    if (this.busy(id)) return true
    try {
      return this.queued(id) > 0
    } catch {
      return false
    }
  }

  /**
   * Attend le repos d'une conversation (ni tour, ni file d'attente) tant que `wanted` ; rend s'il
   * faut encore agir (réplique d'un tour de table, contre-revue N7).
   */
  async atRest(id: string, wanted: () => boolean): Promise<boolean> {
    while (wanted() && this.restless(id)) {
      // Au repos mais une file d'attente qui part : on la laisse partir, relu un peu plus tard.
      if (this.busy(id)) await this.wait(id, REST_WAIT_MS)
      else await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return wanted()
  }

  /** Résolue quand la conversation ne travaille plus, ou au bout de `timeoutMs`. */
  wait(id: string, timeoutMs: number): Promise<void> {
    if (!BUSY.has(this.status(id) ?? '')) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        this.waiters.get(id)?.delete(done)
        resolve()
      }
      const timer = setTimeout(done, timeoutMs)
      const set = this.waiters.get(id) ?? new Set<() => void>()
      set.add(done)
      this.waiters.set(id, set)
    })
  }
}
