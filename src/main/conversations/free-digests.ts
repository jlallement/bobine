/**
 * Résumés de consommation enregistrés avant la fiche 266 : un coût sans `free`. La gratuité est
 * relue une fois du fil sur le disque (modèles de ses tours), sans le garder en mémoire ; un fil
 * illisible est laissé tel quel (il sera mis de côté à son ouverture). Les fils déjà en mémoire
 * sont recalculés par `syncUsage`.
 */
import { freeModels, sameDigest, usageDigest, type ConversationUsage } from '@shared/usage'
import type { TranscriptState } from '@shared/transcript'
import type { ConversationRecord } from './store'

interface Entry {
  record: ConversationRecord
  transcript?: TranscriptState | undefined
}

/** Rend le nombre de résumés complétés. */
export async function settleFreeDigests(
  conversations: Iterable<Entry>,
  store: { readTranscriptAsync: (id: string) => Promise<TranscriptState | undefined> },
  changed: () => void
): Promise<number> {
  let settled = 0
  for (const conversation of [...conversations]) {
    const usage = conversation.record.usage
    if (!usage?.cost || usage.free !== undefined || conversation.transcript) continue
    const read = await store.readTranscriptAsync(conversation.record.id)
    // Relu entre-temps (ouverture) : `syncUsage` l'a déjà fait.
    if (!read || conversation.record.usage !== usage) continue
    conversation.record.usage = { ...usage, free: freeModels(read.usage) }
    settled++
  }
  if (settled > 0) changed()
  return settled
}

/**
 * Résumé de consommation de l'index (fiche 109), recalculé depuis le fil ; posé s'il a changé.
 * Vrai si la fiche a changé.
 */
export function syncDigest(
  record: Pick<ConversationRecord, 'usage'>,
  usage: ConversationUsage | undefined
): boolean {
  const digest = usageDigest(usage)
  if (sameDigest(digest, record.usage)) return false
  if (digest) record.usage = digest
  else delete record.usage
  return true
}
