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
      {/* Branche et actions ensemble, calées à droite ; trop étroit, elles passent à la ligne
          plutôt que de déborder du panneau (fiche 267 : « Actualiser » était hors du bord). */}
      <div className="changes-bar-actions">
        {view === 'git' && git?.branch && (
          <span className="changes-branch" title={git.root}>
            {git.branch}
          </span>
        )}
        {onReview && git && view !== 'children' && (
          // Libellé « Faire relire » quand la barre est assez large (fiche 265, revue UX) ; sinon
          // l'icône seule (fiche 177) : l'infobulle et le nom accessible disent « Faire relire… ».
          <Tip label={t('review.actionTip')}>
            <button
              className="btn ghost small changes-review"
              aria-label={t('review.action')}
              onClick={onReview}
              data-testid="changes-review"
            >
              <ScanSearch size={14} aria-hidden />
              <span className="changes-review-label" aria-hidden>
                {t('workCard.review')}
              </span>
            </button>
          </Tip>
        )}
        <Tip label={t('changes.refresh')}>
          <button
            className="icon-button small"
            aria-label={t('changes.refresh')}
            onClick={onRefresh}
          >
            <RefreshCw size={13} />
          </button>
        </Tip>
      </div>
    </div>
  )
}

/** Remarques en attente sur les diffs (fiche 085) : les effacer, ou les envoyer à l'agent. */
export function DiffNotesBar({
  count,
  onClear,
  onSend,
  fix = false
}: {
  count: number
  onClear: () => void
  onSend: () => void
  /** Toutes des remarques du Code reviewer : le même mot que sa carte (fiche 265, revue UX). */
  fix?: boolean
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
        {t(fix ? 'diffNotes.sendFix' : 'diffNotes.send')}
      </button>
    </div>
  )
}
