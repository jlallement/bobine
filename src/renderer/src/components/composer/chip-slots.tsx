import { useLayoutEffect, useMemo, type RefObject } from 'react'

/**
 * Place des puces de mode et de modèle (fiche 185, F11 / idée P6). Elles n'arrivent qu'une fois
 * l'agent prêt : sans rien, la barre se décale d'un coup. Leur largeur, retenue par profil d'agent,
 * réserve la place d'une pastille neutre en attendant ; la puce la remplace en fondu
 * (`motion.css`). Profil inconnu, ou jamais mesuré : rien n'est réservé (jamais la largeur d'un
 * autre agent, qui décalerait la barre à son tour).
 */
type Slot = 'mode' | 'model'
type Widths = Partial<Record<Slot, number>>

const KEY = 'bobine.composerChipWidths'
const SELECTORS: Record<Slot, string> = { mode: '.mode-chip', model: '.model-chip' }

function readAll(): Record<string, Widths> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Widths>
  } catch {
    return {}
  }
}

/** Largeurs à réserver pour ce profil, seulement tant que l'agent démarre. */
export function useReservedWidths(profileId: string | undefined, starting: boolean): Widths {
  return useMemo(
    () => (starting && profileId ? (readAll()[profileId] ?? {}) : {}),
    [starting, profileId]
  )
}

/**
 * Retient la largeur des puces affichées pour ce profil. Mesurée quand elles changent (prêt,
 * valeur choisie), pas à chaque frappe ; écrite seulement si elle a changé.
 */
export function useRememberChipWidths(
  bar: RefObject<HTMLElement | null>,
  profileId: string | undefined,
  ready: boolean,
  chipsKey: string
): void {
  useLayoutEffect(() => {
    const element = bar.current
    if (!element || !ready || !profileId) return
    const widths: Widths = {}
    for (const slot of ['mode', 'model'] as const) {
      const width = element.querySelector<HTMLElement>(SELECTORS[slot])?.offsetWidth
      if (width) widths[slot] = width
    }
    const all = readAll()
    if (JSON.stringify(all[profileId] ?? {}) === JSON.stringify(widths)) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...all, [profileId]: widths }))
    } catch {
      // Stockage indisponible : la barre se décalera, comme avant.
    }
  }, [bar, profileId, ready, chipsKey])
}

/** Pastille neutre à la place d'une puce qui va arriver. */
export function ChipPlaceholder({ width }: { width: number | undefined }) {
  if (!width) return null
  return <span className="chip-placeholder" style={{ width }} aria-hidden="true" />
}
