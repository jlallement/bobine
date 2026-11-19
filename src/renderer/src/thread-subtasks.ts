import type { AgentSnapshot, PromptRequest } from '@shared/agent'
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
  send: (text: string, attachments?: [], options?: PromptRequest) => unknown,
  snapshot?: Pick<AgentSnapshot, 'status' | 'queued'> | null
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
    // Le travail visé part avec le message, marqué dans le contexte joint (fiche 263).
    onAsk: (text, about) => send(text, [], about ? { about } : {}),
    ...(snapshot?.status === 'busy' ? { motherBusy: true } : {}),
    ...(snapshot?.queued.length ? { motherQueued: true } : {}),
    ...(agentLabel ? { agentLabel } : {}),
    onWarn: c.warn
  }
}
