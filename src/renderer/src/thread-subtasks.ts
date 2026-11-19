import { childrenOf } from '@shared/children-rows'
import type { SubtasksInfo } from './components/thread/Subtasks'
import type { ChildrenMergeActions } from './components/thread/SubtasksMerge'
import type { useConversations } from './useConversations'

type Conversations = Pick<
  ReturnType<typeof useConversations>,
  'activeId' | 'activeSummary' | 'list' | 'attention' | 'select' | 'settings' | 'warn'
>

/**
 * Ce que le fil sait des travaux confiés depuis la conversation affichée (fiches 097, 263) : ses
 * filles, leur état, et ce que leurs cartes peuvent faire (ouvrir, fusionner, envoyer à l'agent de
 * la conversation un message préparé, dire un échec).
 */
export function threadSubtasks(
  c: Conversations,
  merge: ChildrenMergeActions,
  send: (text: string) => void
): SubtasksInfo {
  const profiles = c.settings?.profiles ?? []
  const agentLabel = profiles.find((p) => p.id === c.activeSummary?.profileId)?.label
  return {
    children: childrenOf(c.activeId, c.list),
    attention: c.attention,
    onOpen: c.select,
    profiles,
    ...(c.activeId ? { motherId: c.activeId } : {}),
    merge,
    onAsk: send,
    ...(agentLabel ? { agentLabel } : {}),
    onWarn: c.warn
  }
}
