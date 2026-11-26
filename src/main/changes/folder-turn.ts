/**
 * Un tour en cours écrit-il dans ce dossier ? (fiche 287) Avant « Committer puis fusionner », le
 * main refuse tant qu'un agent travaille dans le dossier principal du dépôt : sinon le commit part,
 * l'agent écrit encore, et la fusion est refusée juste après (commit partiel, recette Bricole).
 */
import type { AttentionState } from '@shared/attention'
import type { ConversationSummary } from '@shared/agent'
import { childState } from '@shared/children'
import { isInside } from '../agent/write-area'

type Listed = Pick<
  ConversationSummary,
  'id' | 'title' | 'workspace' | 'status' | 'turnStopped' | 'branch' | 'archived'
>

/** Son agent travaille (tour en cours) ou attend un accord : son dossier peut encore bouger. */
export function inTurn(conversation: Listed, attention: AttentionState = {}): boolean {
  const state = childState(conversation, attention[conversation.id])
  return state === 'running' || state === 'waiting'
}

/**
 * Première conversation dont le tour écrit dans `root` (dossier principal d'un dépôt) : hors
 * worktree (un worktree est un autre dossier), non archivée, son dossier dans `root`, au travail.
 */
export function turnInFolder<C extends Listed>(
  conversations: readonly C[],
  root: string,
  attention: AttentionState = {}
): C | undefined {
  return conversations.find(
    (c) =>
      !c.branch &&
      !c.archived &&
      !!c.workspace &&
      isInside(root, c.workspace) &&
      inTurn(c, attention)
  )
}
