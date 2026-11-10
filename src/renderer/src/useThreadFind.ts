/**
 * Recherche dans la conversation ouverte (fiche 086) : texte affiché du fil mis bout à bout, plages
 * des résultats, surlignage par l'API de surlignage CSS (rien n'est ajouté au DOM, comme pour le
 * plan annoté) et défilement jusqu'au résultat courant. Seul ce qui est affiché est cherché : le
 * détail replié des outils n'est pas dans la page.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { findMatches } from './thread-find'

const ALL = 'thread-find'
const CURRENT = 'thread-find-current'
/** Le fil change (réponse en cours) : résultats recalculés au plus à ce rythme. */
const SETTLE_MS = 150

const registry = () => (typeof CSS !== 'undefined' ? CSS.highlights : undefined)

function clear(): void {
  registry()?.delete(ALL)
  registry()?.delete(CURRENT)
}

/** Nœuds de texte affichés sous `root`, avec la position de leur début dans le texte bout à bout. */
function textOf(root: HTMLElement): { text: string; nodes: Text[]; starts: number[] } {
  const visible = new Map<Element, boolean>()
  const shown = (el: Element | null): boolean => {
    if (!el) return false
    let seen = visible.get(el)
    if (seen === undefined) {
      seen = el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true
      visible.set(el, seen)
    }
    return seen
  }
  const nodes: Text[] = []
  const starts: number[] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? ''
    if (!value || !shown(node.parentElement)) continue
    nodes.push(node as Text)
    starts.push(text.length)
    text += value
  }
  return { text, nodes, starts }
}

/** Nœud et décalage d'une position du texte bout à bout (`end` : fin d'une plage). */
function at(
  { nodes, starts }: { nodes: Text[]; starts: number[] },
  position: number,
  end: boolean
): { node: Text; offset: number } | null {
  let low = 0
  let high = starts.length - 1
  // Dernier nœud qui commence avant la position (avant ou à la position pour un début).
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const start = starts[mid] ?? 0
    if (end ? start < position : start <= position) low = mid
    else high = mid - 1
  }
  const node = nodes[low]
  return node ? { node, offset: position - (starts[low] ?? 0) } : null
}

/** Le défileur défile-t-il sur cet axe (contenu plus grand, `overflow` qui défile) ? */
function scrolls(el: Element, axis: 'x' | 'y'): boolean {
  const more = axis === 'y' ? el.scrollHeight > el.clientHeight : el.scrollWidth > el.clientWidth
  if (!more) return false
  const style = getComputedStyle(el)
  const overflow = axis === 'y' ? style.overflowY : style.overflowX
  return overflow === 'auto' || overflow === 'scroll'
}

/**
 * Amène le résultat au centre de chaque défileur qui le contient, du plus proche au fil : un diff
 * ou une sortie bornés en hauteur défilent dans leur cadre (fiche 192), puis le fil. Sur la
 * largeur (ligne longue d'un diff), seulement s'il est hors du cadre.
 */
function bringIntoView(range: Range, root: HTMLElement): void {
  const start = range.startContainer
  let el: Element | null = start instanceof Element ? start : start.parentElement
  for (; el && el !== root && root.contains(el); el = el.parentElement) {
    if (scrolls(el, 'y')) center(range, el, 'y')
    if (scrolls(el, 'x')) center(range, el, 'x', true)
  }
  center(range, root, 'y')
}

function center(range: Range, el: Element, axis: 'x' | 'y', onlyIfOut = false): void {
  const box = el.getBoundingClientRect()
  const rect = range.getBoundingClientRect()
  if (axis === 'y') {
    el.scrollBy({ top: rect.top - box.top - box.height / 2 + rect.height / 2 })
    return
  }
  if (onlyIfOut && rect.left >= box.left && rect.right <= box.right) return
  el.scrollBy({ left: rect.left - box.left - box.width / 2 + Math.min(rect.width, box.width) / 2 })
}

export function useThreadFind(options: {
  /** Élément qui défile et contient le fil. */
  container: RefObject<HTMLElement | null>
  query: string
  /** Barre ouverte. */
  active: boolean
  /** Change quand le fil change (ses éléments). */
  content: unknown
  /** Change avec la conversation : on repart du premier résultat. */
  conversation: string | null
}) {
  const { container, query, active, content, conversation } = options
  const searching = active && query.trim() !== ''
  /**
   * Nombre de résultats du dernier calcul, pour quelle recherche (`key`) ; `version` change à chaque
   * calcul.
   */
  const [found, setFound] = useState({ key: '', count: 0, version: 0 })
  const [current, setCurrent] = useState(0)
  /** Demandes d'amener le résultat courant au centre (nouvelle recherche, suivant…). */
  const [reveal, setReveal] = useState(0)
  const ranges = useRef<Range[]>([])
  const revealed = useRef(0)
  /**
   * Page du fil changée pendant la recherche sans que le fil change (fiche 192) : carte dépliée,
   * contenu masqué montré par paquets parce qu'il contient ce qu'on cherche. Les résultats sont
   * recalculés une fois la page posée (le surlignage, lui, ne touche pas au DOM).
   */
  const [pageChanges, setPageChanges] = useState(0)
  useEffect(() => {
    const root = container.current
    if (!searching || !root || typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => setPageChanges((n) => n + 1))
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [searching, container])

  // Barre rouverte, autre recherche ou autre conversation : premier résultat, amené au centre
  // (ajustement pendant le rendu).
  const key = `${searching ? 1 : 0}\u0000${conversation ?? ''}\u0000${query}`
  const [seen, setSeen] = useState(key)
  if (seen !== key) {
    setSeen(key)
    setCurrent(0)
    setReveal((r) => r + 1)
  }

  useEffect(() => {
    if (!searching) {
      ranges.current = []
      clear()
      return
    }
    const timer = setTimeout(() => {
      const root = container.current
      const flat = root ? textOf(root) : null
      ranges.current = flat
        ? findMatches(flat.text, query).flatMap(([start, end]) => {
            const from = at(flat, start, false)
            const to = at(flat, end, true)
            if (!from || !to) return []
            const range = document.createRange()
            range.setStart(from.node, from.offset)
            range.setEnd(to.node, to.offset)
            return [range]
          })
        : []
      registry()?.set(ALL, new Highlight(...ranges.current))
      setFound((f) => ({ key, count: ranges.current.length, version: f.version + 1 }))
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [searching, query, content, conversation, container, key, pageChanges])

  // Recherche tapée, pas encore calculée : ni compte, ni « Aucun résultat » qui clignote.
  const pending = searching && found.key !== key
  const count = searching && !pending ? found.count : 0
  const index = Math.min(current, Math.max(0, count - 1))

  // Résultat courant : surligné plus fort, amené au centre quand on vient de le choisir.
  useEffect(() => {
    const range = searching ? ranges.current[index] : undefined
    if (!range) {
      registry()?.delete(CURRENT)
      return
    }
    registry()?.set(CURRENT, new Highlight(range))
    const root = container.current
    // Recherche pas encore recalculée : les plages sont celles de la précédente, on attend.
    if (root && !pending && revealed.current !== reveal) {
      revealed.current = reveal
      bringIntoView(range, root)
    }
  }, [searching, pending, index, found, reveal, container])

  // Composant démonté : plus de surlignage.
  useEffect(() => () => clear(), [])

  const step = (direction: 1 | -1) => {
    if (count === 0) return
    setCurrent((index + direction + count) % count)
    setReveal((r) => r + 1)
  }
  return { count, pending, current: index, next: () => step(1), previous: () => step(-1) }
}
