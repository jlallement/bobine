import { MessageSquare, RefreshCw, ScanSearch, Send, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GitChanges } from '@shared/changes'
import { Tip } from '../common/Menus'

type View = 'conversation' | 'git' | 'children'

/**
 * Barre des vues de l'onglet Modifications : conversation, filles (seulement s'il y en a,
 * fiche 161), git (dépôt connu) ; branche en vue git, et « Actualiser ».
 */
export function ChangesViews({
  view,
  conversationCount,
  git,
  childCount,
  onChoose,
  onRefresh,
  onReview
}: {
  view: View
  conversationCount: number
  git?: GitChanges
  childCount: number
  onChoose: (view: View) => void
  onRefresh: () => void
  /** « Faire relire… » (fiche 177) : seulement dans un dépôt git, hors de la vue des filles. */
  onReview?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const tab = (id: View, label: string, count: number) => (
    <button
      role="tab"
      aria-selected={view === id}
      className={view === id ? 'active' : ''}
      onClick={() => onChoose(id)}
      data-testid={`changes-view-${id}`}
    >
      {label} <span className="count">{count}</span>
    </button>
  )
  return (
    <div className="changes-bar">
      <div className="segmented" role="tablist">
        {tab('conversation', t('changes.view.conversation'), conversationCount)}
        {childCount > 0 && tab('children', t('changes.view.children'), childCount)}
        {/* Git en dernier : il n'apparaît qu'une fois le dépôt lu, sans décaler les autres. */}
        {git && tab('git', t('changes.view.git'), git.files.length)}
      </div>
      <span className="grow" />
      {view === 'git' && git?.branch && (
        <span className="changes-branch" title={git.root}>
          {git.branch}
        </span>
      )}
      {onReview && git && view !== 'children' && (
        // Icône seule (fiche 177) : avec la vue « Filles », un libellé ferait passer la barre sur
        // deux lignes ; l'infobulle et le nom accessible disent « Faire relire… ».
        <Tip label={t('review.actionTip')}>
          <button
            className="icon-button small"
            aria-label={t('review.action')}
            onClick={onReview}
            data-testid="changes-review"
          >
            <ScanSearch size={14} />
          </button>
        </Tip>
      )}
      <Tip label={t('changes.refresh')}>
        <button className="icon-button small" aria-label={t('changes.refresh')} onClick={onRefresh}>
          <RefreshCw size={13} />
        </button>
      </Tip>
    </div>
  )
}

/** Remarques en attente sur les diffs (fiche 085) : les effacer, ou les envoyer à l'agent. */
export function DiffNotesBar({
  count,
  onClear,
  onSend
}: {
  count: number
  onClear: () => void
  onSend: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="diff-notes-bar" data-testid="diff-notes-bar">
      <MessageSquare size={14} />
      <span className="diff-notes-count">{t('diffNotes.count', { count })}</span>
      <span className="grow" />
      <Tip label={t('diffNotes.clear')}>
        <button
          className="icon-button small"
          aria-label={t('diffNotes.clear')}
          onClick={onClear}
          data-testid="diff-notes-clear"
        >
          <Trash2 size={13} />
        </button>
      </Tip>
      <button className="btn small primary" onClick={onSend} data-testid="diff-notes-send">
        <Send size={13} />
        {t('diffNotes.send')}
      </button>
    </div>
  )
}
