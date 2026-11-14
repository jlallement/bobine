/**
 * Historique de la saisie (fiche 227) : le renderer dit le message envoyé, tel que tapé ; le main
 * le vérifie et le pose dans le fil de la conversation (`sent-recorded`), qui le garde sur le
 * disque avec elle (corbeille, effacement, réinitialisation : comme le fil).
 */
import type { IpcHandlers } from '@shared/ipc'
import { parseSentEntry } from '@shared/sent-history'
import type { ConversationManager } from './manager'

export function sentHistoryHandlers(
  manager: Pick<ConversationManager, 'post'>
): Pick<IpcHandlers, 'conversation:recordSent'> {
  return {
    'conversation:recordSent': (id, entry) => {
      if (typeof id !== 'string' || !id) throw new Error('Paramètre invalide : id')
      const parsed = parseSentEntry(entry)
      if (!parsed) throw new Error('Paramètre invalide : entry')
      manager.post(id, { type: 'sent-recorded', entry: parsed })
      return undefined
    }
  }
}
