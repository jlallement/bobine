/**
 * Rebond de l'icône du Dock (fiche 101) : marche sans certificat de développeur, contrairement aux
 * notifications. Un seul rebond en cours à la fois : un rebond `critical` (un agent attend) dure
 * jusqu'au retour dans l'app ; un `informational` (réponse finie) ne rebondit qu'une seconde et
 * compte comme fini après 2 s, pour qu'une autre réponse finie plus tard rebondisse encore. Un
 * `critical` remplace un `informational` en cours, jamais l'inverse.
 */
import { CHIME_GAP_MS } from './chime'

export type BounceKind = 'informational' | 'critical'

/** Ce qui sert du Dock de macOS (`app.dock`) ; remplaçable par un journal en essai. */
export interface Dock {
  /** Identifiant du rebond ; -1 quand macOS le refuse (app au premier plan). */
  bounce: (kind: BounceKind) => number
  cancelBounce: (id: number) => void
}

export interface DockBounce {
  bounce: (kind: BounceKind) => void
  /** Retour dans l'app : le rebond en cours s'arrête. */
  stop: () => void
}

export function createDockBounce(options: {
  /** Absent hors macOS : rien ne rebondit. */
  dock: Dock | undefined
  /** Réglage « Faire rebondir l'icône du Dock ». */
  enabled: () => boolean
  now?: () => number
}): DockBounce {
  const { dock } = options
  const now = options.now ?? Date.now
  let current: { id: number; kind: BounceKind; at: number } | undefined
  return {
    bounce(kind) {
      if (!dock || !options.enabled()) return
      if (current) {
        const going = current.kind === 'critical' || now() - current.at < CHIME_GAP_MS
        // Pas de rafale : seul un `critical` remplace un `informational` qui rebondit encore.
        if (going && (current.kind === 'critical' || kind === 'informational')) return
        dock.cancelBounce(current.id)
      }
      const id = dock.bounce(kind)
      current = id < 0 ? undefined : { id, kind, at: now() }
    },
    stop() {
      if (!current) return
      dock?.cancelBounce(current.id)
      current = undefined
    }
  }
}

/** Dock d'essai (`BOBINE_BOUNCE_LOG`) : chaque rebond et chaque arrêt sont notés, rien ne bouge. */
export function journalDock(write: (line: string) => void): Dock {
  let next = 0
  return {
    bounce: (kind) => {
      write(kind)
      return ++next
    },
    cancelBounce: () => write('stop')
  }
}
