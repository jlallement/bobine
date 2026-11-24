/**
 * Tour de table branché au gestionnaire des conversations (fiche 285), sorti de `index.ts` (taille
 * bornée) : abonné après les filles et le plafond de coût, il suit les participants et la mère ;
 * les fils déjà lus sont réglés tout de suite, les suivants à leur lecture (`settleLoaded`).
 */
import type { ConversationManager } from '../conversations/manager'
import type { ChildOptions } from '../conversations/children'
import { participantRole } from './participant-role'
import { Roundtables, type RoundtableManager, type RoundtablesDeps } from './roundtables'

export function setupRoundtables(
  conversations: RoundtableManager & Pick<ConversationManager, 'subscribe'>,
  deps: Omit<RoundtablesDeps, 'conversations' | 'participantMode'> & {
    /** Mode installé d'un rôle dans un agent (`nativeRoleMode` des filles, fiche 223). */
    nativeRoleMode?: ChildOptions['nativeRoleMode']
  }
): Roundtables {
  const { nativeRoleMode, ...rest } = deps
  const roundtables = new Roundtables({
    ...rest,
    conversations,
    ...(nativeRoleMode
      ? {
          participantMode: (profileId: string, motherId: string) =>
            nativeRoleMode(profileId, participantRole(), motherId)
        }
      : {})
  })
  conversations.subscribe({
    event: (payload) => roundtables.onEvent(payload),
    list: () => roundtables.listChanged(),
    deleted: (id) => roundtables.deleted(id)
  })
  roundtables.settleAlreadyLoaded()
  return roundtables
}
