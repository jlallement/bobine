/**
 * Onglets du panneau au clavier (fiche 272, revue) : Entrée sur un onglet l'active, puis Tab et
 * Entrée sur son ✕ le ferment aussitôt (aucun délai après l'activation) ; le second clic d'un double
 * clic, lui, ne ferme jamais.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PanelTab } from '@shared/panel'
import { SidePanel } from './SidePanel'

vi.mock('./TerminalTab', () => ({ TerminalTab: () => null, INSERT_TEXT_EVENT: 'x' }))
vi.mock('./BrowserTab', () => ({ BrowserTab: () => null }))
// jsdom ne fait pas défiler : l'onglet actif amené à l'écran (`scrollTo`, `scrollIntoView`).
Element.prototype.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)

function Panel({ onCloseTab }: { onCloseTab: (tab: PanelTab) => void }) {
  const [tab, setTab] = useState<PanelTab>('tasks')
  return (
    <Tooltip.Provider>
      <SidePanel
        conversationId={null}
        tab={tab}
        tabs={['tasks', 'changes']}
        width={420}
        maxWidth={800}
        maximized={false}
        onMaximize={() => {}}
        onCloseTab={onCloseTab}
        items={[]}
        onTab={setTab}
        onClose={() => {}}
        onResize={() => {}}
        onResetWidth={() => {}}
      />
    </Tooltip.Provider>
  )
}

describe('onglets du panneau (fiche 272)', () => {
  it('clavier : Entrée sur l’onglet, Tab puis Entrée sur son ✕ : il se ferme', () => {
    const onCloseTab = vi.fn()
    render(<Panel onCloseTab={onCloseTab} />)
    // Entrée sur un bouton : un clic sans compte de clics (`detail` 0), comme dans Chromium.
    const tab = document.querySelector<HTMLElement>('.side-panel-tab[data-tab=changes] [role=tab]')
    tab?.focus()
    fireEvent.click(tab as HTMLElement, { detail: 0 })
    expect(document.querySelector('.side-panel-tab.active')?.getAttribute('data-tab')).toBe(
      'changes'
    )
    // Tab : l'élément suivant dans l'ordre de tabulation est son ✕.
    const focusable = [...document.querySelectorAll<HTMLElement>('button:not([disabled])')]
    const next = focusable[focusable.indexOf(tab as HTMLElement) + 1]
    expect(next?.getAttribute('data-testid')).toBe('panel-tab-close')
    next?.focus()
    fireEvent.click(next as HTMLElement, { detail: 0 })
    expect(onCloseTab).toHaveBeenCalledWith('changes')
  })

  it('souris : clic aussitôt après l’activation : ferme ; second clic d’un double clic : non', () => {
    const onCloseTab = vi.fn()
    render(<Panel onCloseTab={onCloseTab} />)
    fireEvent.click(screen.getAllByRole('tab')[1] as HTMLElement)
    const close = document.querySelector<HTMLElement>(
      '.side-panel-tab[data-tab=changes] [data-testid=panel-tab-close]'
    )
    fireEvent.click(close as HTMLElement, { detail: 2 })
    expect(onCloseTab).not.toHaveBeenCalled()
    fireEvent.click(close as HTMLElement, { detail: 1 })
    expect(onCloseTab).toHaveBeenCalledWith('changes')
  })
})
