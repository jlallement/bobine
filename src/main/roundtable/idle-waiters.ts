/**
 * Attente qu'une conversation ne travaille plus (« Arrêter le tour de table », fiche 285) : le tour
 * passe à « arrêté » seulement une fois ses participants vraiment arrêtés, pour que la carte, la
 * barre latérale et le panneau Session disent la même chose.
 */
import type { AgentEvent } from '@shared/agent'

/** États où l'agent d'une conversation travaille encore. */
const BUSY: ReadonlySet<string> = new Set(['busy', 'starting', 'needs-action'])

export class IdleWaiters {
  private readonly waiters = new Map<string, Set<() => void>>()
  private readonly status: (id: string) => string | undefined

  constructor(status: (id: string) => string | undefined) {
    this.status = status
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
