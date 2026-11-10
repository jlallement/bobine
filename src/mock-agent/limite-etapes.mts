/**
 * Limite d'étapes comptée sur toute la session (fiche 209), calquée sur ce qu'on a vu de Bob 2.0.9 :
 * le compte augmente à chaque requête au modèle et n'est jamais remis à zéro pendant la vie de la
 * tâche ; à la limite, le tour s'arrête en `max_turn_requests`, et tout message suivant est refusé
 * aussitôt, sans aucune mise à jour (le message reste quand même dans l'historique). Seuls une
 * relance du processus puis `session/load` reconstruisent la tâche, donc le compteur.
 *
 * Ici, une étape du scénario vaut une requête au modèle. `--max-etapes N` (défaut 3).
 */
import type { ContentBlock } from '../shared/acp-sdk.mts'
import { say } from './langue.mts'
import { playSteps, type Step, type StepLimit, type TurnContext } from './scenario.mts'

/** Limite par défaut, petite pour les essais. */
export const DEFAULT_MAX_STEPS = 3

/** Ce que le tour a fait : refusé sans rien envoyer, arrêté à la limite, ou fini. */
export type LimitedTurn = 'refused' | 'stopped' | 'done'

/** Le message demande de continuer : seulement les étapes de reprise. */
function asksToContinue(prompt: ContentBlock[]): boolean {
  const first = prompt.find((b) => b.type === 'text')
  return first?.type === 'text' && /continu/i.test(first.text)
}

/** Première moitié d'un texte, coupée sur un espace : le message s'arrête en pleine phrase. */
function cut(text: string): string {
  const half = text.slice(0, Math.ceil(text.length / 2))
  const space = half.lastIndexOf(' ')
  return space > 0 ? half.slice(0, space) : half
}

/**
 * Joue le tour dans la limite : `used` étapes déjà faites dans la session, `max` au plus. Rend ce
 * que le tour a fait et le nouveau compte.
 */
export async function playWithinLimit(
  limit: StepLimit,
  workSteps: Step[],
  ctx: TurnContext,
  used: number,
  max: number
): Promise<{ turn: LimitedTurn; used: number }> {
  // Comme `shouldLoop()` de Bob : vérifié avant toute requête, donc rien n'est envoyé.
  if (used >= max) return { turn: 'refused', used }
  const steps = asksToContinue(ctx.prompt) ? limit.continueSteps : workSteps
  let count = used
  for (const [index, step] of steps.entries()) {
    if (count >= max) return { turn: 'stopped', used: count }
    count++
    const last = index === steps.length - 1
    if (count >= max && !last && step.kind === 'text') {
      // Coupé dans la langue de l'agent : une moitié de phrase n'est pas dans son dictionnaire.
      const text = cut(say(step.text, ctx.language ?? 'fr'))
      await playSteps([{ kind: 'text', text }], ctx)
      return { turn: 'stopped', used: count }
    }
    await playSteps([step], ctx)
  }
  return { turn: 'done', used: count }
}

/**
 * Compteurs des sessions : en mémoire du processus (perdus à sa relance), ou, pour une limite
 * `persistent`, dans la session enregistrée (`stepsUsed`).
 */
export class StepCounters {
  private readonly counts = new Map<string, number>()

  used(limit: StepLimit, session: { sessionId: string; stepsUsed?: number }): number {
    return limit.persistent ? (session.stepsUsed ?? 0) : (this.counts.get(session.sessionId) ?? 0)
  }

  set(limit: StepLimit, session: { sessionId: string; stepsUsed?: number }, used: number): void {
    if (limit.persistent) session.stepsUsed = used
    else this.counts.set(session.sessionId, used)
  }
}
