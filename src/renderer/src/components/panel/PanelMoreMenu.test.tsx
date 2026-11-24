/**
 * Menu « + » du panneau (fiche 185, maquette 7) : lignes des onglets rangés faute de place.
 * Remplaçant des vérifications de composant de la suite e2e `onglets-etroits` (inventaire C, #6 à
 * #9). Le rangement lui-même dépend de la largeur réelle des onglets (jsdom n'en a pas) : il reste
 * vu par l'e2e et la capture ; ici, les onglets rangés sont donnés au menu.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PanelTab } from '@shared/panel'
import { PanelMoreMenu } from './PanelMoreMenu'

const LABELS: Partial<Record<PanelTab, string>> = {
  changes: 'Modifications',
  terminal: 'Terminal',
  acp: 'Échanges ACP',
  browser: 'Navigateur'
}

function Menu({ onTab, onCloseTab }: { onTab: (id: PanelTab) => void; onCloseTab: () => void }) {
  const [overflow, setOverflow] = useState<PanelTab[]>(['changes', 'terminal', 'acp'])
  return (
    <Tooltip.Provider>
      <PanelMoreMenu
        overflow={overflow}
        closed={['browser']}
        counts={{ changes: '12' }}
        label={(id) => LABELS[id] ?? id}
        onTab={onTab}
        onCloseTab={(id) => {
          onCloseTab()
          setOverflow((current) => current.filter((tab) => tab !== id))
        }}
      />
    </Tooltip.Provider>
  )
}

function open() {
  const onTab = vi.fn()
  const onCloseTab = vi.fn()
  render(<Menu onTab={onTab} onCloseTab={onCloseTab} />)
  fireEvent.pointerDown(screen.getByTestId('panel-more'), { button: 0, ctrlKey: false })
  return { onTab, onCloseTab }
}
const row = (id: PanelTab) =>
  document.querySelector<HTMLElement>(`[data-testid="panel-more-tab"][data-tab="${id}"]`)
const rows = () =>
  [...document.querySelectorAll<HTMLElement>('[data-testid="panel-more-tab"]')].map(
    (line) => line.dataset['tab']
  )
const menuOpen = () => screen.queryByTestId('panel-more-menu') !== null

describe('menu « + » : onglets rangés (fiche 185)', () => {
  it('le bouton compte les onglets rangés ; leurs lignes en tête, compte compris, puis les outils', () => {
    open()
    expect(screen.getByTestId('panel-more').textContent).toBe('3')
    expect(rows()).toEqual(['changes', 'terminal', 'acp'])
    expect(row('changes')?.textContent).toContain('12')
    expect(screen.getByText('Ouvrir un outil')).toBeTruthy()
    expect(screen.getByText('Navigateur')).toBeTruthy()
  })

  it('✕ d’une ligne : ferme l’onglet sans l’ouvrir, le menu reste ouvert', () => {
    const { onTab, onCloseTab } = open()
    const close = row('terminal')?.querySelector('[data-testid="panel-more-tab-close"]')
    fireEvent.pointerDown(close as Element, { button: 0 })
    fireEvent.click(row('terminal') as HTMLElement)
    expect(onCloseTab).toHaveBeenCalledTimes(1)
    expect(onTab).not.toHaveBeenCalled()
    expect(menuOpen()).toBe(true)
    expect(rows()).toEqual(['changes', 'acp'])
  })

  it('appui sur ✕ glissé hors de la ligne : rien ne se ferme, le menu reste ouvert', () => {
    const { onTab, onCloseTab } = open()
    const close = row('terminal')?.querySelector('[data-testid="panel-more-tab-close"]')
    fireEvent.pointerDown(close as Element, { button: 0 })
    fireEvent.pointerLeave(row('terminal') as HTMLElement)
    expect(onCloseTab).not.toHaveBeenCalled()
    expect(onTab).not.toHaveBeenCalled()
    expect(menuOpen()).toBe(true)
    // Un clic qui suivrait n'est plus celui du ✕ : la ligne s'ouvre, rien n'est fermé.
    fireEvent.click(row('terminal') as HTMLElement)
    expect(onCloseTab).not.toHaveBeenCalled()
    expect(onTab).toHaveBeenCalledWith('terminal')
  })

  it('↩ sur la ligne l’ouvre, même après un appui sur son ✕ : rien n’est fermé', () => {
    const { onTab, onCloseTab } = open()
    const line = row('acp') as HTMLElement
    fireEvent.pointerDown(line.querySelector('[data-testid="panel-more-tab-close"]') as Element, {
      button: 0
    })
    line.focus()
    fireEvent.keyDown(line, { key: 'Enter' })
    expect(onCloseTab).not.toHaveBeenCalled()
    expect(onTab).toHaveBeenCalledWith('acp')
  })

  it('⌫ sur une ligne rangée ferme l’onglet ; le focus passe à la ligne suivante', async () => {
    const { onTab, onCloseTab } = open()
    const line = row('changes') as HTMLElement
    line.focus()
    fireEvent.keyDown(line, { key: 'Backspace' })
    expect(onCloseTab).toHaveBeenCalledTimes(1)
    expect(onTab).not.toHaveBeenCalled()
    // Le focus est posé à l'image suivante, après le rendu sans la ligne fermée.
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(rows()).toEqual(['terminal', 'acp'])
    expect(menuOpen()).toBe(true)
    expect(document.activeElement).toBe(row('terminal'))
    // Suppr aussi ; la dernière ligne fermée, le focus remonte à la précédente.
    fireEvent.keyDown(row('acp') as HTMLElement, { key: 'Delete' })
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    expect(document.activeElement).toBe(row('terminal'))
  })
})
