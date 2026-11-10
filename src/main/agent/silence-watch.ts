/**
 * Journal (fiche 080) : pendant un tour, un agent qui n'envoie plus rien depuis une minute est noté
 * dans main.log, puis toutes les cinq minutes, sauf s'il attend une réponse de l'utilisateur.
 * Bandeau (fiche 194) : au bout de cinq minutes de silence, la conversation le montre (`onSilent`),
 * sans jamais couper le tour. Sorti de l'hôte d'agent (fiche 118) pour tenir son plafond de taille.
 */
import { log } from '../log'
import { formatDuration } from './acp-log'

const SILENCE_FIRST_MS = 60_000
const SILENCE_REPEAT_MS = 5 * 60_000
const SILENCE_CHECK_MS = 15_000

/** Silence au bout duquel la conversation montre le bandeau ; `BOBINE_SILENCE_MS` (essais). */
export function silenceBannerMs(env: NodeJS.ProcessEnv = process.env): number {
  const imposed = Number(env['BOBINE_SILENCE_MS'])
  return Number.isFinite(imposed) && imposed > 0 ? imposed : 5 * 60_000
}

export interface SilenceWatch {
  /** Dernier octet reçu de l'agent (horodatage). */
  lastActivity: () => number
  /** L'agent attend l'utilisateur (autorisation, question) : son silence est normal. */
  waiting: () => boolean
  /** D'où vient la ligne du journal : la conversation et l'agent. */
  scope: string
  /**
   * Bandeau (fiche 194) : appelé avec l'heure du dernier octet reçu quand le silence dépasse
   * `bannerMs` hors attente de l'utilisateur, puis avec `undefined` quand il cesse.
   */
  onSilent?: (since: number | undefined) => void
  bannerMs?: number
}

/** Surveille le silence de l'agent pendant un tour ; `clearInterval` à la fin du tour. */
export function watchSilence(watch: SilenceWatch): ReturnType<typeof setInterval> {
  let next = SILENCE_FIRST_MS
  const bannerMs = watch.bannerMs ?? silenceBannerMs()
  let shown = false
  let waitedUntil = 0
  const timer = setInterval(
    () => {
      const now = Date.now()
      const waiting = watch.waiting()
      // L'attente de l'utilisateur (autorisation, question) remet le silence à zéro : il se compte
      // depuis le dernier octet reçu ou la fin de la dernière attente, le plus récent des deux.
      if (waiting) waitedUntil = now
      const since = Math.max(watch.lastActivity(), waitedUntil)
      const silent = !waiting && now - since >= bannerMs
      if (silent !== shown) {
        shown = silent
        watch.onSilent?.(silent ? since : undefined)
      }
      const quiet = now - watch.lastActivity()
      if (quiet < SILENCE_FIRST_MS) {
        next = SILENCE_FIRST_MS
        return
      }
      if (quiet < next || watch.waiting()) return
      log.warn(
        `L’agent n’a rien envoyé depuis ${formatDuration(quiet)} pendant un tour ${watch.scope}`
      )
      next = quiet + SILENCE_REPEAT_MS
    },
    Math.min(SILENCE_CHECK_MS, Math.max(250, bannerMs / 4))
  )
  timer.unref?.()
  return timer
}
