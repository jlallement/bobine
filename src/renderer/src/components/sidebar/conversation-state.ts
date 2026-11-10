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
  const state = childState(conversation, attention)
  if (!conversation.startedFrom && !attention && state === 'done') return undefined
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
