/**
 * Mentions de contexte (fiche 057) : `@git-changes` et `@terminal` joignent au message, à l'envoi,
 * les modifications git du dossier ou la sortie du terminal de la conversation.
 */
import { t } from 'i18next'
export type ContextSource = 'git-changes' | 'terminal'

export interface ContextMention {
  source: ContextSource
  /** Inséré dans le message après `@`. */
  name: string
  label: string
  description: string
}

export const CONTEXT_MENTIONS: readonly ContextMention[] = [
  {
    source: 'git-changes',
    name: 'git-changes',
    get label() {
      return t('mentions.gitChanges.label')
    },
    get description() {
      return t('mentions.gitChanges.description')
    }
  },
  {
    source: 'terminal',
    name: 'terminal',
    get label() {
      return t('mentions.terminal.label')
    },
    get description() {
      return t('mentions.terminal.description')
    }
  }
]

/** Mentions de contexte qui correspondent à ce qui est tapé après `@` (début du nom ou du libellé). */
export function matchContextMentions(query: string): ContextMention[] {
  const q = query.toLowerCase()
  return CONTEXT_MENTIONS.filter((m) => m.name.startsWith(q) || m.label.toLowerCase().startsWith(q))
}
