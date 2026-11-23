/**
 * Journal (fiche 080) : pendant un tour, un agent qui n'envoie plus rien depuis une minute est noté
 * dans main.log, puis toutes les cinq minutes, sauf s'il attend une réponse de l'utilisateur.
 * Bandeau (fiche 194) : au bout de cinq minutes de silence, la conversation le montre (`onSilent`),
 * sans jamais couper le tour. Sorti de l'hôte d'agent (fiche 118) pour tenir son plafond de taille.
 *
 * « Silence » : rien qui dise que l'agent avance (`agent-progress.ts`) ; des mises à jour d'état
 * seules (un agent qui réessaie de joindre son modèle) ne l'interrompent pas, et le journal dit
 * quand la dernière est arrivée. Le silence se compte au plus tôt depuis le début du tour.
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

/** Horloges de l'agent, tenues par l'hôte à chaque ligne reçue (`agent-progress.ts`). */
export class AgentActivity {
  /** Dernière ligne reçue, mises à jour d'état comprises (journal). */
  last = 0
  /** Dernière ligne qui dit que l'agent avance (bandeau). */
  progress = 0

  reset(at: number): void {
    this.last = this.progress = at
  }

  /** Note une ligne reçue ; rend `progress` (vrai : l'agent avance, le silence cesse). */
  note(progress: boolean, now = Date.now()): boolean {
    this.last = now
    if (progress) this.progress = now
    return progress
  }
}

export interface SilenceWatch {
  activity: Pick<AgentActivity, 'last' | 'progress'>
  /** L'agent attend l'utilisateur (autorisation, question) : son silence est normal. */
  waiting: () => boolean
  /** D'où vient la ligne du journal : la conversation et l'agent. */
  scope: string
  /**
   * Bandeau (fiche 194) : appelé avec l'heure du début du silence quand il dépasse
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
  // L'attente de l'utilisateur (autorisation, question) remet le silence à zéro : il se compte
  // depuis la dernière avancée, le début du tour ou la fin de la dernière attente, le plus récent.
  let floor = Date.now()
  const timer = setInterval(
    () => {
      const now = Date.now()
      const waiting = watch.waiting()
      if (waiting) floor = now
      const since = Math.max(watch.activity.progress, floor)
      const silent = !waiting && now - since >= bannerMs
      if (silent !== shown) {
        shown = silent
        watch.onSilent?.(silent ? since : undefined)
      }
      const quiet = now - since
      if (quiet < SILENCE_FIRST_MS) {
        next = SILENCE_FIRST_MS
        return
      }
      if (quiet < next || waiting) return
      log.warn(silenceLine(quiet, now - watch.activity.last, watch.scope))
      next = quiet + SILENCE_REPEAT_MS
    },
    Math.min(SILENCE_CHECK_MS, Math.max(250, bannerMs / 4))
  )
  timer.unref?.()
  return timer
}

/** Ligne du journal : silence, et la dernière mise à jour d'état reçue entre-temps s'il y en a. */
function silenceLine(quiet: number, sinceStatus: number, scope: string): string {
  const status =
    sinceStatus < quiet
      ? ` (mises à jour d’état seules, la dernière il y a ${formatDuration(sinceStatus)})`
      : ''
  return `L’agent n’a rien envoyé depuis ${formatDuration(quiet)}${status} pendant un tour ${scope}`
}
