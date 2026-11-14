import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Rôle d'une fille dans l'en-tête (fiche 223) quand la fenêtre est étroite : le titre de la
 * conversation se raccourcit d'abord (jusqu'à sa largeur minimale), puis la pastille « lecture
 * seule » se réduit à son icône (infobulle) ; jamais une pastille coupée au milieu d'une lettre.
 */

/** Écart avant de rendre la pastille entière : pas d'aller-retour au pixel près. */
const HYSTERESIS_PX = 4

export interface BadgeMeasure {
  /** Largeur qu'il faudrait au rôle entier : avatar, nom en entier, pastille entière, espaces. */
  natural: number
  /** Largeur que le rôle pourrait prendre : la sienne, l'espace libre, ce que le titre peut céder. */
  available: number
}

/** Pastille réduite à son icône ? Rendue entière seulement avec une marge (`HYSTERESIS_PX`). */
export function badgeCompact(compact: boolean, { natural, available }: BadgeMeasure): boolean {
  return compact ? available < natural + HYSTERESIS_PX : available < natural
}

const px = (value: string) => Number.parseFloat(value) || 0

/**
 * Mesure dans l'en-tête (`.main-header`) : son espace libre (`.grow`), la marge du titre
 * (`.main-title`) au-dessus de sa largeur minimale, moins ce qui déborde déjà. `fullPill` : largeur
 * de la pastille entière, retenue quand elle était affichée.
 */
function measure(badge: HTMLElement, fullPill: number): BadgeMeasure | undefined {
  const header = badge.closest('.main-header')
  const label = badge.querySelector<HTMLElement>('.role-title-label')
  const avatar = badge.firstElementChild as HTMLElement | null
  if (!header || !label || !avatar) return undefined
  const grow = header.querySelector<HTMLElement>(':scope > .grow')
  const title = header.querySelector<HTMLElement>(':scope > .main-title')
  const gap = px(getComputedStyle(badge).columnGap)
  const titleRoom = title
    ? Math.max(0, title.getBoundingClientRect().width - px(getComputedStyle(title).minWidth))
    : 0
  const parts = [avatar.offsetWidth, label.scrollWidth, fullPill].filter((w) => w > 0)
  const overflow = Math.max(0, header.scrollWidth - header.clientWidth)
  return {
    natural: parts.reduce((a, b) => a + b, 0) + gap * (parts.length - 1),
    available: badge.getBoundingClientRect().width + (grow?.offsetWidth ?? 0) + titleRoom - overflow
  }
}

/**
 * `true` quand la pastille doit se réduire à son icône. `resetKey` : texte de la pastille (langue,
 * niveau) ; à son changement, la pastille repart entière pour être remesurée.
 */
export function useCompactBadge(
  badge: RefObject<HTMLElement | null>,
  pill: RefObject<HTMLElement | null>,
  resetKey: string
): boolean {
  const [state, setState] = useState({ key: resetKey, compact: false })
  const compact = state.key === resetKey && state.compact
  const fullPill = useRef(0)
  useLayoutEffect(() => {
    const el = badge.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      if (!compact && pill.current) fullPill.current = pill.current.offsetWidth
      const m = measure(el, fullPill.current)
      if (!m) return
      const next = badgeCompact(compact, m)
      if (next !== compact) setState({ key: resetKey, compact: next })
    }
    update()
    const observer = new ResizeObserver(update)
    const header = el.closest('.main-header')
    for (const target of [
      el,
      header,
      header?.querySelector(':scope > .grow'),
      header?.querySelector(':scope > .main-title')
    ]) {
      if (target) observer.observe(target)
    }
    return () => observer.disconnect()
  }, [badge, pill, compact, resetKey])
  return compact
}
