import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AboutWindow, formatBuildDate, LICENSE_URL } from './AboutWindow'

const TECH = 'Bobine 0.4.0 (commit abc1234, built 2026-10-22)\nElectron 44.7.2'

const originalApi = window.api
let about: {
  technicalInfo: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  showChangelog: ReturnType<typeof vi.fn>
}
let writeText: ReturnType<typeof vi.fn>
let open: ReturnType<typeof vi.fn>

beforeEach(() => {
  about = {
    technicalInfo: vi.fn(async () => TECH),
    close: vi.fn(async () => undefined),
    showChangelog: vi.fn(async () => undefined)
  }
  window.api = {
    ...originalApi,
    app: {
      getInfo: async () => ({
        name: 'Bobine',
        version: '0.4.0',
        electron: '44.7.2',
        platform: 'darwin',
        buildDate: '2026-10-22',
        commit: 'abc1234'
      })
    },
    settings: { get: () => new Promise(() => {}), onChanged: () => () => {} },
    about
  } as unknown as Window['api']
  writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  open = vi.fn()
  vi.stubGlobal('open', open)
})

afterEach(() => {
  window.api = originalApi
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fenêtre À propos (fiche 116)', () => {
  it('nom, version et date en toutes lettres, présentation, non-affiliation ; aucune info technique affichée', async () => {
    render(<AboutWindow />)
    expect(await screen.findByText('Bobine')).toBeTruthy()
    expect(screen.getByTestId('about-version').textContent).toBe('Version 0.4.0 · 22 octobre 2026')
    expect(screen.getByText(/Application de bureau pour les agents de code ACP/)).toBeTruthy()
    // Fiche 216 : projet indépendant, dit discrètement sous les liens.
    expect(screen.getByTestId('about-notice').textContent).toBe(
      'Projet indépendant, non affilié à IBM.'
    )
    const text = screen.getByTestId('about').textContent ?? ''
    expect(text).not.toMatch(/Electron|abc1234|darwin|arm64/)
    expect(screen.getByTestId('about-license').getAttribute('href')).toBe(LICENSE_URL)
    expect(screen.getByTestId('about-github').getAttribute('href')).toBe(
      'https://github.com/jlallement/bobine'
    )
    // Le titre est posé par un effet, qui peut passer après l'affichage du nom (CI lente).
    await waitFor(() => expect(document.title).toBe('À propos de Bobine'))
  })

  it('« Copier les infos techniques » : bloc du main dans le presse-papiers, « Copié » deux secondes', async () => {
    render(<AboutWindow />)
    const button = await screen.findByTestId('about-copy')
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(writeText).toHaveBeenCalledWith(TECH)
    expect(button.textContent).toContain('Copié')
    await act(async () => {
      vi.advanceTimersByTime(1900)
    })
    expect(button.textContent).toContain('Copié')
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    expect(button.textContent).toBe('Copier les infos techniques')
  })

  it('« Signaler un problème » : issue préremplie avec la version et le bloc ; « Nouveautés » ; Échap', async () => {
    render(<AboutWindow />)
    const report = await screen.findByTestId('about-report-issue')
    await act(async () => {
      fireEvent.click(report)
    })
    const url = String(open.mock.calls[0]?.[0])
    expect(url).toMatch(
      /^https:\/\/github\.com\/jlallement\/bobine\/issues\/new\?template=bug\.yml/
    )
    expect(url).toContain('version=0.4.0')
    expect(url).toContain(`report=${encodeURIComponent(TECH)}`)

    fireEvent.click(screen.getByTestId('about-whats-new'))
    expect(about.showChangelog).toHaveBeenCalledOnce()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(about.close).toHaveBeenCalledOnce()
  })

  it('date du build dans la langue de l’interface', () => {
    expect(formatBuildDate('2026-10-22', 'fr')).toBe('22 octobre 2026')
    expect(formatBuildDate('2026-10-22', 'en')).toBe('October 22, 2026')
    expect(formatBuildDate('???', 'fr')).toBe('???')
  })
})
