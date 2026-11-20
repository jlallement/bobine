import { ScanSearch } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitFileDiff } from '@shared/changes'
import { reviewRange } from '@shared/review-scope'
import { ipcErrorText } from '../../ipc-errors'
import { DiffView, type DiffFocus } from '../thread/DiffView'

/**
 * Le fichier d'une remarque du Code reviewer qui relit une branche ou des commits (fiches 265,
 * 267) : son diff depuis le point relu (`since` : la base de la branche, le début de la plage), et
 * pas seulement contre `HEAD` — une remarque sur une ligne déjà commitée s'y voit, mise en avant.
 *
 * - Portée toute commitée (`until`) : le diff **relu**, de `since` à `until`, même si le fichier a
 *   été corrigé depuis ; la vue le dit (recette N2 : « Aucune modification » après le correctif).
 * - Sinon (non commité relu aussi) : contre le disque, relu à chaque relecture du dépôt
 *   (`refresh`) — avant, lu une fois et jamais rafraîchi.
 * - Fichier inchangé dans la portée : les lignes citées, telles qu'elles sont, mises en avant
 *   (revue UX), plutôt qu'un « Aucune modification » sans explication.
 * - Corrigé depuis : dit en court, avec « Voir la version actuelle » (le diff jusqu'au disque).
 * - Plage introuvable (historique réécrit) : le fichier contre `HEAD`, et dit (revue QA).
 */
export function ReviewFileDiff({
  conversationId,
  path,
  since,
  until,
  refresh,
  focus
}: {
  conversationId: string
  path: string
  since: string
  until?: string | undefined
  /** Change à chaque relecture de l'état du dépôt (vue Git) : le diff est relu. */
  refresh?: unknown
  focus: DiffFocus | undefined
}) {
  const { t } = useTranslation()
  const [diff, setDiff] = useState<GitFileDiff | { error: string } | null>(null)
  // « Voir la version actuelle » : le diff jusqu'au disque au lieu de la version relue.
  const [current, setCurrent] = useState(false)
  const end = current ? undefined : until
  useEffect(() => {
    let alive = true
    window.api.changes
      .gitFile(conversationId, path, undefined, since, end)
      .then((value) => alive && setDiff(value))
      .catch((error: unknown) => alive && setDiff({ error: ipcErrorText(error) }))
    return () => {
      alive = false
    }
  }, [conversationId, path, since, end, refresh])
  const unchanged =
    !!diff && !('error' in diff) && !diff.binary && !diff.tooLarge && diff.oldText === diff.newText
  const missing = !!diff && 'rangeMissing' in diff && !!diff.rangeMissing
  return (
    <section
      className="review-file-diff"
      data-testid="review-file-diff"
      data-reviewed={until ? '' : undefined}
    >
      <div className="review-file-diff-head">
        <ScanSearch size={13} aria-hidden />
        <span>
          {until && !current && !missing
            ? t('review.fileDiffReviewed', { path, range: reviewRange(since, until, false) })
            : t('review.fileDiff', { path, since: missing ? 'HEAD' : since.slice(0, 7) })}
        </span>
      </div>
      {missing && (
        <p className="review-file-diff-note" data-testid="review-file-missing">
          {t('review.fileRangeMissing')}
        </p>
      )}
      {until && !missing && (current || (diff && 'changedSince' in diff && diff.changedSince)) && (
        <p className="review-file-diff-note" data-testid="review-file-changed">
          {current ? t('review.fileCurrent') : t('review.fileChangedSince')}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => setCurrent((c) => !c)}
            data-testid="review-file-toggle"
          >
            {current ? t('review.fileShowReviewed') : t('review.fileShowCurrent')}
          </button>
        </p>
      )}
      {!diff ? (
        <div className="changes-caption">{t('changes.loading')}</div>
      ) : 'error' in diff ? (
        <div className="browser-error">{diff.error}</div>
      ) : diff.binary ? (
        <div className="changes-caption">{t('changes.binary')}</div>
      ) : diff.tooLarge ? (
        <div className="changes-caption">{t('changes.tooLarge')}</div>
      ) : unchanged ? (
        <CitedLines text={diff.newText} focus={focus} />
      ) : (
        <DiffView
          path={path}
          oldText={diff.oldText}
          newText={diff.newText ?? ''}
          bare
          focus={focus}
        />
      )}
    </section>
  )
}

/** Lignes de contexte autour des lignes citées, quand le fichier n'a pas changé. */
const CONTEXT = 2

/**
 * Fichier hors de la portée relue (revue UX de la fiche 267) : les lignes citées, telles qu'elles
 * sont, avec un peu de contexte et mises en avant, sans marques d'ajout ni de retrait.
 */
function CitedLines({ text, focus }: { text: string | null; focus: DiffFocus | undefined }) {
  const { t } = useTranslation()
  // Le retour à la ligne final n'est pas une ligne de plus.
  const all = (text ?? '').replace(/\n$/, '').split('\n')
  const from = Math.max(1, (focus?.from ?? 1) - CONTEXT)
  const to = Math.min(all.length, (focus?.to ?? focus?.from ?? 1) + CONTEXT)
  return (
    <div data-testid="review-file-unchanged">
      <p className="review-file-diff-note">{t('review.fileUnchanged')}</p>
      {focus && text !== null && (
        <table className="diff-table review-cited" data-testid="review-cited">
          <tbody>
            {all.slice(from - 1, to).map((line, i) => {
              const number = from + i
              const cited = number >= focus.from && number <= focus.to
              return (
                <tr key={number} className={cited ? 'diff-focus' : undefined} data-line={number}>
                  <td className="diff-no">{number}</td>
                  <td className="diff-code">{line}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
