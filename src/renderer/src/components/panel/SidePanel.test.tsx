/**
 * Panneau latéral rendu sans l'app (fiches 029, 035, 082, 185, 226) : remplaçant des vérifications
 * de composant des suites e2e `panel` (inventaire B, #3, #5, #9, #15, #17 à #19, #22) et
 * `onglets-etroits` (inventaire C, #2). Le glissement réel de la poignée, l'agrandi en vraie
 * géométrie et `-webkit-app-region` restent en e2e ou en capture (jsdom n'a pas de mise en page).
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
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

type Props = ComponentProps<typeof SidePanel>
function panel(props: Partial<Props> = {}) {
  const all: Props = {
    conversationId: null,
    tab: 'tasks',
    tabs: ['tasks'],
    width: 320,
    maxWidth: 800,
    maximized: false,
    onMaximize: () => {},
    onCloseTab: () => {},
    items: [],
    onTab: () => {},
    onClose: () => {},
    onResize: () => {},
    onResetWidth: () => {},
    ...props
  }
  return render(
    <Tooltip.Provider>
      <SidePanel {...all} />
    </Tooltip.Provider>
  )
}

const plan: TranscriptItem = {
  kind: 'plan',
  id: 1,
  entries: [
    { content: 'Lire le code', status: 'completed', priority: 'medium' },
    { content: 'Écrire le test', status: 'completed', priority: 'medium' },
    { content: 'Vérifier', status: 'completed', priority: 'medium' }
  ]
}

describe('onglet « Tâches » (fiche 035)', () => {
  it('pas encore de liste de tâches : l’état vide le dit', () => {
    panel({ items: [{ kind: 'user', id: 1, text: 'Bonjour' }] })
    expect(screen.getByTestId('tasks-empty').textContent).toContain('pas encore de liste de tâches')
    expect(screen.queryByTestId('tasks')).toBeNull()
  })

  it('dernier plan avec sa progression : 3 tâches faites sur 3', () => {
    const older: TranscriptItem = {
      kind: 'plan',
      id: 0,
      entries: [{ content: 'Ancien', status: 'pending', priority: 'low' }]
    }
    const { container } = panel({ items: [older, plan] })
    expect(screen.getByTestId('tasks').textContent).toContain('3 / 3 tâches faites')
    expect(container.querySelectorAll('.plan-list li.completed')).toHaveLength(3)
    expect(container.textContent).not.toContain('Ancien')
  })
})

describe('en-tête du panneau (fiches 082, 185, 226)', () => {
  it('onglets nommés dans l’ordre donné, avec leur compte (« 3/3 », « 12 »)', () => {
    panel({
      tab: 'session',
      tabs: ['session', 'tasks', 'changes'],
      counts: { tasks: '3/3', changes: '12' }
    })
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Session',
      'Tâches',
      'Modifications'
    ])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
    const count = (id: string) =>
      document.querySelector(`.side-panel-tab[data-tab=${id}] .side-panel-tab-count`)?.textContent
    expect(count('session')).toBeUndefined()
    expect(count('tasks')).toBe('3/3')
    expect(count('changes')).toBe('12')
  })

  it('clic molette sur un onglet : il se ferme ; clic droit : non', () => {
    const onCloseTab = vi.fn()
    panel({ tab: 'session', tabs: ['session', 'tasks'], onCloseTab })
    const tasks = document.querySelector('.side-panel-tab[data-tab=tasks]') as HTMLElement
    fireEvent(tasks, new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    expect(onCloseTab).not.toHaveBeenCalled()
    fireEvent(tasks, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(onCloseTab).toHaveBeenCalledWith('tasks')
  })

  it('poignée : infobulle « glisser · double-clic », double-clic : largeur par défaut', () => {
    const onResetWidth = vi.fn()
    panel({ onResetWidth })
    const handle = screen.getByTestId('side-panel-resize')
    // Espaces insécables de la typographie française ramenés à des espaces ordinaires.
    expect(handle.getAttribute('title')?.replace(/[  ]/g, ' ')).toBe(
      'Glisser pour régler la largeur · double-clic : largeur par défaut'
    )
    fireEvent.doubleClick(handle)
    expect(onResetWidth).toHaveBeenCalledTimes(1)
  })

  it('agrandi : pas de poignée, ni de largeur imposée', () => {
    panel({ maximized: true })
    expect(screen.queryByTestId('side-panel-resize')).toBeNull()
    expect(screen.getByTestId('side-panel').classList.contains('maximized')).toBe(true)
    expect(screen.getByTestId('side-panel').style.width).toBe('')
  })

  it('agrandi sans barre latérale : bouton pour la rouvrir, place gardée pour les feux', () => {
    const onShowSidebar = vi.fn()
    const { container } = panel({ maximized: true, onShowSidebar })
    expect(container.querySelector('.side-panel-head')?.classList.contains('with-lights')).toBe(
      true
    )
    fireEvent.click(screen.getByRole('button', { name: 'Afficher la barre latérale' }))
    expect(onShowSidebar).toHaveBeenCalledTimes(1)
  })

  it('barre latérale visible : ni bouton, ni place pour les feux', () => {
    const { container } = panel({ maximized: true })
    expect(container.querySelector('.side-panel-head')?.classList.contains('with-lights')).toBe(
      false
    )
    expect(screen.queryByRole('button', { name: 'Afficher la barre latérale' })).toBeNull()
  })

  it('agrandi : « Attend votre réponse » ; un clic revient à la conversation', () => {
    const onShowConversation = vi.fn()
    panel({ maximized: true, agentStatus: 'request', onShowConversation })
    const status = screen.getByTestId('panel-agent-status')
    expect(status.textContent).toBe('Attend votre réponse')
    expect(status.classList.contains('request')).toBe(true)
    fireEvent.click(status)
    expect(onShowConversation).toHaveBeenCalledTimes(1)
  })

  it('l’état de l’agent ne s’affiche qu’agrandi (la conversation est alors cachée)', () => {
    panel({ maximized: false, agentStatus: 'busy', onShowConversation: () => {} })
    expect(screen.queryByTestId('panel-agent-status')).toBeNull()
  })
})
