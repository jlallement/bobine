/**
 * Fin anormale d'un tour (fiche 261, mise en commun par la fiche 272) : un avis d'arrêt, de refus,
 * de limite ou d'erreur, sans réponse datée de l'agent après lui. Sert au pied du tour (pas de
 * bilan, « Réessayer ») et au plan (une exécution arrêtée ne fige pas le plan).
 */
import type { TranscriptItem } from './transcript'

/** Avis de fin anormale d'un tour (`STOP_MESSAGES` et `turn-error` de `transcript`, fils d'avant). */
const BAD_ENDS = new Set<string>([
  'transcript.notice.cancelled',
  'transcript.notice.refusal',
  'transcript.notice.maxTokens',
  'transcript.notice.maxTurnRequests',
  'transcript.notice.error'
])

function badEnd(item: TranscriptItem): boolean {
  // Limite d'étapes (fiche 209) : la carte le dit (l'avis `maxTurnRequests` des fils d'avant aussi).
  if (item.kind === 'turn-limit') return true
  return (
    item.kind === 'notice' &&
    (item.level === 'error' || (!!item.message && BAD_ENDS.has(item.message.key)))
  )
}

/** Le tour a fini mal : un avis de fin anormale, sans réponse datée après lui. */
export function endedBadly(turn: readonly TranscriptItem[]): boolean {
  const bad = turn.findLastIndex(badEnd)
  return bad >= 0 && !turn.slice(bad + 1).some((item) => item.kind === 'agent' && item.at)
}
