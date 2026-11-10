/**
 * Disque plein en quittant (fiche 197) : avant que l'app ne s'arrête, les fils sont écrits ; si
 * des conversations restent non enregistrées, une alerte le dit, avec « Réessayer » par défaut —
 * aussi pour Échap et ⌘. : une touche réflexe ne jette jamais rien — et revient tant que ça
 * échoue (on libère de la place pendant qu'elle attend). Personne pour répondre (arrêt du Mac ou
 * signal, même survenu pendant l'alerte), ou pas de réponse avant le délai : l'alerte se ferme et
 * c'est noté pour le lancement suivant.
 *
 * N'importe pas `electron` : la boîte est injectée (testable sous Vitest).
 */
import { t } from 'i18next'
import { translate } from '@shared/i18n/message'
import { log } from './log'
import { namesOf } from './profile-startup'
import { plainError } from './profile-status'

export interface UnsavedQuestion {
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
}

/** Au-delà, sans réponse, l'alerte se ferme et la perte est notée pour le lancement suivant. */
export const UNSAVED_QUESTION_MS = 5 * 60_000

export interface UnsavedDeps {
  /** Quelqu'un peut répondre (pas un arrêt du Mac ni un signal) ; relu à chaque tour. */
  interactive: () => boolean
  /** Titres des conversations dont les derniers messages ne sont pas sur le disque. */
  unsaved: () => string[]
  /** Dernière erreur d'écriture (disque plein…). */
  lastError: () => unknown
  /** Écrit (ou réécrit) les fils, une fois les écritures en vol finies. */
  retry: () => void | Promise<void>
  /** Pose la question, rend l'index du bouton choisi ; `signal` la ferme. */
  ask: (question: UnsavedQuestion, signal: AbortSignal) => Promise<number>
  /** Note pour le lancement suivant. */
  note: (titles: string[], error: unknown) => void
  /** Ferme l'alerte de l'extérieur (arrêt du Mac, signal) ; rend la fonction qui le fait. */
  onAbort?: (abort: () => void) => void
  timeoutMs?: number
}

export type UnsavedOutcome = 'saved' | 'discarded' | 'noted'

/** La question à poser pour ces conversations. */
export function unsavedQuestion(titles: readonly string[], error: unknown): UnsavedQuestion {
  const count = titles.length
  const reason = t(
    plainError(error).key === 'profile.error.diskFull'
      ? 'profile.quit.diskFull'
      : 'profile.quit.failed'
  )
  return {
    message: t('profile.quit.title', { count, names: translate(namesOf(titles)) }),
    detail: t('profile.quit.detail', { count, reason }),
    buttons: [t('profile.quit.retry'), t('profile.quit.discard', { count })],
    defaultId: 0,
    // Échap, ⌘. : « Réessayer », jamais « Quitter sans les enregistrer ».
    cancelId: 0
  }
}

export async function keepUnsaved(deps: UnsavedDeps): Promise<UnsavedOutcome> {
  const controller = new AbortController()
  deps.onAbort?.(() => controller.abort())
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? UNSAVED_QUESTION_MS)
  try {
    await deps.retry()
    for (;;) {
      const titles = deps.unsaved()
      if (titles.length === 0) return 'saved'
      if (!deps.interactive() || controller.signal.aborted) {
        deps.note(titles, deps.lastError())
        return 'noted'
      }
      const answer = await deps.ask(unsavedQuestion(titles, deps.lastError()), controller.signal)
      // Fermée de l'extérieur (arrêt, délai) : la réponse rendue n'est pas celle de quelqu'un.
      if (controller.signal.aborted) continue
      if (answer !== 0) {
        log.error('Quitté sans enregistrer :', titles)
        return 'discarded'
      }
      await deps.retry()
    }
  } finally {
    clearTimeout(timer)
  }
}
