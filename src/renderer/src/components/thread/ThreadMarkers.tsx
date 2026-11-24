/**
 * Repères du fil sortis de `Transcript` (taille bornée, fiche 089) : la bascule vers un autre agent
 * ou une session neuve (fiche 108, ADR-0030), et la compaction du contexte.
 */
import {
  ArrowRightLeft,
  ArrowsToAxisDashedHorizontal,
  ChevronRight,
  LoaderCircle,
  RefreshCw
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { handoverName } from '@shared/handover'
import type { TranscriptItem } from '@shared/transcript'
import { Markdown } from './Markdown'

/**
 * La conversation continue avec un autre agent (fiche 108), ou dans une session neuve du même agent
 * (ADR-0030) : un trait, l'agent d'après, et pourquoi.
 */
export function HandoverDivider({ item }: { item: Extract<TranscriptItem, { kind: 'handover' }> }) {
  const { t } = useTranslation()
  const agent = item.to.label
  return (
    <div className="handover-divider" data-testid="handover-divider" data-reason={item.reason}>
      <div className="handover-divider-line">
        {item.reason ? <RefreshCw size={14} /> : <ArrowRightLeft size={14} />}
        <span>
          {item.reason === 'discussion'
            ? t('handover.thread.discussionTitle')
            : item.reason
              ? t('handover.thread.renewTitle', { agent })
              : t('handover.thread.title', { agent: handoverName(item) })}
        </span>
      </div>
      <div className="handover-divider-detail">
        {item.reason === 'no-resume' && t('handover.thread.renewDetailNoResume', { agent })}
        {item.reason === 'session-lost' && t('handover.thread.renewDetailLost', { agent })}
        {item.reason === 'turn-limit' && t('handover.thread.renewDetailTurnLimit', { agent })}
        {item.reason === 'discussion' && t('handover.thread.discussionDetail', { agent })}
        {!item.reason && t('handover.thread.detail', { from: item.from.label })}
      </div>
    </div>
  )
}

/** L'agent a résumé l'échange pour libérer du contexte. */
export function Compaction({ item }: { item: Extract<TranscriptItem, { kind: 'compaction' }> }) {
  const { t } = useTranslation()
  const running = item.status === 'in_progress'
  const failed = item.status === 'failed' || item.status === 'cancelled'
  const label = running
    ? t('transcript.compaction.running')
    : failed
      ? t(
          item.status === 'failed'
            ? 'transcript.compaction.failed'
            : 'transcript.compaction.cancelled'
        )
      : t('transcript.compaction.done')
  return (
    <details className="compaction" data-testid="compaction" data-status={item.status}>
      <summary>
        {running ? (
          <LoaderCircle size={14} className="spin" />
        ) : (
          <ArrowsToAxisDashedHorizontal size={14} />
        )}
        <span>{label}</span>
        {item.summary && <ChevronRight size={13} className="chevron" />}
      </summary>
      {item.summary && (
        <div className="compaction-summary">
          <Markdown text={item.summary} />
        </div>
      )}
      {item.error && <div className="compaction-summary error">{item.error}</div>}
    </details>
  )
}
