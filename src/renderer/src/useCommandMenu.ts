import { useState } from 'react'
import type { AgentCommand } from '@shared/agent'
import { commandQuery, filterCommands } from '@shared/commands'

/**
 * Menu des commandes « / » de la zone de saisie (fiches 017, 039, 045 ; sorti de `Composer`,
 * fiche 089) : ouvert pendant la saisie du nom (« /nom » sans espace), refermé par Échap jusqu'à ce
 * que le texte ne soit plus une commande ; une commande complétée qui attend un argument le rappelle.
 */
export function useCommandMenu(text: string, commands: AgentCommand[]) {
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const query = commandQuery(text)
  const matches = query !== undefined ? filterCommands(commands, query) : []
  const open = query !== undefined && commands.length > 0 && !dismissed
  const typed = /^\/(\S+)\s/.exec(text)?.[1]
  const pendingHint = typed ? commands.find((c) => c.name === typed)?.hint : undefined
  return {
    open,
    matches,
    active,
    setActive,
    dismiss: () => setDismissed(true),
    /** Commande tapée en entier, suivie d'une espace. */
    typed,
    pendingHint,
    /** Le texte change : surlignage en tête ; le menu se rouvrira à la prochaine commande. */
    textChanged: (value: string) => {
      setActive(0)
      if (commandQuery(value) === undefined) setDismissed(false)
    }
  }
}
