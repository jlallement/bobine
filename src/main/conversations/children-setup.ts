/**
 * Conversations filles branchées au gestionnaire (sorti de `index.ts`, taille bornée) : compte
 * rendu posé chez la mère à chaque fin de tour, après l'évènement de la fille parti vers les
 * fenêtres ; réveil groupé de la mère ; oubli d'une conversation supprimée.
 */
import { ChildConversations, type ChildHost, type ChildOptions } from './children'
import type { ConversationManager } from './manager'

export function setupChildren(
  conversations: ChildHost & Pick<ConversationManager, 'subscribe'>,
  options: ChildOptions
): ChildConversations {
  const children = new ChildConversations(conversations, options)
  conversations.subscribe({
    event: (payload) => children.onEvent(payload),
    list: () => children.listChanged(),
    deleted: (id) => children.forget(id)
  })
  return children
}
