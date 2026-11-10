import { CircleAlert, CircleCheck, CircleDashed, ScanSearch, TriangleAlert } from 'lucide-react'
import { memo, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { severeCount, type ReviewStatus } from '@shared/review'
import type { TranscriptItem } from '@shared/transcript'
import { ReportExcerpt, useUsageText } from './Subtasks'

type ReviewItem = Extract<TranscriptItem, { kind: 'review' }>

const ICONS: Record<ReviewStatus, typeof CircleCheck> = {
  running: CircleDashed,
  reported: ScanSearch,
  silent: CircleAlert,
  failed: CircleAlert
}

/**
 * Carte « Relecture » du fil de la conversation relue (fiche 177) : une par relecture, mise à jour
 * à chaque étape. Remarques rendues : leur nombre, les hautes, l'avis d'ensemble, et « Voir sur le
 * diff » (vue Git de l'onglet Modifications, où elles sont devenues des remarques de diff). Coût du
 * relecteur ; dossier changé pendant la relecture : un avertissement.
 */
export const ReviewCard = memo(function ReviewCard({
  item,
  onOpen,
  onShowNotes
}: {
  item: ReviewItem
  onOpen?: (id: string) => void
  onShowNotes?: () => void
}) {
  const { t } = useTranslation()
  const usageText = useUsageText()
  const usage = usageText(item.usage)
  const replyId = useId()
  const count = item.findings.length
  const severe = severeCount(item)
  const agent = item.profileLabel
  const headline =
    item.status === 'running'
      ? t('review.card.running', { agent })
      : item.status === 'silent'
        ? t('review.card.silent', { agent })
        : item.status === 'failed'
          ? t('review.card.failed', { error: item.error ?? '' })
          : count === 0
            ? t('review.card.none', { agent })
            : t('review.card.reported', { agent, count })
  const tone =
    item.status === 'reported'
      ? severe > 0
        ? 'severe'
        : count > 0
          ? 'some'
          : 'clean'
      : item.status
  const Icon = item.status === 'reported' && count === 0 ? CircleCheck : ICONS[item.status]
  return (
    <div
      className={`child-report review-card ${tone}`}
      data-testid="review-card"
      data-status={item.status}
      data-review-id={item.reviewId}
      data-count={count}
    >
      <Icon size={14} className="child-report-icon" />
      <div className="child-report-body">
        <div className="child-report-head">
          <strong className="child-report-title" data-testid="review-card-title">
            {headline}
          </strong>
          {usage && (
            <span
              className="child-report-usage"
              title={t('children.report.usage')}
              data-testid="review-card-usage"
            >
              {usage}
            </span>
          )}
        </div>
        <div className="child-report-meta">
          <span>
            {item.scope === 'branch' && item.base
              ? t('review.card.scopeBranch', { base: item.base })
              : t('review.card.scopeUncommitted')}
          </span>
          {item.files > 0 && <span>{t('review.card.files', { count: item.files })}</span>}
          {severe > 0 && (
            <span className="review-severe" data-testid="review-card-severe">
              {t('review.card.severe', { count: severe })}
            </span>
          )}
        </div>
        {item.summary && <p className="review-summary">{item.summary}</p>}
        {/* Sans `report_findings` : la relecture en texte libre, pour ne pas la perdre. */}
        {item.reply && item.status !== 'reported' && (
          <div className="review-reply" data-testid="review-card-reply">
            <ReportExcerpt id={replyId} text={item.reply} />
          </div>
        )}
        {item.changed && (
          <p className="review-changed" role="status" data-testid="review-card-changed">
            <TriangleAlert size={13} aria-hidden /> {t('review.card.changed')}
          </p>
        )}
        <div className="review-actions">
          {count > 0 && onShowNotes && (
            <button className="btn small" onClick={onShowNotes} data-testid="review-card-show">
              {t('review.card.showNotes')}
            </button>
          )}
          {onOpen && (
            <button
              className="btn small ghost"
              onClick={() => onOpen(item.reviewId)}
              data-testid="review-card-open"
            >
              {t('review.card.open')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
