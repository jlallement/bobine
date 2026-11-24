import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageAttachment } from '@shared/attachments'
import { ImageAnnotator } from './ImageAnnotator'

/**
 * jsdom ne charge pas d'image et n'a pas de canevas : une image qui « se charge » tout de suite
 * (400 × 300) et un contexte 2D dont chaque méthode ne fait rien.
 */
class LoadedImage {
  naturalWidth = 400
  naturalHeight = 300
  onload: (() => void) | null = null
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

const image: ImageAttachment = {
  kind: 'image',
  name: 'capture.png',
  mimeType: 'image/png',
  data: ''
}

beforeEach(() => {
  vi.stubGlobal('Image', LoadedImage)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  const ctx = new Proxy({}, { get: () => () => {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 400,
    height: 300,
    right: 400,
    bottom: 300,
    toJSON: () => ({})
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openAnnotator() {
  const onClose = vi.fn()
  render(<ImageAnnotator image={image} onApply={() => {}} onClose={onClose} />)
  await waitFor(() => expect(screen.getByTestId('annotator-canvas').dataset.ready).toBe('true'))
  return onClose
}

describe('annotation d’une image : Échap (fiche 067)', () => {
  it('Échap dans la saisie d’un texte abandonne ce texte, l’annotation reste ouverte', async () => {
    const onClose = await openAnnotator()
    fireEvent.click(screen.getByTestId('annotator-tool-text'))
    fireEvent.pointerDown(screen.getByTestId('annotator-canvas'), { clientX: 50, clientY: 40 })
    const text = screen.getByTestId('annotator-text')
    fireEvent.change(text, { target: { value: 'ici' } })
    fireEvent.keyDown(text, { key: 'Escape' })
    expect(screen.queryByTestId('annotator-text')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('annotator')).toBeTruthy()
    // Le texte abandonné n'est pas devenu une annotation.
    expect((screen.getByTestId('annotator-apply') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Échap hors saisie ferme l’annotation, comme avant', async () => {
    const onClose = await openAnnotator()
    fireEvent.keyDown(screen.getByTestId('annotator'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
