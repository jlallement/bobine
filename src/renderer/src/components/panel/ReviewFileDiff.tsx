import { ScanSearch } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitFileDiff } from '@shared/changes'
import { ipcErrorText } from '../../ipc-errors'
import { DiffView, type DiffFocus } from '../thread/DiffView'

/**
 * Le fichier d'une remarque du Code reviewer qui relit une branche ou un commit (fiche 265, revue
 * QA) : son diff depuis le point relu (`since` : la base de la branche, le parent du commit), et
 * pas seulement contre `HEAD` — une remarque sur une ligne déjà commitée s'y voit, mise en avant.
 */
export function ReviewFileDiff({
  conversationId,
  path,
  since,
  focus
}: {
  conversationId: string
  path: string
  since: string
  focus: DiffFocus | undefined
}) {
  const { t } = useTranslation()
  const [diff, setDiff] = useState<GitFileDiff | { error: string } | null>(null)
  useEffect(() => {
    let alive = true
    window.api.changes
      .gitFile(conversationId, path, undefined, since)
      .then((value) => alive && setDiff(value))
      .catch((error: unknown) => alive && setDiff({ error: ipcErrorText(error) }))
    return () => {
      alive = false
    }
  }, [conversationId, path, since])
  return (
    <section className="review-file-diff" data-testid="review-file-diff">
      <div className="review-file-diff-head">
        <ScanSearch size={13} aria-hidden />
        <span>{t('review.fileDiff', { path, since: since.slice(0, 7) })}</span>
      </div>
      {!diff ? (
        <div className="changes-caption">{t('changes.loading')}</div>
      ) : 'error' in diff ? (
        <div className="browser-error">{diff.error}</div>
      ) : diff.binary ? (
        <div className="changes-caption">{t('changes.binary')}</div>
      ) : diff.tooLarge ? (
        <div className="changes-caption">{t('changes.tooLarge')}</div>
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
