import { useEffect, useRef } from 'react'
import type { MenuCommand } from '@shared/shortcuts'

/**
 * Commandes du menu macOS et de leurs raccourcis (fiche 027) : un seul abonnement pour la fenêtre,
 * et chaque commande faite avec ce que le dernier rendu lui a donné (l'état courant).
 */
export function useMenuCommands(commands: Record<MenuCommand, () => void>): void {
  const latest = useRef(commands)
  useEffect(() => {
    latest.current = commands
  })
  // Une commande inconnue (autre version du main) ne fait rien.
  useEffect(() => window.api.app.onCommand((command) => latest.current[command]?.()), [])
}
