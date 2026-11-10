// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTitleTooltips } from './title-tooltips'

const bubble = () => document.querySelector('[data-testid=title-tooltip]')
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('infobulles des `title` (fiche 126)', () => {
  let dispose: () => void
  let button: HTMLButtonElement
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML =
      '<div id="list"><button title="Supprimer">x</button></div><p>ailleurs</p>'
    button = document.querySelector('button') as HTMLButtonElement
    dispose = installTitleTooltips(document)
  })
  afterEach(() => {
    dispose()
    vi.useRealTimers()
  })

  const hover = (element: Element) =>
    element.dispatchEvent(new Event('pointerover', { bubbles: true }))
  const leave = (element: Element, to: Element) => {
    const event = new Event('pointerout', { bubbles: true })
    Object.defineProperty(event, 'relatedTarget', { value: to })
    element.dispatchEvent(event)
  }

  it('remplace l’infobulle native au survol, puis rend le `title`', () => {
    hover(button)
    expect(button.hasAttribute('title')).toBe(false)
    expect(bubble()).toBeNull()
    vi.advanceTimersByTime(400)
    expect(bubble()?.textContent).toBe('Supprimer')
    leave(button, document.querySelector('p') as Element)
    expect(bubble()).toBeNull()
    expect(button.getAttribute('title')).toBe('Supprimer')
  })

  it('fermée au défilement, sans infobulle native tant que le pointeur reste', () => {
    hover(button)
    vi.advanceTimersByTime(400)
    document.getElementById('list')?.dispatchEvent(new Event('scroll'))
    expect(bubble()).toBeNull()
    expect(button.hasAttribute('title')).toBe(false)
  })

  it('fermée au clic, `title` rendu, plus rien avant d’avoir quitté l’élément', () => {
    hover(button)
    vi.advanceTimersByTime(400)
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(bubble()).toBeNull()
    expect(button.getAttribute('title')).toBe('Supprimer')
    hover(button)
    vi.advanceTimersByTime(400)
    expect(bubble()).toBeNull()
    leave(button, document.querySelector('p') as Element)
    hover(button)
    vi.advanceTimersByTime(400)
    expect(bubble()?.textContent).toBe('Supprimer')
  })

  it('fermée quand l’élément survolé disparaît (changement d’onglet)', async () => {
    hover(button)
    vi.advanceTimersByTime(400)
    expect(bubble()).not.toBeNull()
    button.remove()
    vi.useRealTimers()
    await flush()
    expect(bubble()).toBeNull()
  })

  it('suit un `title` changé pendant le survol ; nom accessible gardé pour un bouton à icône', async () => {
    button.textContent = ''
    hover(button)
    expect(button.getAttribute('aria-label')).toBe('Supprimer')
    button.setAttribute('title', 'Cliquer encore')
    vi.useRealTimers()
    await flush()
    expect(button.hasAttribute('title')).toBe(false)
    leave(button, document.querySelector('p') as Element)
    expect(button.getAttribute('title')).toBe('Cliquer encore')
    expect(button.hasAttribute('aria-label')).toBe(false)
  })
})
