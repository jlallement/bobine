import { t } from 'i18next'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionDetail, AttentionKind } from '@shared/attention'
import { childState, type ChildState } from '@shared/children'
import { inboxEntries, inboxReason } from '@shared/inbox'

/** État propre d'une ligne ; aucune agrégation des filles dans la ligne de leur mère. */
export function conversationState(
  conversation: ConversationSummary,
  attention: AttentionKind | undefined,
  detail: AttentionDetail | undefined,
  preparing = false
): { state: ChildState; label: string; reason?: string } | undefined {
  if (preparing) return { state: 'running', label: t('children.preparing') }
  // Tour fini, l'agent travaille encore (sous-agent en arrière-plan, fiche 255) : « En cours »,
  // pas « Réponse à lire » ; ce qui attend l'utilisateur ou une erreur passe avant.
  if (conversation.backgroundWork && (attention === undefined || attention === 'done')) {
    return { state: 'running', label: t('children.state.running') }
  }
  const state = childState(conversation, attention)
  // Conversation ordinaire finie ou arrêtée : rien à signaler (l'arrêt ne vaut que pour une fille).
  if (!conversation.startedFrom && !attention && (state === 'done' || state === 'stopped'))
    return undefined
  const entry = attention
    ? inboxEntries(
        [conversation],
        { [conversation.id]: attention },
        detail ? { [conversation.id]: detail } : {}
      )[0]
    : undefined
  if (entry) return { state, label: inboxReason(entry), reason: entry.reason }
  const label =
    conversation.status === 'starting' ? t('sidebar.status.starting') : t(`children.state.${state}`)
  return { state, label }
}
