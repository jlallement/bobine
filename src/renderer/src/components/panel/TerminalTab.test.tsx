/**
 * Onglet « Terminal » côté renderer (fiches 034, 134), xterm.js simulé : remplaçant des
 * vérifications de composant de la suite e2e `terminal` (inventaire A, #13, #14, #16). Le vrai pty,
 * la police d'icônes mesurée au canevas, ⌃` dans xterm et la sélection réelle restent à l'e2e
 * (`parcours-outils`).
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ITheme } from '@xterm/xterm'
import { themeTokens } from '@shared/themes'
import type { TerminalTabInfo } from '@shared/terminal'
import { TerminalTab } from './TerminalTab'

/** Instances de xterm.js créées, avec leurs options (le thème surtout). */
const terms = vi.hoisted(() => [] as { options: { theme?: ITheme; fontFamily?: string } }[])
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options: Record<string, unknown>
    cols = 100
    rows = 30
    constructor(options: Record<string, unknown>) {
      this.options = { ...options }
      terms.push(this as never)
    }
    loadAddon() {}
    open() {}
    onData() {}
    onSelectionChange() {}
    write() {}
    focus() {}
    dispose() {}
    getSelection() {
      return ''
    }
    clearSelection() {}
  }
}))
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  }
}))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))
// Police des icônes déjà chargée (fiche 201) : l'instance se crée aussitôt.
vi.mock('../../appearance', async (load) => ({
  ...(await load<typeof import('../../appearance')>()),
  terminalSymbolsSettled: () => true,
  loadTerminalSymbols: async () => {}
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)

const original = window.api
afterEach(() => {
  window.api = original
  terms.length = 0
  delete document.documentElement.dataset['accent']
})

const tab = (id: string): TerminalTabInfo => ({ id, title: 'zsh', cwd: '/depot', busy: false })

function main(list: TerminalTabInfo[]) {
  const terminal = {
    list: vi.fn(async () => list),
    create: vi.fn(async () => tab(String(list.length + 1))),
    onChanged: () => () => {},
    onData: () => () => {},
    snapshot: vi.fn(async () => ''),
    resize: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined)
  }
  window.api = { ...original, terminal } as unknown as Window['api']
  render(
    <Tooltip.Provider>
      <TerminalTab conversationId="c1" />
    </Tooltip.Provider>
  )
  return terminal
}

const chips = () =>
  screen.getAllByTestId('terminal-tab-chip').map((chip) => ({
    text: chip.querySelector('[role=tab]')?.textContent,
    active: chip.classList.contains('active')
  }))

describe('onglet « Terminal » (fiches 034, 134)', () => {
  it('fond et palette ANSI : les jetons du thème affiché', async () => {
    main([tab('1')])
    await waitFor(() => expect(terms).toHaveLength(1))
    const theme = terms[0]?.options.theme
    const tokens = themeTokens('light', 'orange')
    expect(theme?.background).toBe(tokens.surface)
    expect(theme?.foreground).toBe(tokens.text)
    expect(theme?.cursor).toBe(tokens.accent)
    expect(theme?.red).toBe(tokens.ansi[1])
    expect(theme?.brightWhite).toBe(tokens.ansi[15])
  })

  it('accent changé : les couleurs suivent, sans rouvrir l’onglet', async () => {
    main([tab('1')])
    await waitFor(() => expect(terms).toHaveLength(1))
    const before = terms[0]?.options.theme?.cursor
    document.documentElement.dataset['accent'] = 'blue'
    await waitFor(() =>
      expect(terms[0]?.options.theme?.cursor).toBe(themeTokens('light', 'blue').accent)
    )
    expect(terms[0]?.options.theme?.cursor).not.toBe(before)
    // La même instance : rien n'a été rouvert.
    expect(terms).toHaveLength(1)
  })

  it('« + » : un nouvel onglet de terminal, affiché aussitôt', async () => {
    const terminal = main([tab('1')])
    await waitFor(() => expect(chips()).toEqual([{ text: '1 · zsh', active: true }]))
    await act(async () => {
      fireEvent.click(screen.getByTestId('terminal-new'))
    })
    expect(terminal.create).toHaveBeenCalledWith('c1', 100, 30)
    await waitFor(() => expect(terms).toHaveLength(2))
  })

  it('aucun onglet : un shell s’ouvre de lui-même', async () => {
    const terminal = main([])
    await waitFor(() => expect(terminal.create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(chips()).toEqual([{ text: '1 · zsh', active: true }]))
  })
})
