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
 * - Fichier inchangé dans la portée : dit, plutôt qu'un « Aucune modification » sans explication.
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
  useEffect(() => {
    let alive = true
    window.api.changes
      .gitFile(conversationId, path, undefined, since, until)
      .then((value) => alive && setDiff(value))
      .catch((error: unknown) => alive && setDiff({ error: ipcErrorText(error) }))
    return () => {
      alive = false
    }
  }, [conversationId, path, since, until, refresh])
  const unchanged =
    !!diff && !('error' in diff) && !diff.binary && !diff.tooLarge && diff.oldText === diff.newText
  return (
    <section
      className="review-file-diff"
      data-testid="review-file-diff"
      data-reviewed={until ? '' : undefined}
    >
      <div className="review-file-diff-head">
        <ScanSearch size={13} aria-hidden />
        <span>
          {until
            ? t('review.fileDiffReviewed', { path, range: reviewRange(since, until, false) })
            : t('review.fileDiff', { path, since: since.slice(0, 7) })}
        </span>
      </div>
      {diff && 'changedSince' in diff && diff.changedSince && (
        <p className="review-file-diff-note" data-testid="review-file-changed">
          {t('review.fileChangedSince')}
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
        <p className="review-file-diff-note" data-testid="review-file-unchanged">
          {t('review.fileUnchanged')}
        </p>
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
