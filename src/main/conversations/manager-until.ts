/**
 * Attente pour les essais contre l'agent factice (fiches 097, 223) : une condition sur le
 * gestionnaire, vérifiée à chaque évènement d'une conversation et à chaque changement de la liste
 * — pas un sondage serré qui recalcule les fils toutes les 10 ms et charge la machine quand des
 * centaines d'essais tournent ensemble. Un contrôle lent (`SAFETY_MS`) rattrape une condition qui
 * changerait sans évènement. Le délai, plus court que celui d'un essai, n'est qu'un filet : son
 * message dit ce qui était attendu.
 */
import type { ConversationManager } from './manager'

const SAFETY_MS = 250

export function until(
  manager: Pick<ConversationManager, 'subscribe'>,
  predicate: () => boolean,
  what: string,
  timeoutMs = 10_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (error?: Error) => {
      if (done) return
      done = true
      stop()
      clearInterval(safety)
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      if (done) return
      try {
        if (predicate()) finish()
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    }
    // Vérifiée après l'évènement, une fois le fil ou la liste à jour.
    const later = () => queueMicrotask(check)
    const stop = manager.subscribe({ event: later, list: later })
    const safety = setInterval(check, SAFETY_MS)
    const timer = setTimeout(
      () => finish(new Error(`attente dépassée (${timeoutMs} ms) : ${what}`)),
      timeoutMs
    )
    check()
  })
}
