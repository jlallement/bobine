import { render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { ConversationOutline } from './ConversationOutline'

/** Trois messages de l'utilisateur, une réponse courte après chacun. */
const items: TranscriptItem[] = [1, 2, 3].map((id) => ({
  kind: 'user',
  id,
  text: `Question ${id}`
}))

/** Haut (px, dans la fenêtre) de chaque message rendu ; le fil commence à 0. */
let tops: Record<number, number>

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

/**
 * Fil factice qui défile : 600 px de haut, 2000 px de contenu, une colonne de 600 px dans 1000 px
 * (place pour le sommaire). Les messages sont placés par `tops`.
 */
function thread(scrollTop: number) {
  const scroller = document.createElement('div')
  const column = document.createElement('div')
  column.className = 'column'
  scroller.append(column)
  for (const { id } of items) {
    const node = document.createElement('div')
    node.dataset['testid'] = 'user-message'
    node.dataset['itemId'] = String(id)
    node.getBoundingClientRect = () => ({ top: tops[id] ?? 0 }) as DOMRect
    column.append(node)
  }
  const size = (el: HTMLElement, values: Record<string, number>) => {
    for (const [name, value] of Object.entries(values)) {
      Object.defineProperty(el, name, { configurable: true, value })
    }
  }
  size(scroller, { clientHeight: 600, clientWidth: 1000, scrollHeight: 2000, scrollTop })
  size(column, { clientWidth: 600 })
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
  document.body.append(scroller)
  return scroller
}

const currentBar = (container: HTMLElement) => {
  const bars = [...container.querySelectorAll('.outline-bar')]
  return bars.findIndex((bar) => bar.classList.contains('current'))
}

it('tout en bas du fil : le dernier message est le courant, même sous le premier tiers (fiche 277)', () => {
  // Fin de fil d'échanges courts : le haut du dernier message (450 px) reste sous le tiers (200 px).
  tops = { 1: -900, 2: 100, 3: 450 }
  const ref = { current: thread(1400) }
  const { container } = render(<ConversationOutline items={items} scroller={ref} />)
  expect(currentBar(container)).toBe(2)
})

it('plus haut dans le fil : le dernier message dont le haut a passé le premier tiers', () => {
  tops = { 1: -900, 2: 100, 3: 450 }
  const ref = { current: thread(1000) }
  const { container } = render(<ConversationOutline items={items} scroller={ref} />)
  expect(currentBar(container)).toBe(1)
})
