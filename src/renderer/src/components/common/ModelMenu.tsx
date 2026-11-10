/**
 * Puce du modèle et sa liste (fiches 090, 092). OpenCode propose une quarantaine de modèles : la
 * liste s'ouvre sur le modèle en cours, bornée à la place disponible, avec un champ de recherche
 * au-delà de 10. Une liste à la manière d'une combobox (et non un menu Radix, dont la recherche
 * par première lettre prendrait le focus du champ).
 */
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import type { ControlValue, SessionControl } from '@shared/agent'
import { modelProvider, shortModelName } from '@shared/models'
import { Tip, useReturnFocus, valueLabel } from './Menus'

export { modelProvider, shortModelName }

/** Au-delà, la liste a un champ de recherche. */
export const MODEL_SEARCH_THRESHOLD = 10

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Options dans l'ordre affiché (groupes dans leur ordre d'apparition), filtrées sans casse ni
 * accents sur le nom, le groupe et l'identifiant (`gpt-6.1-sol`, recette 0.9 D11).
 */
export function modelOptions(control: SessionControl, query: string): SessionControl['options'] {
  const groups = [...new Set(control.options.map((o) => o.group))]
  const ordered = groups.flatMap((group) => control.options.filter((o) => o.group === group))
  const wanted = fold(query.trim())
  if (!wanted) return ordered
  return ordered.filter((o) => fold(`${o.name} ${o.group ?? ''} ${o.value}`).includes(wanted))
}

/**
 * Puce du modèle (réglage de catégorie `model`), à droite avant le choix de l'agent, comme dans
 * Claude Desktop : nom court, nom complet dans l'infobulle.
 */
export function ModelChip({
  control,
  disabled,
  onSetControl,
  className,
  icon
}: {
  control: SessionControl
  disabled: boolean
  onSetControl: (id: string, value: ControlValue) => void
  /** Classe ajoutée à la puce (style discret de l'onglet « Session », fiche 166). */
  className?: string
  /** Icône avant le nom (onglet « Session ») ; la zone de saisie n'en a pas. */
  icon?: ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const returnFocus = useReturnFocus()
  const name = valueLabel(control)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tip label={t('sessionSettings.modelTip', { name: control.name, value: name })}>
        <Popover.Trigger
          className={`chip model-chip${className ? ` ${className}` : ''}`}
          disabled={disabled}
          data-testid="model-chip"
        >
          {icon}
          <span className="chip-label">{shortModelName(name)}</span>
          <ChevronDown size={14} />
        </Popover.Trigger>
      </Tip>
      <ModelPopover
        control={control}
        align="end"
        returnFocus={returnFocus}
        onPick={(value) => {
          setOpen(false)
          if (value !== control.currentValue) onSetControl(control.id, value)
        }}
      />
    </Popover.Root>
  )
}

/**
 * Bouton qui ouvre la même liste (carte d'un modèle refusé faute de connexion, fiche 210) ; seul un
 * autre modèle que celui en cours est rendu à `onPick`.
 */
export function ModelPickButton({
  control,
  className,
  testId,
  onPick,
  children
}: {
  control: SessionControl
  className: string
  testId: string
  onPick: (value: string) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const returnFocus = useReturnFocus()
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={className} data-testid={testId}>
        {children}
      </Popover.Trigger>
      <ModelPopover
        control={control}
        align="start"
        returnFocus={returnFocus}
        onPick={(value) => {
          setOpen(false)
          if (value !== control.currentValue) onPick(value)
        }}
      />
    </Popover.Root>
  )
}

function ModelPopover({
  control,
  align,
  returnFocus,
  onPick
}: {
  control: SessionControl
  align: 'start' | 'end'
  returnFocus: ReturnType<typeof useReturnFocus>
  onPick: (value: string) => void
}) {
  return (
    <Popover.Portal>
      <Popover.Content
        className="menu model-menu"
        side="top"
        align={align}
        sideOffset={8}
        collisionPadding={12}
        data-testid="model-menu-content"
        data-searchable={control.options.length > MODEL_SEARCH_THRESHOLD ? '' : undefined}
        {...returnFocus}
        // Le focus va au champ de recherche (ou à la liste) : `ModelList` s'en charge.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ModelList control={control} onPick={onPick} />
      </Popover.Content>
    </Popover.Portal>
  )
}

/** Liste des modèles : recherche, ↑ ↓ Entrée, ouverte sur le modèle en cours. */
function ModelList({
  control,
  onPick
}: {
  control: SessionControl
  onPick: (value: string) => void
}) {
  const { t } = useTranslation()
  const searchable = control.options.length > MODEL_SEARCH_THRESHOLD
  const [query, setQuery] = useState('')
  const visible = useMemo(() => modelOptions(control, query), [control, query])
  const current = String(control.currentValue)
  /** Place du modèle en cours dans une liste (la première option s'il n'y est pas). */
  const currentIn = (options: SessionControl['options']) =>
    Math.max(
      0,
      options.findIndex((o) => o.value === current)
    )
  const [active, setActive] = useState(() => currentIn(visible))
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  /** Ouverture : focus, et l'option en cours au milieu de la liste ; ensuite, gardée visible. */
  const opened = useRef(false)

  useLayoutEffect(() => {
    const box = list.current
    const row = box?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    if (!box) return
    if (!opened.current) {
      opened.current = true
      ;(input.current ?? box).focus({ preventScroll: true })
      if (row) box.scrollTop = row.offsetTop - (box.clientHeight - row.offsetHeight) / 2
      return
    }
    if (!row) return
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight
    }
  }, [active])

  const search = (value: string) => {
    setQuery(value)
    // Sans recherche, retour sur le modèle en cours ; sinon, la première option trouvée.
    setActive(value.trim() ? 0 : currentIn(modelOptions(control, value)))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const count = visible.length
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (count) setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : count - 1)) % count)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = visible[active]
      if (option) onPick(option.value)
    }
  }

  const id = (index: number) => `model-option-${control.id}-${index}`
  const activeId = visible[active] ? id(active) : undefined
  return (
    <>
      <div className="menu-label">{control.name}</div>
      {searchable && (
        <label className="model-search">
          <Search size={14} />
          <input
            ref={input}
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('modelMenu.search')}
            role="combobox"
            aria-expanded
            aria-controls={`model-list-${control.id}`}
            aria-activedescendant={activeId}
            aria-label={t('modelMenu.search')}
            spellCheck={false}
            data-testid="model-search"
          />
        </label>
      )}
      <div
        ref={list}
        id={`model-list-${control.id}`}
        className="model-list"
        role="listbox"
        aria-label={control.name}
        tabIndex={searchable ? -1 : 0}
        onKeyDown={searchable ? undefined : onKeyDown}
        aria-activedescendant={searchable ? undefined : activeId}
      >
        {visible.length === 0 && (
          <div className="menu-item model-none" data-testid="model-none">
            {t('modelMenu.none')}
          </div>
        )}
        {visible.map((option, index) => {
          const group = option.group !== visible[index - 1]?.group ? option.group : undefined
          const provider = modelProvider(option.name)
          const selected = option.value === current
          return (
            <Fragment key={option.value}>
              {group && (
                <div className="menu-label" aria-hidden>
                  {group}
                </div>
              )}
              <div
                id={id(index)}
                role="option"
                aria-selected={selected}
                className={`menu-item model-option${option.authRequired ? ' model-auth-required' : ''}`}
                data-index={index}
                data-highlighted={index === active ? '' : undefined}
                onMouseMove={() => index !== active && setActive(index)}
                onClick={() => onPick(option.value)}
                title={
                  option.authRequired
                    ? `${option.name} — ${t('modelMenu.authRequiredTip')}`
                    : option.name
                }
                data-testid={`control-${control.id}-${option.value}`}
              >
                <span className="menu-text">
                  <div className="menu-title">{shortModelName(option.name)}</div>
                  {option.description && <div className="menu-desc">{option.description}</div>}
                </span>
                {/* Refusé faute de connexion (fiche 210) : toujours choisissable. */}
                {option.authRequired && (
                  <span className="model-auth-tag" data-testid="model-auth-required">
                    {t('modelMenu.authRequired')}
                  </span>
                )}
                {provider && <span className="model-provider">{provider}</span>}
                {selected && <Check size={16} className="menu-check" />}
              </div>
            </Fragment>
          )
        })}
      </div>
    </>
  )
}
