/**
 * Contenu de `@terminal` (fiche 057) : les dernières lignes du terminal de la conversation (son
 * onglet le plus récent), en texte, joint au message. Sans terminal, le texte le dit.
 */
import type { TerminalManager } from './terminal-manager'

/** Lignes jointes au plus (la fin de la sortie, là où sont les erreurs). */
export const MAX_TERMINAL_LINES = 200

export async function terminalText(
  terminals: Pick<TerminalManager, 'list' | 'read'>,
  conversationId: string
): Promise<string> {
  const tab = terminals.list(conversationId).at(-1)
  if (!tab) return 'Aucun terminal n’est ouvert dans cette conversation.'
  // Icônes des thèmes d'invite (Powerline, Nerd Fonts : zone d'usage privé d'Unicode) : du bruit
  // pour l'agent.
  const output = (await terminals.read(conversationId, tab.id, MAX_TERMINAL_LINES))
    .replace(/[\uE000-\uF8FF]/gu, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
  if (!output.trim()) return `Le terminal « ${tab.title} » est vide.`
  return [
    `Terminal « ${tab.title} » (${MAX_TERMINAL_LINES} dernières lignes au plus) :`,
    '```',
    output,
    '```'
  ].join('\n')
}
