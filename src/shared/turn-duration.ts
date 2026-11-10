/**
 * Durée d'un tour (fiche 156) : de l'envoi du message à la fin de la réponse de l'agent. Dérivée
 * des heures déjà gardées dans le fil (`user.at`, `agent.at`) : un fil gardé la retrouve telle
 * quelle, un tour rejoué par l'agent (sans heures) n'en a pas.
 */
import type { TranscriptItem } from './transcript'

/** Id de la dernière réponse de chaque tour → durée du tour (ms). */
export function turnDurations(items: TranscriptItem[]): Map<number, number> {
  const durations = new Map<number, number>()
  let sentAt: number | undefined
  let lastReply: Extract<TranscriptItem, { kind: 'agent' }> | undefined
  const close = () => {
    if (sentAt !== undefined && lastReply?.at !== undefined && lastReply.at >= sentAt) {
      durations.set(lastReply.id, lastReply.at - sentAt)
    }
  }
  for (const item of items) {
    if (item.kind === 'user') {
      close()
      sentAt = item.at
      lastReply = undefined
    } else if (item.kind === 'agent') {
      lastReply = item
    }
  }
  close()
  return durations
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
