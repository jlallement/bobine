import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Éléments rendus à l'ouverture d'une conversation, en partant de la fin du fil. */
export const INITIAL_ENTRIES = 120
/** Éléments ajoutés au-dessus quand on approche du haut de ce qui est rendu. */
export const PAGE_ENTRIES = 120
/** Distance au haut de ce qui est rendu à partir de laquelle on rend la suite (px). */
const AHEAD_PX = 2000

/**
 * Ouverture d'un long fil par la fin (fiche 193). Rendre les 5 000 éléments d'un long fil coûtait
 * plus de 2 s de script à l'ouverture (Markdown de chaque réponse, cartes), pour un fil qu'on lit
 * par le bas. Seuls les `INITIAL_ENTRIES` derniers éléments sont rendus d'abord ; un repère
 * invisible en haut fait rendre les précédents, page par page, quand le défilement en approche
 * (Chromium garde en place ce qu'on lit quand du contenu s'ajoute au-dessus). Rien n'est retiré
 * ensuite : remonter ne fait que rendre davantage.
 *
 * Tout le fil est rendu quand on le demande : recherche dans le fil ouverte (`complete`), ou un
 * élément à montrer (`reveal`, sommaire). Le fil, lui, est entier en mémoire : export, copie,
 * modifications et totaux ne dépendent pas de ce qui est rendu.
 *
 * `firstIdOf` : identifiant du premier élément du fil d'une entrée (croissant dans l'ordre).
 */
export function useEntryWindow<E>(
  entries: readonly E[],
  firstIdOf: (entry: E) => number,
  options: { complete: boolean; reveal?: number | undefined }
) {
  const idAt = (index: number) => {
    const entry = entries[Math.max(0, index)]
    return entry === undefined ? 0 : firstIdOf(entry)
  }
  const tail = () => idAt(entries.length - INITIAL_ENTRIES)
  /** Premier élément rendu, et tous ceux d'après ; `null` tant que le fil est vide (pas arrivé). */
  const [fromId, setFromId] = useState<number | null>(() => (entries.length ? tail() : null))
  if (fromId === null && entries.length) setFromId(tail())
  const found = entries.findIndex((entry) => firstIdOf(entry) >= (fromId ?? 0))
  const start = found === -1 ? Math.max(0, entries.length - INITIAL_ENTRIES) : found

  // Ajustements pendant le rendu : tout le fil pour la recherche, ou jusqu'à l'élément à montrer.
  if (options.complete && start > 0) setFromId(idAt(0))
  if (options.reveal !== undefined && start > 0 && options.reveal < idAt(start)) {
    const containing = entries.findLastIndex((entry) => firstIdOf(entry) <= (options.reveal ?? 0))
    setFromId(idAt(containing))
  }

  const sentinel = useRef<HTMLDivElement>(null)
  /** Défilement juste avant d'ajouter une page au-dessus : de quoi garder ce qu'on lit en place. */
  const before = useRef<{ scroller: HTMLElement; top: number; height: number } | null>(null)
  /** Premier élément de la page d'avant, rendue quand le repère du haut approche. */
  const nextId = start > 0 ? idAt(start - PAGE_ENTRIES) : undefined
  useEffect(() => {
    const el = sentinel.current
    const scroller = el?.closest<HTMLElement>('.scroll')
    if (!el || !scroller || nextId === undefined || typeof IntersectionObserver === 'undefined') {
      return
    }
    // Un observateur neuf à chaque page : son premier rappel dit si le repère est encore proche,
    // et la page suivante se rend dans une autre tâche (pas de longue tâche d'un seul tenant).
    const observer = new IntersectionObserver(
      (records) => {
        if (!records.some((r) => r.isIntersecting)) return
        before.current = { scroller, top: scroller.scrollTop, height: scroller.scrollHeight }
        setFromId(nextId)
      },
      { root: scroller, rootMargin: `${AHEAD_PX}px 0px 0px 0px` }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [start, nextId])
  // Page ajoutée au-dessus : Chromium garde ce qu'on lit en place (ancrage du défilement), sauf
  // tout en haut (`scrollTop` à 0, touche Origine) où il n'ancre rien. Là, on décale nous-mêmes.
  useLayoutEffect(() => {
    const was = before.current
    if (!was) return
    before.current = null
    const grown = was.scroller.scrollHeight - was.height
    if (grown > 0 && was.scroller.scrollTop === was.top) was.scroller.scrollTop = was.top + grown
  }, [start])

  return { start, sentinel }
}
