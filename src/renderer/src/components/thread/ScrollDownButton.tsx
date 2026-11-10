import { ArrowDown } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TranscriptItem } from '@shared/transcript'
import { agentReplies } from '../../agent-count'
import { useNewSinceScroll } from '../../useNewSinceScroll'
import { Tip } from '../common/Menus'

/**
 * « Aller en bas », quand le fil n'y est pas ; avec le nombre de blocs arrivés depuis qu'on l'a
 * remonté (fiche 185, P8).
 */
export function ScrollDownButton({
  atBottom,
  items,
  conversation,
  onClick
}: {
  atBottom: boolean
  /** Fil : les réponses de l'agent qui arrivent pendant qu'on relit plus haut sont comptées. */
  items: readonly TranscriptItem[]
  conversation: string | null
  onClick: () => void
}) {
  const { t } = useTranslation()
  // Compté seulement fil remonté, et par morceaux : seul ce qui s'est ajouté est parcouru.
  const count = useMemo(
    () => (atBottom ? 0 : agentReplies(conversation, items)),
    [atBottom, conversation, items]
  )
  const unseen = useNewSinceScroll(atBottom, count, conversation)
  if (atBottom) return null
  const name =
    unseen > 99
      ? t('app.scrollDownMany')
      : unseen > 0
        ? t('app.scrollDownNew', { count: unseen })
        : t('app.scrollDown')
  return (
    <>
      {/* Annoncé aux lecteurs d'écran à chaque nouveau compte (fiche 185, P8). */}
      <span className="sr-only" aria-live="polite">
        {unseen > 0 ? name : ''}
      </span>
      <Tip label={t('app.scrollDown')}>
        <button
          className={`scroll-to-bottom${unseen > 0 ? ' with-count' : ''}`}
          aria-label={name}
          onClick={onClick}
          data-testid="scroll-to-bottom"
        >
          <ArrowDown size={16} />
          {unseen > 0 && name}
        </button>
      </Tip>
    </>
  )
}
