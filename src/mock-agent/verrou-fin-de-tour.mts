/**
 * Verrou de fin de tour (`--verrou-fin-de-tour <fichier>`, `MOCK_AGENT_TURN_LOCK` côté app) :
 * tant que ce fichier existe, aucun tour ne se termine. L'agent a joué son scénario et attend que
 * le fichier disparaisse (ou un `session/cancel`) avant de répondre.
 *
 * Sert aux essais qui doivent montrer un état « au travail » sans le prendre au vol : l'essai pose
 * le fichier, envoie, regarde, puis l'enlève (e2e `roles-travail`, fiche 223).
 */
import { existsSync } from 'node:fs'
import { TurnCancelled } from './scenario.mts'

/** Intervalle de relecture du fichier (ms). */
export const TURN_LOCK_POLL_MS = 25

/** Attend que `lockFile` n'existe plus ; `TurnCancelled` si le tour est annulé avant. */
export function waitWhileLocked(
  lockFile: string,
  signal: AbortSignal,
  pollMs = TURN_LOCK_POLL_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new TurnCancelled())
    let timer: NodeJS.Timeout | undefined
    const onAbort = () => {
      clearTimeout(timer)
      reject(new TurnCancelled())
    }
    const check = () => {
      if (existsSync(lockFile)) {
        timer = setTimeout(check, pollMs)
        return
      }
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    check()
  })
}
