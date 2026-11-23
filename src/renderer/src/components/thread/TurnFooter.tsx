import type { AgentSnapshot } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { AgentUnreachableBanner } from './AgentUnreachableBanner'
import { SilenceBanner } from './SilenceBanner'
import { TurnRetryBanner } from './TurnRetryBanner'
import { WorkingIndicator } from './WorkingIndicator'
import { hasWorkingFoot } from './TurnSummary'
import { useMemo } from 'react'
import type { ComposerInbox } from '../../useFileDrop'

/**
 * Dernier message de l'utilisateur, celui du tour en cours : remis dans la saisie quand l'agent est
 * relancé (fiche 276) — la relance coupe le tour, rien ne le renvoie à sa place.
 */
export function lastUserText(items: readonly TranscriptItem[]): string | undefined {
  const user = items.findLast((i) => i.kind === 'user' && !i.from && !i.compaction)
  return user?.kind === 'user' && user.text.trim() ? user.text : undefined
}

/**
 * Fin du fil pendant un tour (sorti d'`App.tsx`, fiche 194) : le bandeau de reprise (fiche 142) à
 * la place de l'indicateur d'activité, et le bandeau de silence sous lui quand l'agent se tait.
 * Tour fini mais travail encore en cours (fiche 255) : le pied de la réponse le dit (« Travaille
 * encore… · 32 s », fiche 261) ; l'indicateur ne le répète pas. Sans pied (aucune réponse), il reste.
 * Agent qui ne joint pas son modèle (fiche 275) : son bandeau à la place de l'indicateur et du
 * bandeau de silence, qu'il explique mieux.
 * Bandeau de silence : l'indicateur ne dit plus de verbe (fiche 276, T13). Réglages réseau changés
 * depuis le lancement : « Relancer l'agent », et le message du tour revient dans la saisie, sans
 * partir (fiche 276, T4).
 */
export function TurnFooter({
  snapshot,
  background: afterTurn = false,
  conversationId,
  items,
  workspace,
  onRetry,
  onStop,
  onRestart,
  inbox
}: {
  snapshot: AgentSnapshot | null | undefined
  /** Tour fini, l'agent travaille encore (`ConversationSummary.backgroundWork`, fiche 255). */
  background?: boolean
  conversationId: string | null | undefined
  items: readonly TranscriptItem[]
  workspace: string | undefined
  onRetry: () => void
  onStop: () => void
  /** Relance l'agent de la conversation (même session, fil gardé). */
  onRestart?: () => void
  /** Saisie où remettre le message du tour coupé par la relance. */
  inbox?: ComposerInbox
}) {
  const busy = snapshot?.status === 'busy'
  const background = !busy && afterTurn
  // Travail après le tour déjà dit par le pied de la réponse : une seule fois (revue UX, fiche 261).
  const saidByFoot = useMemo(
    () => background && hasWorkingFoot(items, { busy: false, background: true }),
    [background, items]
  )
  const unreachable =
    snapshot?.status === 'busy' && !snapshot.retry && snapshot.unreachable
      ? {
          view: snapshot.unreachable,
          agent: snapshot.info.agentName ?? snapshot.info.profileLabel,
          proxy: snapshot.proxy
        }
      : undefined
  const networkStale = snapshot?.networkStale === true
  const restart =
    onRestart && conversationId
      ? () => {
          const text = lastUserText(items)
          onRestart()
          if (text) inbox?.prefill({ id: conversationId, text, attachments: [] })
        }
      : undefined
  return (
    <>
      {snapshot?.retry ? (
        <TurnRetryBanner retry={snapshot.retry} onRetry={onRetry} />
      ) : unreachable ? (
        <AgentUnreachableBanner
          unreachable={unreachable.view}
          agent={unreachable.agent}
          proxy={unreachable.proxy}
          networkStale={networkStale}
          onStop={onStop}
          {...(restart ? { onRestart: restart } : {})}
        />
      ) : (
        (busy || (background && !saidByFoot)) &&
        conversationId && (
          <WorkingIndicator
            key={conversationId}
            conversationId={conversationId}
            items={items}
            background={background}
            silent={busy && snapshot.silentSince !== undefined}
            {...(workspace ? { workspace } : {})}
          />
        )
      )}
      {busy && !unreachable && snapshot.silentSince !== undefined && (
        <SilenceBanner
          since={snapshot.silentSince}
          proxy={snapshot.proxy}
          networkStale={networkStale}
          onStop={onStop}
          {...(restart ? { onRestart: restart } : {})}
        />
      )}
    </>
  )
}
