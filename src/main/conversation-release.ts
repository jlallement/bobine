/**
 * Ce qu'une conversation laisse derrière elle quand elle est supprimée, archivée ou évincée
 * (fiche 043) : ses pages du navigateur intégré et ses terminaux. Sorti de `index.ts` (taille
 * bornée, fiche 089).
 */
import type { ConversationManagerOptions } from './conversations/manager'

interface Releasable {
  terminals: { closeConversation: (id: string) => void }
  browser: { close: (id: string) => void }
  browserTools: { forget: (id: string) => void }
}

export function conversationRelease({
  terminals,
  browser,
  browserTools
}: Releasable): Pick<ConversationManagerOptions, 'onDeleted' | 'onReleased'> {
  return {
    onDeleted: (id) => {
      terminals.closeConversation(id)
      browser.close(id)
      browserTools.forget(id)
    },
    // Archivée : ses pages et ses terminaux sont fermés. Évincée (agent arrêté pour faire de la
    // place, à l'insu de l'utilisateur) : seulement ses pages ; ses shells, où quelque chose peut
    // tourner, restent (fiche 043).
    onReleased: (id, reason) => {
      browser.close(id)
      browserTools.forget(id)
      if (reason === 'archived') terminals.closeConversation(id)
    }
  }
}
