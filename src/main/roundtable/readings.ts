/**
 * Tour de table (fiche 285) : ce que l'orchestrateur relit des fils, sans état. Les avis et les
 * répliques partent ensuite à l'agent de la conversation seulement par `synthesisRequest` et
 * `verdictRequest` du contrat, qui les encadrent comme des données (`asData`) : rien ici ne les
 * met dans une consigne.
 */
import type { ChildOutcome } from '@shared/children'
import type { Roundtable, RoundtableSeat, RoundtableStepKind } from '@shared/roundtable'
import type { OpinionInput } from '@shared/roundtable-prompts'
import type { TranscriptItem } from '@shared/transcript'
import { turnCost, type ConversationUsage, type UsageDigest } from '@shared/usage'

/**
 * Réponse de l'agent de la conversation à une demande du tour (`from: roundtable`) : le texte de
 * ses réponses entre cette demande et le message suivant. Vide si elle n'a pas (encore) répondu.
 */
export function stepReply(
  items: readonly TranscriptItem[],
  roundtableId: string,
  step: RoundtableStepKind
): string {
  const start = items.findLastIndex(
    (i) =>
      i.kind === 'user' &&
      i.from?.kind === 'roundtable' &&
      i.from.id === roundtableId &&
      i.from.step === step
  )
  if (start === -1) return ''
  const texts: string[] = []
  for (const item of items.slice(start + 1)) {
    if (item.kind === 'user') break
    if (item.kind === 'agent' && item.text.trim()) texts.push(item.text.trim())
  }
  return texts.join('\n\n')
}

/**
 * Dernière réponse d'un participant gardée dans le fil de la mère (compte rendu avec sa carte,
 * fiche 263) : relue après un redémarrage, quand l'orchestrateur ne l'a plus en mémoire.
 */
export function reportReply(
  items: readonly TranscriptItem[],
  childId: string | undefined
): string | undefined {
  if (!childId) return undefined
  const done: ChildOutcome = 'done'
  const report = items.findLast(
    (i) => i.kind === 'child-report' && i.childId === childId && i.outcome === done
  )
  return report?.kind === 'child-report' ? report.reply?.trim() || undefined : undefined
}

const absence = (seat: Pick<RoundtableSeat, 'error' | 'stopped'>) => ({
  ...(seat.error ? { error: seat.error } : {}),
  ...(seat.stopped ? { stopped: seat.stopped } : {})
})

/**
 * Avis tels qu'ils partent à la synthèse : chaque place par sa lettre, le texte d'un participant
 * qui a répondu (conversation non supprimée), sinon la raison de son absence.
 */
export function opinionInputs(
  rt: Pick<Roundtable, 'seats'>,
  text: (seat: RoundtableSeat) => string | undefined
): OpinionInput[] {
  return rt.seats.map((seat): OpinionInput => {
    const base = { letter: seat.letter, ...(seat.changedFolder ? { changedFolder: true } : {}) }
    if (seat.state === 'answered' && !seat.removed) {
      const opinion = text(seat)?.trim()
      return opinion ? { ...base, text: opinion } : { ...base, error: 'agent-error' as const }
    }
    return { ...base, ...absence(seat) }
  })
}

/** Répliques telles qu'elles partent à la décision : seulement les places à qui elle a été demandée. */
export function rebuttalInputs(
  rt: Pick<Roundtable, 'seats'>,
  text: (seat: RoundtableSeat) => string | undefined
): OpinionInput[] {
  return rt.seats.flatMap((seat): OpinionInput[] => {
    const rebuttal = seat.rebuttal
    if (!rebuttal) return []
    const base = { letter: seat.letter, ...(seat.changedFolder ? { changedFolder: true } : {}) }
    if (rebuttal.state === 'answered' && !seat.removed) {
      const reply = text(seat)?.trim()
      return [reply ? { ...base, text: reply } : { ...base, error: 'agent-error' as const }]
    }
    return [{ ...base, ...absence(rebuttal) }]
  })
}

/**
 * Consommation du dernier tour de l'agent d'une conversation, telle qu'il l'a communiquée (fiche
 * 109) : jetons s'il en donne, coût du tour dans son unité s'il a annoncé un coût cumulé. Rien
 * d'estimé ; `undefined` s'il n'a rien communiqué.
 */
export function lastTurnDigest(usage: ConversationUsage | undefined): UsageDigest | undefined {
  const turn = usage?.turns?.at(-1)
  if (!turn) return undefined
  const cost = turnCost(turn)
  const currency = usage?.cost?.currency
  const tokens =
    turn.total !== undefined || turn.input !== undefined || turn.output !== undefined
      ? {
          ...(turn.input !== undefined ? { input: turn.input } : {}),
          ...(turn.output !== undefined ? { output: turn.output } : {}),
          ...(turn.total !== undefined ? { total: turn.total } : {})
        }
      : undefined
  if (!tokens && (cost === undefined || !currency)) return undefined
  return {
    ...tokens,
    turns: 1,
    ...(cost !== undefined && currency ? { cost: { amount: cost, currency } } : {})
  }
}
