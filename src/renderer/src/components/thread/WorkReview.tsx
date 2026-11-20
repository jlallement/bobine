import { CircleCheck, ScanSearch, TriangleAlert } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReviewItem } from '@shared/role-request'
import { findingPlace, findingsBySeverity, findingTarget, type DiffTarget } from '@shared/review'
import { reviewedText } from '@shared/review-scope'

/**
 * Ce que le Code reviewer a trouvé, dans sa carte-réponse (fiche 265, écran G des maquettes de la
 * fiche 260, revue UX) : son avis d'ensemble d'abord, puis chaque remarque visible — gravité,
 * `fichier:ligne` qui ouvre le diff sur ces lignes, une phrase — ; « Rien à signaler » sans
 * remarque. Une fois la correction demandée, les pastilles s'effacent un peu. Toujours, ce qui a été
 * relu (« Relu : 4 commits, 12 fichiers (ffa5062..db4a5e1) », fiche 267) : « rien à signaler »
 * ne vaut que pour cette portée.
 */
export function ReviewFindings({
  review,
  role,
  requested = false,
  onShow
}: {
  review: ReviewItem
  /** Nom du relecteur (« Code reviewer »), pour le nom accessible de la liste. */
  role: string
  /** La correction de ses remarques a été demandée. */
  requested?: boolean
  /** Ouvrir la vue Git de la conversation relue sur ce fichier, ces lignes ; absent : texte. */
  onShow?: ((file: DiffTarget) => void) | undefined
}) {
  const { t } = useTranslation()
  const findings = findingsBySeverity(review.findings)
  return (
    <div
      className={`work-review${requested ? ' requested' : ''}`}
      data-testid="work-review"
      data-count={findings.length}
      data-requested={requested || undefined}
    >
      {review.summary && (
        <p className="work-review-summary" data-testid="work-review-summary">
          {review.summary}
        </p>
      )}
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
                      <Place text={place} />
                    </button>
                  ) : (
                    <span className="work-finding-where">
                      <Place text={place} />
                    </span>
                  )}
                  <span className="work-finding-title" data-testid="work-finding-title">
                    {finding.title}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="work-review-scope" data-testid="work-review-scope" data-scope={review.scope}>
        <ScanSearch size={12} aria-hidden />
        {reviewedText(review)}
      </p>
    </div>
  )
}

/** `fichier:ligne`, coupé seulement après une barre oblique quand la carte est étroite. */
function Place({ text }: { text: string }) {
  const parts = text.split('/')
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <>
              /<wbr />
            </>
          )}
        </Fragment>
      ))}
    </>
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
