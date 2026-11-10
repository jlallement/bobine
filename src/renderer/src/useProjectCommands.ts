import { useEffect, useState } from 'react'
import type { UserCommand } from '@shared/user-commands'

/**
 * Commandes du projet de la conversation active (fiche 045) : relues au changement de
 * conversation et à chaque début et fin de tour (l'agent peut en avoir écrit).
 */
export function useProjectCommands(
  conversationId: string | null,
  agentBusy: boolean
): UserCommand[] {
  const [loaded, setLoaded] = useState<{ id: string; commands: UserCommand[] } | null>(null)
  useEffect(() => {
    if (!conversationId) return
    const id = conversationId
    window.api.commands
      .project(id)
      .then((commands) => setLoaded({ id, commands }))
      .catch(() => setLoaded({ id, commands: [] }))
  }, [conversationId, agentBusy])
  return loaded && loaded.id === conversationId ? loaded.commands : []
}
