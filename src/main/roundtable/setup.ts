/**
 * Tour de table branché au gestionnaire des conversations (fiche 285), sorti de `index.ts` (taille
 * bornée) : abonné après les filles et le plafond de coût, il suit les participants et la mère ;
 * les fils déjà lus sont réglés tout de suite, les suivants à leur lecture (`settleLoaded`).
 */
import type { ConversationManager } from '../conversations/manager'
import type { ChildOptions } from '../conversations/children'
import { gitRun } from '../git/git-queue'
import { participantRole } from './participant-role'
import { stepFolder } from './step-folder'
import { AgentModels, type AgentModelsDeps } from './agent-models'
import { Roundtables, type RoundtableManager, type RoundtablesDeps } from './roundtables'

export function setupRoundtables(
  conversations: RoundtableManager & Pick<ConversationManager, 'subscribe'>,
  deps: Omit<RoundtablesDeps, 'conversations' | 'participantMode'> & {
    /** Mode installé d'un rôle dans un agent (`nativeRoleMode` des filles, fiche 223). */
    nativeRoleMode?: ChildOptions['nativeRoleMode']
    /** Essai d'un agent hors conversation : réglages de sa session (`ConversationManager.checkAgent`). */
    checkModels?: AgentModelsDeps['check']
  }
): Roundtables {
  const { nativeRoleMode, checkModels, ...rest } = deps
  const models = checkModels
    ? new AgentModels({
        check: checkModels,
        note: (id, controls) => conversations.settings.noteModels(id, controls)
      })
    : undefined
  const roundtables = new Roundtables({
    folder: stepFolder(gitRun),
    ...(models ? { models } : {}),
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
