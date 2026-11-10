import { ScanSearch, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { DiffNote } from '@shared/diff-notes'
import { findingNote, reviewFindings } from '@shared/review'
import type { TranscriptItem } from '@shared/transcript'
import { takeNewReviewNotes } from '../../diff-notes-store'
import { Tip } from '../common/Menus'

/**
 * Remarques des relectures du fil (fiche 177) reprises une seule fois en remarques de diff
 * (`addAll`) : ensuite modifiables, supprimables et envoyées comme les autres. `enabled` : l'onglet
 * sait envoyer des remarques.
 */
export function useReviewImport(
  items: readonly TranscriptItem[],
  addAll: (notes: DiffNote[]) => void,
  enabled: boolean
): void {
  const findings = useMemo(() => reviewFindings(items), [items])
  useEffect(() => {
    if (enabled) addAll(takeNewReviewNotes(findings.map(findingNote)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `addAll` change à chaque rendu : seules de nouvelles remarques comptent
  }, [findings, enabled])
}

/**
 * Remarques de relecture en attente (fiche 177), au-dessus des fichiers de l'onglet Modifications :
 * toutes, même celles dont le fichier n'est pas dans la vue (modifications déjà commitées d'une
 * branche). Un clic montre la remarque sur son diff (vue Git) ; ✕ la retire. Elles partent avec
 * « Envoyer à l'agent », comme les autres remarques.
 */
export function ReviewNotes({
  notes,
  onShow,
  onRemove
}: {
  notes: DiffNote[]
  onShow: (note: DiffNote) => void
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()
  if (notes.length === 0) return null
  return (
    <div className="review-notes" data-testid="review-notes">
      <div className="review-notes-title">
        <ScanSearch size={13} aria-hidden /> {t('review.notes.title')}
      </div>
      <ul>
        {notes.map((note) => {
          const where =
            note.from === note.to
              ? t('review.notes.line', { file: note.path, line: note.from })
              : t('review.notes.lines', { file: note.path, from: note.from, to: note.to })
          const severity = note.review?.severity ?? 'low'
          return (
            <li key={note.id} className="review-note" data-testid="review-note" data-id={note.id}>
              <button className="review-note-main" onClick={() => onShow(note)}>
                <span className={`review-severity ${severity}`} data-testid="review-note-severity">
                  {t(`review.severity.${severity}`)}
                </span>
                <span className="review-note-text">
                  <span className="review-note-title">{note.comment.split('\n')[0]}</span>
                  <span className="review-note-where">{where}</span>
                </span>
              </button>
              <Tip label={t('review.notes.remove')}>
                <button
                  className="icon-button small"
                  aria-label={t('review.notes.remove')}
                  onClick={() => onRemove(note.id)}
                  data-testid="review-note-remove"
                >
                  <X size={13} />
                </button>
              </Tip>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
