/**
 * Menu des participants (fiche 285, maquette `participants`) : un menu à cases, dans le même geste
 * que le menu des modèles (`ModelMenu`) — une liste à la manière d'une combobox, ouverte au-dessus
 * de la saisie. Les modèles récents d'abord, puis « Autres modèles… » et sa recherche. De 2 à 5
 * participants : au-delà, les cases se désactivent et disent pourquoi. Chaque case est retenue
 * aussitôt (préférence de l'app) : pas de bouton « Enregistrer ».
 *
 * Clavier : ↑ ↓ (et Début, Fin) parcourent les cases, Espace ou Entrée cochent, Échap ferme (Radix)
 * et rend le focus à la saisie. Lecteur d'écran : une liste à choix multiples (`listbox`,
 * `aria-multiselectable`), chaque case une `option` cochée ou non (`aria-selected`).
 */
import { Check, Search } from 'lucide-react'
import {
  Fragment,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import type { RoundtableOptions } from '@shared/roundtable-ipc'
import { ROUNDTABLE_MAX_SEATS, type RoundtableChoice } from '@shared/roundtable'
import { menuEntries, searchEntries, type MenuEntry } from './roundtable-view'

export function RoundtableParticipants({
  options,
  choices,
  onToggle
}: {
  options: RoundtableOptions | undefined
  choices: readonly RoundtableChoice[]
  onToggle: (entry: MenuEntry) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  // L'ordre des cases est figé à l'ouverture : rien ne glisse sous le pointeur pendant qu'on coche
  // (A2) ; « récents d'abord » ne joue qu'à la réouverture. Cochées et désactivées suivent, elles.
  const [atOpen] = useState(() => choices)
  const { main, others } = useMemo(() => {
    const layout = menuEntries(options, atOpen)
    const now = new Map(
      Object.values(menuEntries(options, choices))
        .flat()
        .map((e) => [e.key, e])
    )
    // Absente de l'état courant (retenu disparu décoché) : décochée, bornée comme les autres.
    const live = (e: MenuEntry): MenuEntry => {
      const current = now.get(e.key)
      if (current) return current
      const { disabled: _d, reason: _r, ...rest } = e
      return choices.length >= ROUNDTABLE_MAX_SEATS
        ? { ...rest, checked: false, disabled: 'full', reason: t('roundtable.menu.full') }
        : { ...rest, checked: false }
    }
    return { main: layout.main.map(live), others: layout.others.map(live) }
  }, [options, atOpen, choices, t])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  // La recherche filtre toute la liste (A2), au lieu d'ajouter des résultats en bas.
  const visible = useMemo(
    () =>
      !searching
        ? main
        : query.trim()
          ? searchEntries([...main, ...others], query)
          : [...main, ...others],
    [searching, query, main, others]
  )
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const opened = useRef(false)
  const byPointer = useRef(false)

  // Ouverture : le focus sur la liste ; ensuite, la case active gardée visible.
  useLayoutEffect(() => {
    const box = list.current
    if (!box) return
    if (!opened.current) {
      opened.current = true
      box.focus({ preventScroll: true })
      return
    }
    // Case choisie à la souris : la liste ne défile pas sous le pointeur (A2) ; au clavier, si.
    if (byPointer.current) {
      byPointer.current = false
      return
    }
    box.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (entry: MenuEntry | undefined) => {
    if (!entry || entry.disabled) return
    onToggle(entry)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const count = visible.length
    // Seulement depuis la liste ou la recherche : Entrée et Espace sur « Autres modèles… »
    // ouvrent la recherche (bouton), ils ne cochent rien.
    if (!count || (event.target !== list.current && event.target !== input.current)) return
    const moves: Record<string, (i: number) => number> = {
      ArrowDown: (i) => (i + 1) % count,
      ArrowUp: (i) => (i + count - 1) % count,
      Home: () => 0,
      End: () => count - 1
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setActive(move)
      return
    }
    // Espace coche dans la liste ; dans la recherche, il s'écrit.
    if (event.key === 'Enter' || (event.key === ' ' && event.target !== input.current)) {
      event.preventDefault()
      pick(visible[active])
    }
  }

  const openSearch = () => {
    setSearching(true)
    setActive(main.length)
    // Le champ apparaît au rendu suivant.
    requestAnimationFrame(() => input.current?.focus())
  }

  const optionId = (index: number) => `${id}-option-${index}`
  return (
    <div className="roundtable-menu" data-testid="roundtable-menu" onKeyDown={onKeyDown}>
      <div className="menu-label" id={`${id}-title`}>
        {t('roundtable.menu.title')}
      </div>
      <div
        ref={list}
        id={`${id}-list`}
        className="roundtable-menu-list"
        role="listbox"
        aria-multiselectable
        aria-labelledby={`${id}-title`}
        aria-activedescendant={visible[active] ? optionId(active) : undefined}
        tabIndex={0}
        data-testid="roundtable-menu-list"
      >
        {visible.map((entry, index) => (
          <Fragment key={entry.key}>
            <div
              id={optionId(index)}
              role="option"
              aria-selected={entry.checked}
              aria-disabled={entry.disabled ? true : undefined}
              aria-description={entry.reason}
              // Premier des autres modèles : un filet au-dessus (aucun séparateur dans la liste).
              className={`menu-item roundtable-option${searching && !query.trim() && index === main.length ? ' roundtable-first-other' : ''}`}
              data-index={index}
              data-highlighted={index === active ? '' : undefined}
              data-disabled={entry.disabled ? '' : undefined}
              title={entry.reason}
              onMouseMove={() => {
                if (index === active) return
                byPointer.current = true
                setActive(index)
              }}
              onClick={() => {
                if (index !== active) byPointer.current = true
                setActive(index)
                pick(entry)
              }}
              data-testid="roundtable-option"
              data-checked={entry.checked}
            >
              <span className="roundtable-box" aria-hidden data-checked={entry.checked}>
                {entry.checked && <Check size={12} strokeWidth={3} />}
              </span>
              <span className="menu-text roundtable-option-name">{entry.label}</span>
              {/* Un agent sans choix de modèle tient sur une ligne : son nom n'est pas répété. */}
              {entry.label !== entry.agentLabel && (
                <span className="roundtable-option-agent">{entry.agentLabel}</span>
              )}
            </div>
          </Fragment>
        ))}
      </div>
      {searching && visible.length === 0 && (
        <div className="menu-item model-none" role="status" data-testid="roundtable-none">
          {t('modelMenu.none')}
        </div>
      )}
      {others.length > 0 &&
        (searching ? (
          <label className="model-search roundtable-search">
            <Search size={14} aria-hidden />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder={t('roundtable.menu.search')}
              aria-label={t('roundtable.menu.search')}
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-activedescendant={visible[active] ? optionId(active) : undefined}
              spellCheck={false}
              data-testid="roundtable-search"
            />
          </label>
        ) : (
          <button
            type="button"
            className="menu-item roundtable-others"
            onClick={openSearch}
            data-testid="roundtable-others"
          >
            <Search size={14} aria-hidden />
            {t('roundtable.menu.others')}
          </button>
        ))}
      <div className="roundtable-menu-foot">{t('roundtable.menu.footer')}</div>
    </div>
  )
}
