/**
 * Session neuve du même agent (ADR-0030) : repère posé dans le fil quand l'agent ne sait pas
 * reprendre sa session ou l'a perdue. Sorti de `transcript.ts`, qui n'a plus de place (fiche 089).
 */
import type { Handover } from './handover'
import type { TranscriptItem } from './transcript'

/**
 * Ce repère est déjà le dernier, et aucun message ne le suit encore (deux redémarrages sans
 * écrire) : inutile d'en poser un second.
 */
export function renewalPending(items: readonly TranscriptItem[], next: Handover): boolean {
  if (!next.reason) return false
  const at = items.findLastIndex((item) => item.kind === 'handover')
  const last = items[at]
  return (
    last?.kind === 'handover' &&
    !!last.reason &&
    last.to.profileId === next.to.profileId &&
    !items.slice(at + 1).some((item) => item.kind === 'user')
  )
}
