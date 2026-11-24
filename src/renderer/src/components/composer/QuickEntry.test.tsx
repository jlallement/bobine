import { act, fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ScreenCaptureResult } from '@shared/attachments'
import { ALL_FEATURES } from '@shared/platform'
import { QuickEntry } from './QuickEntry'

/**
 * Fenêtre rapide (fiches 062, 124, 145) : remplace les vérifications de composant de
 * `e2e/suites/quick.mjs` (n° 4, 5, 7, 8, 9, 10). La capture réelle (fenêtres masquées, refus de
 * macOS) reste au main (`screen-capture.test.ts`) ; l'envoi jusqu'à la fenêtre principale, à
 * `parcours-outils`.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const api = window.api as unknown as Record<string, Record<string, unknown> | undefined>
const app = api.app as Record<string, unknown>
afterEach(() => {
  delete api.settings
  delete api.quick
  delete api.capture
  delete app.features
})

const image = { kind: 'image' as const, name: 'capture.png', mimeType: 'image/png', data: 'AA==' }

async function setup(results: ScreenCaptureResult[], screenCapture = true) {
  if (!screenCapture) app.features = { ...ALL_FEATURES, screenCapture: false }
  const screenFn = vi.fn(async () => results.shift() ?? null)
  const openSettings = vi.fn(async () => {})
  // Apparence de l'app : sans objet ici, jamais lue.
  api.settings = { get: () => new Promise(() => {}), onChanged: () => () => {} }
  api.quick = {
    info: async () => ({ agentLabel: 'Agent factice', workspace: '/tmp/projet' }),
    onShown: () => () => {},
    resize: async () => {},
    send: vi.fn(async () => {}),
    hide: async () => {}
  }
  api.capture = { screen: screenFn, openSettings }
  render(<QuickEntry />)
  await act(async () => {})
  const capture = async () => {
    await act(async () => fireEvent.click(screen.getByTestId('quick-capture')))
  }
  return { capture, screenFn, openSettings }
}

describe('fenêtre rapide : capture d’écran', () => {
  it('capture annulée : rien de joint, aucun message (quick n° 4)', async () => {
    const { capture, screenFn } = await setup([null])
    await capture()
    expect(screenFn).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('quick-images')).toBeNull()
    expect(screen.queryByTestId('capture-problem')).toBeNull()
    expect(screen.queryByTestId('quick-error')).toBeNull()
  })

  it('refus de macOS après la sélection : rien de joint, la raison est dite (quick n° 5)', async () => {
    const { capture } = await setup([{ kind: 'unavailable', reason: 'failed' }])
    await capture()
    const problem = screen.getByTestId('capture-problem')
    expect(problem.getAttribute('data-reason')).toBe('failed')
    expect(problem.textContent).toContain(i18next.t('composer.capture.unavailable.failed'))
    expect(screen.queryByTestId('quick-images')).toBeNull()
  })

  it('autorisation refusée : le bouton ouvre le réglage de macOS (quick n° 7)', async () => {
    const { capture, openSettings } = await setup([{ kind: 'unavailable', reason: 'denied' }])
    await capture()
    fireEvent.click(screen.getByTestId('capture-settings'))
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('autorisation rendue : la capture suivante est jointe, l’avis s’en va (quick n° 8, 9)', async () => {
    const { capture } = await setup([{ kind: 'unavailable', reason: 'denied' }, image])
    await capture()
    expect(screen.getByTestId('capture-problem')).toBeTruthy()
    await capture()
    expect(screen.queryByTestId('capture-problem')).toBeNull()
    const img = screen.getByTestId('quick-images').querySelector('img')
    expect(img?.getAttribute('alt')).toBe('capture.png')
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AA==')
  })

  it('sans capture d’écran (plateforme) : pas de bouton (quick n° 10)', async () => {
    await setup([], false)
    expect(screen.queryByTestId('quick-capture')).toBeNull()
    expect(screen.getByTestId('quick-send')).toBeTruthy()
  })
})
