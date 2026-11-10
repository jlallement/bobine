/** Commandes « / » annoncées par l'agent : filtrage pour l'autocomplétion. */
import type { AgentCommand } from './agent'

/**
 * Commandes qui correspondent à ce qui est tapé après « / » : d'abord celles dont le nom commence
 * par la saisie, puis celles qui la contiennent, puis celles dont la description la contient.
 */
export function filterCommands(commands: AgentCommand[], query: string): AgentCommand[] {
  const q = query.toLowerCase()
  if (!q) return [...commands].sort((a, b) => a.name.localeCompare(b.name))
  const rank = (c: AgentCommand) => {
    const name = c.name.toLowerCase()
    if (name.startsWith(q)) return 0
    if (name.includes(q)) return 1
    if (c.description.toLowerCase().includes(q)) return 2
    return 3
  }
  return commands
    .map((c) => ({ c, r: rank(c) }))
    .filter(({ r }) => r < 3)
    .sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name))
    .map(({ c }) => c)
}

/** Saisie en cours d'une commande (« /nom » sans espace), sinon `undefined`. */
export function commandQuery(text: string): string | undefined {
  const match = /^\/(\S*)$/.exec(text)
  return match ? match[1] : undefined
}
