import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppToolFamily, McpAgentView } from '@shared/mcp'
import { McpSettings } from './McpSettings'

const families: AppToolFamily[] = [
  {
    id: 'ask-user',
    title: 'appToolFamilies.ask-user.title',
    summary: 'appToolFamilies.ask-user.summary',
    condition: 'appToolFamilies.always',
    tools: [{ name: 'ask_user', description: 'Ask the user a question.' }],
    tokens: 270,
    enabled: true,
    required: true
  },
  {
    id: 'ios-simulator',
    title: 'appToolFamilies.ios-simulator.title',
    summary: 'appToolFamilies.ios-simulator.summary',
    condition: 'appToolFamilies.ios-simulator.condition',
    approval: 'appToolFamilies.ios-simulator.approval',
    tools: [
      { name: 'ios_build', description: 'Build the app.' },
      { name: 'ios_tap', description: 'Tap the screen.' }
    ],
    tokens: 1105,
    enabled: true
  }
]

const bob: McpAgentView = {
  profileId: 'bob',
  label: 'IBM Bob',
  files: { global: '~/.bob/settings/mcp.json' },
  servers: []
}

const original = window.api
beforeEach(() => {
  window.api = {
    ...original,
    mcp: {
      list: async () => [bob],
      appTools: async () => families,
      setAppToolFamily: vi.fn(async (id: string, enabled: boolean) =>
        families.map((f) => (f.id === id ? { ...f, enabled } : f))
      )
    }
  } as unknown as Window['api']
})
afterEach(() => {
  window.api = original
})

async function renderSettings(initialTab?: string) {
  render(<McpSettings workspace="/projets/demo" {...(initialTab ? { initialTab } : {})} />)
  await act(async () => {})
}

describe('Réglages › Serveurs MCP : onglet « Bobine » (fiche 099)', () => {
  it('premier onglet, choisi par défaut, avec le nombre d’outils ; les agents ensuite', async () => {
    await renderSettings()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Outils de Bobine3', 'IBM Bob0'])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(/rien à installer ni à régler/)).toBeTruthy()
  })

  it('une carte par famille : titre, nombre, phrase, condition, accord ; repliée', async () => {
    await renderSettings()
    const cards = screen.getAllByTestId('app-tool-family')
    expect(cards.map((card) => card.dataset['id'])).toEqual(['ask-user', 'ios-simulator'])
    const ios = cards[1]
    expect(ios?.textContent).toContain('Simulateur iOS')
    expect(ios?.textContent).toContain('2 outils')
    expect(ios?.querySelector('[data-testid=app-tool-condition]')?.textContent).toBe(
      'Projet Xcode ou Swift dans le dossier'
    )
    expect(ios?.querySelector('[data-testid=app-tool-approval]')?.textContent).toBe(
      'Accord avant de compiler'
    )
    // Les questions ne demandent pas d'accord : pas de pastille orange.
    expect(cards[0]?.querySelector('[data-testid=app-tool-approval]')).toBeNull()
    expect(screen.queryByTestId('app-tool-names')).toBeNull()
  })

  it('dépliée : les noms des outils, avec la description de l’agent au survol', async () => {
    await renderSettings()
    const toggle = screen.getAllByTestId('app-tool-family-toggle')[1]
    if (!toggle) throw new Error('carte absente')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const names = screen.getAllByTestId('app-tool-name')
    expect(names.map((n) => [n.textContent, n.title])).toEqual([
      ['ios_build', 'Build the app.'],
      ['ios_tap', 'Tap the screen.']
    ])
    fireEvent.click(toggle)
    expect(screen.queryByTestId('app-tool-names')).toBeNull()
  })

  it('ouvert sur l’onglet d’un agent (menu ⚙) : ses serveurs, sans les cartes de Bobine', async () => {
    await renderSettings('bob')
    expect(screen.getByTestId('mcp-agent-bob').getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('app-tool-families')).toBeNull()
    expect(screen.getByTestId('mcp-add')).toBeTruthy()
    fireEvent.click(screen.getByTestId('mcp-tab-bobine'))
    expect(screen.getByTestId('app-tool-families')).toBeTruthy()
  })

  it('poids estimé de chaque famille et total ; interrupteur, avis (fiche 109)', async () => {
    await renderSettings()
    expect(screen.getByTestId('app-tools-weight').textContent).toMatch(/1\s375 jetons.*1\s375/)
    const cards = screen.getAllByTestId('app-tool-family')
    expect(cards[1]?.querySelector('[data-testid=app-tool-family-tokens]')?.textContent).toMatch(
      /≈ 1\s105 jetons/
    )
    // Les questions : toujours fournies, dit en clair à la place d'un interrupteur grisé (fiche 126).
    const required = cards[0]?.querySelector('[data-testid=app-tool-required]')
    expect(required?.textContent).toBe('Toujours fournie')
    expect(cards[0]?.querySelector('[data-testid=app-tool-enabled]')).toBeNull()
    // Interrupteur nommé, atteignable par l'accessibilité.
    const ios = screen.getByRole('checkbox', { name: /Simulateur iOS.*proposés aux agents/ })
    expect(screen.queryByTestId('app-tools-applies')).toBeNull()
    await act(async () => {
      fireEvent.click(ios)
    })
    expect(window.api.mcp.setAppToolFamily).toHaveBeenCalledWith('ios-simulator', false)
    expect(screen.getByTestId('app-tools-applies').textContent).toContain('prochaines sessions')
    const card = screen.getAllByTestId('app-tool-family')[1]
    expect(card?.dataset['enabled']).toBe('false')
    expect(card?.querySelector('[data-testid=app-tool-condition]')?.textContent).toBe('Coupée')
    expect(screen.getByTestId('app-tools-weight').textContent).toMatch(/270 jetons.*1\s375/)
  })
})
