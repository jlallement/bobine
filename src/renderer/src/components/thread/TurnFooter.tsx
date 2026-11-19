import type { AgentSnapshot } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { SilenceBanner } from './SilenceBanner'
import { TurnRetryBanner } from './TurnRetryBanner'
import { WorkingIndicator } from './WorkingIndicator'
import { hasWorkingFoot } from './TurnSummary'
import { useMemo } from 'react'

/**
 * Fin du fil pendant un tour (sorti d'`App.tsx`, fiche 194) : le bandeau de reprise (fiche 142) à
 * la place de l'indicateur d'activité, et le bandeau de silence sous lui quand l'agent se tait.
 * Tour fini mais travail encore en cours (fiche 255) : le pied de la réponse le dit (« Travaille
 * encore… · 32 s », fiche 261) ; l'indicateur ne le répète pas. Sans pied (aucune réponse), il reste.
 */
export function TurnFooter({
  snapshot,
  background: afterTurn = false,
  conversationId,
  items,
  workspace,
  onRetry,
  onStop
}: {
  snapshot: AgentSnapshot | null | undefined
  /** Tour fini, l'agent travaille encore (`ConversationSummary.backgroundWork`, fiche 255). */
  background?: boolean
  conversationId: string | null | undefined
  items: readonly TranscriptItem[]
  workspace: string | undefined
  onRetry: () => void
  onStop: () => void
}) {
  const busy = snapshot?.status === 'busy'
  const background = !busy && afterTurn
  // Travail après le tour déjà dit par le pied de la réponse : une seule fois (revue UX, fiche 261).
  const saidByFoot = useMemo(
    () => background && hasWorkingFoot(items, { busy: false, background: true }),
    [background, items]
  )
  return (
    <>
      {snapshot?.retry ? (
        <TurnRetryBanner retry={snapshot.retry} onRetry={onRetry} />
      ) : (
        (busy || (background && !saidByFoot)) &&
        conversationId && (
          <WorkingIndicator
            key={conversationId}
            conversationId={conversationId}
            items={items}
            background={background}
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
