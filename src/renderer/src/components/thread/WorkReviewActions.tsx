import { Send } from 'lucide-react'
import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { childState } from '@shared/children'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import type { WorkReviewEntry } from '@shared/work-groups'
import { ipcErrorText } from '../../ipc-errors'
import type { SubtasksInfo } from './Subtasks'
import { askedAbout, relayOf, urgentFindings } from './work-card'
import { settleReviewNotes } from '../../diff-notes-store'
import { WorkLayoutContext } from './work-layout-context'

/**
 * La relecture d'un travail vue depuis sa carte (fiche 265, revue UX) : tourne-t-elle encore
 * (« Faire relire » et « Fusionner » attendent), et reste-t-il une remarque haute ou moyenne à
 * faire corriger (« Faire corriger « … » » devient l'action principale, « Fusionner » passe en
 * secondaire).
 */
export function useWorkReview(
  card: WorkCardData,
  items: readonly TranscriptItem[],
  info: SubtasksInfo | undefined
): { reviewing: boolean; toFix: WorkReviewEntry | undefined } {
  const layout = useContext(WorkLayoutContext)
  const entries = layout?.reviews.get(card.childId) ?? []
  const reviewing = entries.some((entry) => {
    const reviewer = info?.children.find((c) => c.id === entry.card.childId)
    const now = reviewer && childState(reviewer, info?.attention[reviewer.id])
    return now === 'running' || now === 'waiting'
  })
  // La dernière relecture rendue, si ses remarques importantes n'ont été ni demandées ni transmises.
  const last = entries.findLast((entry) => entry.card.review?.status === 'reported')
  const report = last?.card.steps.findLast((s) => s.kind === 'report')
  const relayed = report?.kind === 'report' && relayOf(report.item, items)?.sent === true
  const toFix =
    last && urgentFindings(last.card) > 0 && !askedAbout(last.card, items) && !relayed
      ? last
      : undefined
  return { reviewing, toFix }
}

/** « Faire corriger « Rayons » » : la demande de correction de sa relecture, depuis sa carte. */
export function ReviewFixButton({
  entry,
  name,
  message,
  info
}: {
  entry: WorkReviewEntry
  /** Nom du travail relu. */
  name: string
  message: string
  info: SubtasksInfo | undefined
}) {
  const { t } = useTranslation()
  const [acting, setActing] = useState(false)
  const onAsk = info?.onAsk
  if (!onAsk || info?.motherQueued) return null
  return (
    <button
      type="button"
      className="btn primary small"
      disabled={acting}
      onClick={() => {
        setActing(true)
        void Promise.resolve()
          .then(() => onAsk(message, entry.card.childId))
          .then(() => settleFindings(entry.card))
          .catch((error: unknown) => info.onWarn?.(ipcErrorText(error)))
          .finally(() => setActing(false))
      }}
      data-testid="work-fix-work"
    >
      <Send size={13} aria-hidden />
      {t('workCard.fixWork', { work: name })}
    </button>
  )
}

/**
 * Remarques d'une relecture demandées depuis sa carte (fiche 265) : elles ne repartent pas par
 * « Envoyer à l'agent » du panneau de la conversation relue.
 */
export function settleFindings(card: WorkCardData): void {
  const authorId = card.reviewOf ?? card.review?.authorId
  if (authorId && card.review)
    settleReviewNotes(
      authorId,
      card.review.findings.map((f) => f.id)
    )
}
