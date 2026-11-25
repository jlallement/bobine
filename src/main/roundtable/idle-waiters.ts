/**
 * Attente qu'une conversation ne travaille plus (« Arrêter le tour de table », fiche 285) : le tour
 * passe à « arrêté » seulement une fois ses participants vraiment arrêtés, pour que la carte, la
 * barre latérale et le panneau Session disent la même chose.
 */
import type { AgentEvent } from '@shared/agent'

/** Attente d'un tour, au plus, avant de regarder de nouveau (un tour long se réattend). */
const REST_WAIT_MS = 10_000

/** États où l'agent d'une conversation travaille encore. */
const BUSY: ReadonlySet<string> = new Set(['busy', 'starting', 'needs-action'])

export class IdleWaiters {
  private readonly waiters = new Map<string, Set<() => void>>()
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
    if (event.type === 'turn-end' || event.type === 'turn-error') this.release(id)
  }

  /** Conversation partie : plus rien à attendre. */
  release(id: string): void {
    const waiting = this.waiters.get(id)
    this.waiters.delete(id)
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
