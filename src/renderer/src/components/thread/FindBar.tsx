import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'

/**
 * Barre de recherche dans la conversation (fiche 086), en haut à droite du fil : Entrée suivant,
 * ⇧Entrée précédent, Échap ferme. `focus` change à chaque ⌘F : champ repris, texte sélectionné.
 */
export function FindBar({
  query,
  count,
  pending,
  current,
  focus,
  onQuery,
  onNext,
  onPrevious,
  onClose
}: {
  query: string
  count: number
  /** Résultats pas encore calculés pour la recherche tapée. */
  pending: boolean
  current: number
  focus: number
  onQuery: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [focus])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) onPrevious()
      else onNext()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="find-bar" role="search" data-testid="find-bar">
      <Search size={14} className="muted-icon" />
      <input
        ref={input}
        value={query}
        placeholder={t('find.placeholder')}
        aria-label={t('find.placeholder')}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        data-testid="find-input"
      />
      <span className="find-count" aria-live="polite" data-testid="find-count">
        {query.trim() && !pending
          ? count === 0
            ? t('find.none')
            : t('find.count', { current: current + 1, total: count })
          : ''}
      </span>
      <Tip label={t('find.previous')}>
        <button
          className="icon-button small"
          aria-label={t('find.previous')}
          disabled={count === 0}
          onClick={onPrevious}
          data-testid="find-previous"
        >
          <ChevronUp size={15} />
        </button>
      </Tip>
      <Tip label={t('find.next')}>
        <button
          className="icon-button small"
          aria-label={t('find.next')}
          disabled={count === 0}
          onClick={onNext}
          data-testid="find-next"
        >
          <ChevronDown size={15} />
        </button>
      </Tip>
      <Tip label={t('find.close')}>
        <button
          className="icon-button small"
          aria-label={t('find.close')}
          onClick={onClose}
          data-testid="find-close"
        >
          <X size={15} />
        </button>
      </Tip>
    </div>
  )
}
