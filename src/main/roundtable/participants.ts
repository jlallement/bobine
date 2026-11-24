/**
 * Participants d'un tour de table (fiche 285, ADR-0072, décision 4) : des conversations filles
 * tenues hors de la machinerie des filles de leur mère. Un seul point pour les reconnaître dans le
 * fil de la mère, sans état en mémoire (vrai aussi après un redémarrage) :
 * - les places de chaque tour (`participantIds` du contrat) ;
 * - les lancements dont la clé de carte est l'identifiant d'un tour (`card = roundtableId`), ce qui
 *   couvre l'instant où la fille est née avant que sa place ne la nomme, et une ancienne
 *   conversation d'une place relancée.
 *
 * Exclus : des nouvelles jointes à l'agent de la mère (`childContext`), du réveil groupé
 * (`children-wake.ts`) et des outils de la mère (`children()` : `child_status`, `message_child`,
 * `recommend_merge`). Leurs comptes rendus restent dans le fil : la carte du tour s'en sert.
 */
import { participantIds } from '@shared/roundtable'
import type { TranscriptItem } from '@shared/transcript'

export function roundtableChildIds(items: readonly TranscriptItem[]): Set<string> {
  const ids = participantIds(items)
  const tours = new Set(items.flatMap((i) => (i.kind === 'roundtable' ? [i.roundtableId] : [])))
  if (tours.size === 0) return ids
  for (const item of items) {
    if (item.kind === 'child-started' && item.card && tours.has(item.card)) ids.add(item.childId)
  }
  return ids
}
