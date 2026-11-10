import { useEffect, useRef, useState, type RefObject } from 'react'

/** Délai sans clic après l'apparition de la carte ou un défilement du fil (0.11, M1). */
export const ARM_MS = 400

/** Touches qui font défiler le fil. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar'
])

/**
 * Anti-clic accidentel sur une carte d'autorisation (0.11, M1) : un clic de souris réel sur ses
 * boutons n'est pris que 400 ms après l'apparition de la carte et après le dernier défilement
 * fait par l'utilisateur (molette, toucher, touches de défilement) — la carte arrive sous le
 * pointeur pendant qu'on lit ou qu'on fait défiler. Jamais filtrés : un clic au clavier
 * (`detail === 0`, Entrée ou Espace sur un bouton choisi), un clic de script (`isTrusted` faux).
 * Un défilement programmé (le fil qui suit le bas pendant que l'agent écrit) ne désarme pas.
 * `armed` (attribut `data-armed`) : les boutons répondent ; sinon ils se montrent inactifs.
 */
export function useArmedCard(card: RefObject<HTMLElement | null>) {
  const [armed, setArmed] = useState(false)
  const armedRef = useRef(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const disarm = () => {
      armedRef.current = false
      setArmed(false)
      clearTimeout(timer)
      timer = setTimeout(() => {
        armedRef.current = true
        setArmed(true)
      }, ARM_MS)
    }
    const onKey = (event: Event) => {
      if (!SCROLL_KEYS.has((event as KeyboardEvent).key)) return
      // Espace ou flèche sur un bouton de la carte : un choix au clavier, pas un défilement.
      const target = event.target as Element | null
      if (target?.closest?.('button, input, textarea, select, [contenteditable]')) return
      disarm()
    }
    disarm()
    const scroller = card.current?.closest('.scroll')
    const events = ['wheel', 'touchmove'] as const
    for (const name of events) scroller?.addEventListener(name, disarm, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      for (const name of events) scroller?.removeEventListener(name, disarm)
      window.removeEventListener('keydown', onKey)
    }
  }, [card])
  /** Le clic compte-t-il ? */
  const accepts = (event: { isTrusted: boolean; detail: number }) =>
    !event.isTrusted || event.detail === 0 || armedRef.current
  return { armed, accepts }
}
