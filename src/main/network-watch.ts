/**
 * Retour du réseau (fiche 142) : une conversation qui attend pour réessayer un tour est prévenue
 * quand le Mac retrouve le réseau (`net.isOnline()` repasse à vrai) ou sort de veille. Electron
 * n'émet rien quand le réseau revient : on le sonde, seulement tant que quelqu'un attend. Les
 * fonctions d'Electron sont injectées (testable sans Electron, `network-watch-electron.ts`).
 */

export interface NetworkWatch {
  /** Prévient `listener` au retour du réseau ; rend la fonction qui arrête de prévenir. */
  onRestored(listener: () => void): () => void
}

export interface NetworkWatchDeps {
  isOnline: () => boolean
  /** `powerMonitor` : `resume` (sortie de veille). */
  power: {
    on(event: 'resume', listener: () => void): unknown
    off(event: 'resume', listener: () => void): unknown
  }
  /** Intervalle de la sonde (2 s par défaut). */
  intervalMs?: number
}

export const NETWORK_POLL_MS = 2_000

export function createNetworkWatch(deps: NetworkWatchDeps): NetworkWatch {
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setInterval> | undefined
  let online = true
  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }
  const poll = (): void => {
    const now = deps.isOnline()
    if (now && !online) notify()
    online = now
  }
  const start = (): void => {
    online = deps.isOnline()
    timer = setInterval(poll, deps.intervalMs ?? NETWORK_POLL_MS)
    timer.unref?.()
    deps.power.on('resume', notify)
  }
  const stop = (): void => {
    clearInterval(timer)
    timer = undefined
    deps.power.off('resume', notify)
  }
  return {
    onRestored(listener) {
      if (listeners.size === 0) start()
      listeners.add(listener)
      return () => {
        if (!listeners.delete(listener)) return
        if (listeners.size === 0) stop()
      }
    }
  }
}
