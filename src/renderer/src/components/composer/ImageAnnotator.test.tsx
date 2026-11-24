import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ImageAnnotator } from './ImageAnnotator'

/**
 * Annotation d'une image jointe (fiche 067) : remplace les vérifications de composant de
 * `e2e/suites/annotate.mjs` (n° 1, 3). jsdom ne dessine pas : l'image, le canevas et les mesures
 * sont simulés ; le dessin des formes reste à `annotation.test.ts`, le rendu réel à la capture.
 */

const image = { kind: 'image' as const, name: 'capture.png', mimeType: 'image/png', data: 'AA==' }

/** Appels de dessin reçus par le contexte 2D simulé. */
const drawn: string[] = []

const saved = {
  Image: globalThis.Image,
  ResizeObserver: globalThis.ResizeObserver,
  getContext: HTMLCanvasElement.prototype.getContext,
  toDataURL: HTMLCanvasElement.prototype.toDataURL,
  rect: Element.prototype.getBoundingClientRect,
  capture: Element.prototype.setPointerCapture
}

beforeAll(() => {
  // Une image de 400 × 300 qui se charge tout de suite.
  globalThis.Image = class {
    naturalWidth = 400
    naturalHeight = 300
    onload: (() => void) | null = null
    set src(_value: string) {
      queueMicrotask(() => this.onload?.())
    }
  } as unknown as typeof Image
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  // Contexte 2D qui retient le nom de chaque appel.
  HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy(
      {},
      {
        get: (_target, name) => {
          if (name === 'canvas') return this
          return (...args: unknown[]) => {
            drawn.push(String(name))
            // Le texte est mesuré pour le couper en lignes : 8 px par caractère.
            if (name === 'measureText') return { width: String(args[0]).length * 8 }
            return undefined
          }
        },
        set: () => true
      }
    )
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,QU5OT1RFRQ=='
  Element.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 400, 300)
  Element.prototype.setPointerCapture = () => {}
})

afterAll(() => {
  globalThis.Image = saved.Image
  globalThis.ResizeObserver = saved.ResizeObserver
  HTMLCanvasElement.prototype.getContext = saved.getContext
  HTMLCanvasElement.prototype.toDataURL = saved.toDataURL
  Element.prototype.getBoundingClientRect = saved.rect
  Element.prototype.setPointerCapture = saved.capture
})

async function setup() {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(<ImageAnnotator image={image} onApply={onApply} onClose={onClose} />)
  await act(async () => {})
  const canvas = screen.getByTestId('annotator-canvas')
  const drag = (from: [number, number], to: [number, number]) => {
    fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1], pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1], pointerId: 1 })
  }
  return { onApply, onClose, canvas, drag }
}

describe('annoter une image jointe (fiche 067)', () => {
  it('Échap ferme sans rien appliquer : l’image reste telle quelle (annotate n° 1)', async () => {
    const { onApply, onClose } = await setup()
    expect(screen.getByTestId('annotator-canvas').getAttribute('data-ready')).toBe('true')
    fireEvent.keyDown(screen.getByTestId('annotator'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('rectangle, flèche et texte dessinés : « Annuler le dernier » actif, « Appliquer » rend l’image annotée (annotate n° 3)', async () => {
    const { onApply, canvas, drag } = await setup()
    const undo = screen.getByTestId('annotator-undo') as HTMLButtonElement
    expect(undo.disabled).toBe(true)
    drag([20, 20], [120, 90])
    expect(undo.disabled).toBe(false)
    fireEvent.click(screen.getByTestId('annotator-tool-arrow'))
    drag([200, 50], [300, 150])
    fireEvent.click(screen.getByTestId('annotator-tool-text'))
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 200, pointerId: 1 })
    const text = screen.getByTestId('annotator-text')
    fireEvent.change(text, { target: { value: 'ici' } })
    fireEvent.keyDown(text, { key: 'Enter' })
    expect(screen.queryByTestId('annotator-text')).toBeNull()
    // Trois formes : trois annulations ramènent à l'image seule.
    fireEvent.click(undo)
    fireEvent.click(undo)
    expect(undo.disabled).toBe(false)
    fireEvent.click(undo)
    expect(undo.disabled).toBe(true)
    // Une forme de nouveau, puis « Appliquer ».
    fireEvent.click(screen.getByTestId('annotator-tool-rect'))
    drag([10, 10], [60, 60])
    drawn.length = 0
    fireEvent.click(screen.getByTestId('annotator-apply'))
    expect(drawn).toContain('drawImage')
    expect(onApply).toHaveBeenCalledWith({
      kind: 'image',
      name: 'capture.png',
      mimeType: 'image/png',
      data: 'QU5OT1RFRQ=='
    })
  })
})
