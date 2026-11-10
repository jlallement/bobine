/**
 * Commande de compaction (fiches 039, 126) : celle que l'agent annonce sous un nom usuel, sinon
 * celle de son profil (`compactCommand`). Règle générique : les noms usuels sont `compact`
 * (OpenCode, Claude Code) et `compress` (Bob), qu'un agent les annonce ou non.
 */
import type { AgentCommand } from '@shared/agent'

const USUAL_NAMES = new Set(['compact', 'compress'])

/** Commande de compaction de la session : annoncée sous un nom usuel, sinon celle du profil. */
export function compactCommandOf(
  commands: readonly AgentCommand[],
  profileCommand: string | undefined
): string | undefined {
  const announced = commands.find((c) => USUAL_NAMES.has(c.name))
  return announced ? `/${announced.name}` : profileCommand
}

/**
 * Le message envoyé demande la compaction : la commande de la session, ou un nom usuel tapé seul.
 * Le fil en fait la carte « Conversation résumée » si l'agent répond en texte (fiche 126).
 */
export function isCompactionRequest(text: string, command: string | undefined): boolean {
  const typed = text.trim()
  return typed === command || (typed.startsWith('/') && USUAL_NAMES.has(typed.slice(1)))
}
