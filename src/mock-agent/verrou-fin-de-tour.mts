/**
 * Verrou de fin de tour (`--verrou-fin-de-tour <fichier>`, `MOCK_AGENT_TURN_LOCK` côté app) :
 * tant que ce fichier existe, aucun tour ne se termine. L'agent a joué son scénario et attend que
 * le fichier disparaisse (ou un `session/cancel`) avant de répondre.
 *
 * Chaque tour retenu l'écrit d'une ligne (son `sessionId`) dans `<fichier>.retenus` : l'essai sait
 * ainsi que le tour est bien commencé, et pas seulement l'agent démarré.
 *
 * Sert aux essais qui doivent montrer un état « au travail » sans le prendre au vol : l'essai pose
 * le fichier, envoie, attend les tours retenus, regarde, puis l'enlève (e2e `roles-travail`,
 * fiche 223).
 */
import { appendFileSync, existsSync } from 'node:fs'
import { TurnCancelled } from './scenario.mts'

/** Intervalle de relecture du fichier (ms). */
export const TURN_LOCK_POLL_MS = 25

/** Fichier où les tours retenus s'inscrivent, une ligne (`sessionId`) par tour. */
export function heldTurnsFile(lockFile: string): string {
  return `${lockFile}.retenus`
}

/**
 * Verrou de démarrage (`--verrou-demarrage <fichier>`) : `initialize` ne répond pas tant que le
 * fichier existe. Un essai tient ainsi un agent « démarre » aussi longtemps qu'il le veut, sans
 * dépendre d'une durée (le lancement d'une place pendant qu'on l'arrête, fiche 285).
 */
export function waitForStartLock(lockFile: string, pollMs = TURN_LOCK_POLL_MS): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (existsSync(lockFile) ? setTimeout(check, pollMs) : resolve())
    check()
  })
}

/**
 * Attend que `lockFile` n'existe plus ; `TurnCancelled` si le tour est annulé avant. Un tour
 * effectivement retenu (verrou présent) s'inscrit d'abord dans `heldTurnsFile`.
 */
export function waitWhileLocked(
  lockFile: string,
  sessionId: string,
  signal: AbortSignal,
  pollMs = TURN_LOCK_POLL_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new TurnCancelled())
    if (!existsSync(lockFile)) return resolve()
    appendFileSync(heldTurnsFile(lockFile), `${sessionId}\n`)
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
