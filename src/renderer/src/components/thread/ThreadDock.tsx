import type { ReactNode } from 'react'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import type { TranscriptItem } from '@shared/transcript'
import { PinnedPlan } from './PinnedPlan'
import { ScrollDownButton } from './ScrollDownButton'
import { DelegatedWorkCue } from './WorkCue'

/**
 * Bas de la conversation, sous le fil (sorti d'`App.tsx`, fiche 261) : la flèche « Aller en bas »
 * (fiche 050), le plan épinglé (fiche 077), la carte d'aparté, le repère des travaux qui ont répondu
 * hors de l'écran (fiche 261), puis la zone de saisie.
 */
export function ThreadDock({
  conversationId,
  items,
  atBottom,
  onScrollDown,
  pinnedPlan,
  aside,
  composer,
  conversations,
  attention,
  scroller,
  onReveal
}: {
  conversationId: string | null
  items: readonly TranscriptItem[]
  atBottom: boolean
  onScrollDown: () => void
  pinnedPlan: Extract<TranscriptItem, { kind: 'plan' }> | undefined
  aside: ReactNode
  composer: ReactNode
  /** Conversations filles de celle-ci (liste des conversations), pour le repère. */
  conversations: readonly ConversationSummary[]
  attention: AttentionState
  /** Élément qui fait défiler le fil. */
  scroller: { readonly current: HTMLElement | null }
  /** Rendre un élément d'un long fil pas encore rendu (fiche 193). */
  onReveal: (itemId: number) => void
}) {
  return (
    <div className="column thread-dock" style={{ width: '100%' }}>
      <ScrollDownButton
        atBottom={atBottom}
        items={items}
        conversation={conversationId}
        onClick={onScrollDown}
      />
      {pinnedPlan && <PinnedPlan key={`tasks-${conversationId}`} entries={pinnedPlan.entries} />}
      {aside}
      <DelegatedWorkCue
        key={conversationId ?? ''}
        items={items}
        childConversations={conversations}
        attention={attention}
        scroller={scroller}
        onReveal={onReveal}
      />
      {composer}
    </div>
  )
}
