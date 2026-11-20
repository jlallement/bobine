import { ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReviewItem } from '@shared/role-request'
import { findingPlace, findingsBySeverity, findingTarget, type DiffTarget } from '@shared/review'
import { Markdown } from './Markdown'

/**
 * Ce que le Code reviewer a trouvé, dans sa carte-réponse (fiche 265, écran G des maquettes de la
 * fiche 260) : chaque remarque visible — gravité, `fichier:ligne` qui ouvre le diff sur ce fichier,
 * une phrase —, puis son avis d'ensemble ; « Rien à signaler » sans remarque. Le reste de sa
 * réponse est replié : ses remarques le disent déjà.
 */
export function ReviewFindings({
  review,
  role,
  reply,
  onShow
}: {
  review: ReviewItem
  /** Nom du relecteur (« Code reviewer »), pour le nom accessible de la liste. */
  role: string
  /** Sa réponse du tour, entière ; repliée sous ses remarques. */
  reply: string
  /** Ouvrir la vue Git de la conversation relue sur ce fichier, ces lignes ; absent : texte. */
  onShow?: ((file: DiffTarget) => void) | undefined
}) {
  const { t } = useTranslation()
  const findings = findingsBySeverity(review.findings)
  return (
    <div className="work-review" data-testid="work-review" data-count={findings.length}>
      {findings.length === 0 ? (
        <div className="work-review-clean" data-testid="work-findings-clean">
          <CircleCheck size={14} aria-hidden />
          {t('workCard.findings.clean')}
        </div>
      ) : (
        <ul
          className="work-findings"
          aria-label={t('workCard.findings.label', { role })}
          data-testid="work-findings"
        >
          {findings.map((finding) => {
            const place = findingPlace(finding)
            return (
              <li
                key={finding.id}
                className="work-finding"
                data-testid="work-finding"
                data-severity={finding.severity}
              >
                <span className={`review-severity ${finding.severity}`}>
                  {t(`review.severity.${finding.severity}`)}
                </span>
                <span className="work-finding-text">
                  {onShow ? (
                    <button
                      type="button"
                      className="work-finding-where"
                      title={t('workCard.findings.where', { place })}
                      onClick={() => onShow(findingTarget(finding, review))}
                      data-testid="work-finding-where"
                    >
                      {place}
                    </button>
                  ) : (
                    <span className="work-finding-where">{place}</span>
                  )}
                  <span data-testid="work-finding-title">{finding.title}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {review.summary && (
        <p className="work-review-summary" data-testid="work-review-summary">
          {review.summary}
        </p>
      )}
      {reply && (
        <details className="work-agent-note work-review-reply" data-testid="work-review-reply">
          <summary>
            <span>{t('workCard.findings.reply')}</span>
            <ChevronRight size={13} className="chevron" aria-hidden />
          </summary>
          <div className="work-review-reply-text">
            <Markdown text={reply} />
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * Le dossier relu a changé pendant un tour du relecteur (empreinte, fiche 177) : les lignes citées
 * ont pu bouger. Dit dans sa carte, quel que soit son état.
 */
export function ReviewChanged({ review }: { review: ReviewItem | undefined }) {
  const { t } = useTranslation()
  if (!review?.changed) return null
  return (
    <p className="work-review-changed" role="status" data-testid="work-review-changed">
      <TriangleAlert size={13} aria-hidden />
      {t('review.card.changed')}
    </p>
  )
}
