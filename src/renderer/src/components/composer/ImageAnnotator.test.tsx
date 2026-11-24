/**
 * Annotation d'une image jointe (fiches 067, 094) sans vrai canevas : l'image et le contexte 2D
 * sont simulés, les gestes passent par les évènements de pointeur. Le rendu réel (pixels, texte
 * replié par la police) et la fenêtre rapide agrandie restent dans l'e2e `annotate`. Remplace les
 * vérifications de composant de `e2e/suites/annotate.mjs` (n° 1, 3) ; le dessin des formes est
 * aussi dans `annotation.test.ts`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageAttachment } from '@shared/attachments'
import { ImageAnnotator } from './ImageAnnotator'

const WIDTH = 400
const HEIGHT = 300

/** Ce que le canevas a dessiné, primitive par primitive. */
let drawn: string[] = []

/** Contexte 2D simulé : chaque appel est noté ; `measureText` rend une largeur. */
function fakeContext(): CanvasRenderingContext2D {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 8 })
      return () => {
        drawn.push(String(prop))
      }
    },
    set(target, prop, value) {
      target[prop] = value
      return true
    }
  }) as unknown as CanvasRenderingContext2D
}

const saved = {
  Image: globalThis.Image,
  getContext: HTMLCanvasElement.prototype.getContext,
  toDataURL: HTMLCanvasElement.prototype.toDataURL,
  rect: HTMLCanvasElement.prototype.getBoundingClientRect
}

beforeAll(() => {
  // L'image se charge aussitôt, à sa taille.
  class LoadedImage {
    onload: (() => void) | null = null
    naturalWidth = WIDTH
    naturalHeight = HEIGHT
    set src(_value: string) {
      queueMicrotask(() => this.onload?.())
    }
  }
  globalThis.Image = LoadedImage as unknown as typeof Image
  HTMLCanvasElement.prototype.getContext = function () {
    return fakeContext()
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,QU5OT1RFRQ=='
  // Le canevas à la taille de l'image (échelle 1), en haut à gauche.
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT }) as DOMRect
  Element.prototype.setPointerCapture = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})

afterAll(() => {
  globalThis.Image = saved.Image
  HTMLCanvasElement.prototype.getContext = saved.getContext
  HTMLCanvasElement.prototype.toDataURL = saved.toDataURL
  HTMLCanvasElement.prototype.getBoundingClientRect = saved.rect
})

beforeEach(() => {
  drawn = []
})

const image: ImageAttachment = {
  kind: 'image',
  name: 'capture.jpg',
  mimeType: 'image/jpeg',
  data: 'AAAA'
}

async function open() {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(<ImageAnnotator image={image} onApply={onApply} onClose={onClose} />)
  const canvas = screen.getByTestId('annotator-canvas')
  await act(async () => {})
  expect(canvas.getAttribute('data-ready')).toBe('true')
  return { canvas, onApply, onClose }
}

function drag(canvas: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1], pointerId: 1 })
  fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 })
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 })
}

describe('annoter une image jointe (fiche 067)', () => {
  it('Échap : fermée sans rien appliquer, l’image reste celle d’origine', async () => {
    const { canvas, onApply, onClose } = await open()
    drag(canvas, [20, 20], [120, 90])
    fireEvent.keyDown(screen.getByTestId('annotator'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('Échap dans la saisie d’un texte abandonne ce texte, l’annotation reste ouverte', async () => {
    const { canvas, onClose } = await open()
    fireEvent.click(screen.getByTestId('annotator-tool-text'))
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 40, pointerId: 1 })
    const text = screen.getByTestId('annotator-text')
    fireEvent.change(text, { target: { value: 'ici' } })
    fireEvent.keyDown(text, { key: 'Escape' })
    expect(screen.queryByTestId('annotator-text')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('annotator')).toBeTruthy()
    // Le texte abandonné n'est pas devenu une annotation.
    expect((screen.getByTestId('annotator-apply') as HTMLButtonElement).disabled).toBe(true)
  })

  it('rectangle, flèche et texte dessinés ; « Annuler le dernier » et « Appliquer » s’activent', async () => {
    const { canvas, onApply } = await open()
    const undo = screen.getByTestId('annotator-undo') as HTMLButtonElement
    const apply = screen.getByTestId('annotator-apply') as HTMLButtonElement
    expect(undo.disabled).toBe(true)
    expect(apply.disabled).toBe(true)

    // Un simple clic n'est pas une forme.
    drag(canvas, [50, 50], [52, 51])
    expect(undo.disabled).toBe(true)

    drag(canvas, [20, 20], [120, 90])
    expect(undo.disabled).toBe(false)
    expect(drawn).toContain('strokeRect')

    fireEvent.click(screen.getByTestId('annotator-tool-arrow'))
    expect(screen.getByTestId('annotator-tool-arrow').getAttribute('aria-checked')).toBe('true')
    drawn = []
    drag(canvas, [200, 200], [300, 120])
    expect(drawn.filter((d) => d === 'lineTo').length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByTestId('annotator-tool-text'))
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 200, pointerId: 1 })
    const text = screen.getByTestId('annotator-text')
    fireEvent.change(text, { target: { value: 'Ici' } })
    drawn = []
    fireEvent.keyDown(text, { key: 'Enter' })
    expect(screen.queryByTestId('annotator-text')).toBeNull()
    expect(drawn).toContain('fillText')

    // Trois formes : « Annuler le dernier » retire le texte seulement.
    fireEvent.click(undo)
    drawn = []
    fireEvent.click(undo)
    expect(drawn).toContain('strokeRect')
    expect(drawn).not.toContain('fillText')
    // La troisième annulation ramène à l'image seule.
    fireEvent.click(undo)
    expect(undo.disabled).toBe(true)
    expect(apply.disabled).toBe(true)

    // Une forme de nouveau, puis « Appliquer » : l'image est redessinée sous les formes.
    fireEvent.click(screen.getByTestId('annotator-tool-rect'))
    drag(canvas, [10, 10], [60, 60])
    drawn = []
    fireEvent.click(apply)
    expect(drawn).toContain('drawImage')
    expect(onApply).toHaveBeenCalledWith({
      kind: 'image',
      name: 'capture.png',
      mimeType: 'image/png',
      data: 'QU5OT1RFRQ=='
    })
  })
})
