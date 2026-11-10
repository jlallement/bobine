/**
 * Son quand un agent attend une action (fiche 068) : un son du système, joué par `afplay`, jamais
 * deux de suite à moins de 2 s (plusieurs demandes rapprochées n'en font qu'un).
 */
import type { AttentionSound } from '@shared/preferences'

export const CHIME_GAP_MS = 2000

/** Chemin d'un son du système. */
export const soundFile = (sound: Exclude<AttentionSound, 'off'>) =>
  `/System/Library/Sounds/${sound}.aiff`

export function createChime(options: {
  /** Joue le son (afplay, ou noté dans un journal en essai). */
  play: (sound: Exclude<AttentionSound, 'off'>) => void
  now?: () => number
}): (sound: AttentionSound) => void {
  let last = -Infinity
  const now = options.now ?? Date.now
  return (sound) => {
    if (sound === 'off') return
    const at = now()
    if (at - last < CHIME_GAP_MS) return
    last = at
    options.play(sound)
  }
}
