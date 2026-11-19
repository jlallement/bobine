/**
 * Durée d'un tour (fiche 156) : de l'envoi du message à la fin de la réponse de l'agent. Dérivée
 * des heures déjà gardées dans le fil (`user.at`, `agent.at`) : un fil gardé la retrouve telle
 * quelle, un tour rejoué par l'agent (sans heures) n'en a pas.
 *
 * C'est le temps de travail de l'agent (fiche 255) : le temps passé à attendre l'utilisateur
 * (autorisation, question, propositions — demandes datées, `askedAt` / `answeredAt`) en est retiré,
 * et compté à part. La réponse donnée hors tour au rapport d'un sous-agent en arrière-plan finit le
 * tour quand le fil l'a datée (fin du `background-work`).
 */
import type { TranscriptItem } from './transcript'

export interface TurnTime {
  /** Temps de travail de l'agent (ms), attente de l'utilisateur retirée. */
  ms: number
  /** Temps passé à attendre l'utilisateur pendant le tour (ms). */
  waitedMs: number
}

type Interval = [number, number]
type Wait = { from: number; to?: number }

/** Id de la dernière réponse de chaque tour → temps de travail et attente. */
export function turnTimes(items: readonly TranscriptItem[]): Map<number, TurnTime> {
  const times = new Map<number, TurnTime>()
  let sentAt: number | undefined
  let lastReply: Extract<TranscriptItem, { kind: 'agent' }> | undefined
  let waits: Wait[] = []
  const close = () => {
    const end = lastReply?.at
    if (sentAt === undefined || !lastReply || end === undefined || end < sentAt) return
    const start = sentAt
    // Demande sans réponse (annulée en fin de tour) : attendue jusqu'à la fin.
    const waitedMs = covered(
      waits.map(({ from, to }): Interval => [Math.max(from, start), Math.min(to ?? end, end)])
    )
    times.set(lastReply.id, { ms: end - start - waitedMs, waitedMs })
  }
  for (const item of items) {
    if (item.kind === 'user') {
      close()
      sentAt = item.at
      lastReply = undefined
      waits = []
    } else if (item.kind === 'agent') {
      // Une réponse sans heure après la réponse datée du tour : l'agent a reparlé de lui-même, hors
      // tour (OpenCode 2.3.0, fiche 232) ; le tour, lui, a fini avec la réponse datée.
      if (item.at !== undefined || lastReply?.at === undefined) lastReply = item
    } else {
      const asked = askedOf(item)
      if (asked) waits.push(asked)
    }
  }
  close()
  return times
}

/** Id de la dernière réponse de chaque tour → temps de travail du tour (ms). */
export function turnDurations(items: readonly TranscriptItem[]): Map<number, number> {
  return new Map([...turnTimes(items)].map(([id, time]) => [id, time.ms]))
}

/** Demande faite à l'utilisateur par cet élément, et sa réponse, si elles sont datées. */
function askedOf(item: TranscriptItem): Wait | undefined {
  const asked =
    item.kind === 'elicitation' ? item : item.kind === 'tool' ? item.permission : undefined
  if (asked?.askedAt === undefined) return undefined
  return asked.answeredAt === undefined
    ? { from: asked.askedAt }
    : { from: asked.askedAt, to: asked.answeredAt }
}

/** Longueur couverte par des intervalles qui peuvent se chevaucher (questions simultanées). */
function covered(intervals: Interval[]): number {
  let total = 0
  let reach = -Infinity
  for (const [from, to] of intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])) {
    const start = Math.max(from, reach)
    if (to > start) total += to - start
    reach = Math.max(reach, to)
  }
  return total
}

/** Heures, minutes et secondes d'une durée, arrondie à la seconde. */
export function durationParts(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(ms / 1000))
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  }
}
