import type { AgentSnapshot } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { SilenceBanner } from './SilenceBanner'
import { TurnRetryBanner } from './TurnRetryBanner'
import { WorkingIndicator } from './WorkingIndicator'

/**
 * Fin du fil pendant un tour (sorti d'`App.tsx`, fiche 194) : le bandeau de reprise (fiche 142) à
 * la place de l'indicateur d'activité, et le bandeau de silence sous lui quand l'agent se tait.
 */
export function TurnFooter({
  snapshot,
  conversationId,
  items,
  workspace,
  onRetry,
  onStop
}: {
  snapshot: AgentSnapshot | null | undefined
  conversationId: string | null | undefined
  items: readonly TranscriptItem[]
  workspace: string | undefined
  onRetry: () => void
  onStop: () => void
}) {
  const busy = snapshot?.status === 'busy'
  return (
    <>
      {snapshot?.retry ? (
        <TurnRetryBanner retry={snapshot.retry} onRetry={onRetry} />
      ) : (
        busy &&
        conversationId && (
          <WorkingIndicator
            key={conversationId}
            conversationId={conversationId}
            items={items}
            {...(workspace ? { workspace } : {})}
          />
        )
      )}
      {busy && snapshot.silentSince !== undefined && (
        <SilenceBanner since={snapshot.silentSince} onStop={onStop} />
      )}
    </>
  )
}
