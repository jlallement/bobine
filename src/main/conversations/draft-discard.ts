/**
 * Conversation vide quittée sans message (sortie de `ConversationManager`, fiche 272) : plus rien
 * n'est émis pour elle, sa session vide est supprimée chez l'agent (suivie dans `dropping`), son
 * worktree encore intact et son dossier de discussion sans document disparaissent.
 */
import type { Worktrees } from '../changes/worktrees'
import type { Conversation } from './conversation'
import { dropDraftFolder } from './discussion-space'
import { AGENT_DELETE_TIMEOUT_MS, trackDraftDrop } from './helpers'

export function discardDraft(
  conversation: Conversation,
  context: {
    conversations: Map<string, Conversation>
    dropping: Set<Promise<void>>
    worktrees: Pick<Worktrees, 'remove'> | undefined
    conversationsDir: string
  }
): void {
  const host = conversation.host
  // Plus rien n'est émis pour elle (l'hôte peut encore vivre le temps de supprimer sa session).
  conversation.host = undefined
  if (host) trackDraftDrop(context.dropping, host, AGENT_DELETE_TIMEOUT_MS)
  context.conversations.delete(conversation.record.id)
  // Conversation en worktree quittée sans message : le worktree, encore intact, disparaît aussi
  // (sans `force` : s'il a été modifié entre-temps, il reste).
  const { worktree } = conversation.record
  if (worktree) void context.worktrees?.remove(worktree).catch(() => {})
  // Discussion quittée sans message (fiche 224) : son dossier part s'il n'a aucun document.
  dropDraftFolder(context.conversationsDir, conversation.record)
}
