/**
 * Essais Q1 à Q3 du testeur (relecture adverse du lot 2, sur `639483e2`), gardés comme essais
 * permanents, assertions intactes. Seule adaptation au contrat de `e3168542` : le magasin d'état
 * est partagé par la fenêtre (`mcp-auth.ts`), il est vidé avant chaque essai.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  McpAgentView,
  McpAuthState,
  McpAuthView,
  McpConnectResult,
  McpDisconnectResult,
  McpServerEntry
} from '@shared/mcp'
import { McpSettings } from './McpSettings'
import { resetMcpAuthStore } from '../../mcp-auth'

const FIGMA = 'https://mcp.figma.com/mcp'
const nbsp = (text: string) => text.replace(/ /g, ' ')

const figma = (over: Partial<McpServerEntry> = {}): McpServerEntry => ({
  name: 'figma',
  transport: 'http',
  url: FIGMA,
  enabled: true,
  scope: 'global',
  file: '~/.config/opencode/opencode.json',
  authPreset: 'figma',
  ...over
})
const recherche: McpServerEntry = {
  name: 'recherche',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@acme/recherche-web'],
  enabled: true,
  scope: 'global',
  file: '~/.config/opencode/opencode.json'
}
const opencode = (servers: McpServerEntry[]): McpAgentView => ({
  profileId: 'opencode',
  label: 'OpenCode',
  files: { global: '~/.config/opencode/opencode.json' },
  servers,
  oauth: true
})
const bob: McpAgentView = {
  profileId: 'bob',
  label: 'IBM Bob',
  files: { global: '~/.bob/settings/mcp.json' },
  servers: [{ ...recherche, file: '~/.bob/settings/mcp.json' }]
}

interface World {
  views: McpAgentView[]
  states: McpAuthState[]
  agentFound: boolean
  connect: McpConnectResult
  disconnect: McpDisconnectResult
}

let world: World
let emit: (state: McpAuthState) => void
const original = window.api
const clipboard = { writeText: vi.fn(async (_text: string) => {}) }

function setup(over: Partial<World> = {}) {
  world = {
    views: [bob, opencode([recherche])],
    states: [],
    agentFound: true,
    connect: { started: true },
    disconnect: { done: true },
    ...over
  }
  const authStates = vi.fn(async (profileId: string): Promise<McpAuthView> => ({
    profileId,
    agentFound: world.agentFound,
    servers: world.states,
    terminal: Object.fromEntries(world.states.map((s) => [s.name, `opencode mcp auth ${s.name}`]))
  }))
  const mcp = {
    list: vi.fn(async () => world.views),
    appTools: async () => [],
    test: vi.fn(async () => ({ ok: false, error: 'x', ms: 0 })),
    remove: vi.fn(async () => world.views),
    setEnabled: vi.fn(async () => world.views),
    addPreset: vi.fn(async () => {
      world.views = [bob, opencode([recherche, figma()])]
      return { name: 'figma', added: true, views: world.views }
    }),
    authStates,
    connect: vi.fn(async () => world.connect),
    cancelConnect: vi.fn(async () => true),
    reopenPage: vi.fn(async () => true),
    disconnect: vi.fn(async () => world.disconnect),
    openPresetList: vi.fn(async () => {}),
    onAuthState: vi.fn((listener: (state: McpAuthState) => void) => {
      emit = listener
      return () => {}
    })
  }
  window.api = { ...original, mcp } as unknown as Window['api']
  return mcp
}

beforeEach(() => {
  resetMcpAuthStore()
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
  clipboard.writeText.mockClear()
})
afterEach(() => {
  window.api = original
})

async function open(tab = 'opencode', workspace = '/projets/demo') {
  const view = render(<McpSettings workspace={workspace} initialTab={tab} />)
  await act(async () => {})
  return view
}
const row = (name: string) =>
  screen.getAllByTestId('mcp-server').find((r) => r.dataset['name'] === name) as HTMLElement
const line = (name = 'figma') => within(row(name)).getByTestId('mcp-auth')
const text = (name = 'figma') =>
  nbsp(within(row(name)).getByTestId('mcp-auth-text').textContent ?? '')
const state = (status: McpAuthState['status'], more: Partial<McpAuthState> = {}): McpAuthState => ({
  profileId: 'opencode',
  name: 'figma',
  status,
  ...more
})
const click = async (element: Element) => {
  await act(async () => {
    fireEvent.click(element)
  })
}

describe('REVUE lot 2', () => {
  it('Q1 double clic sur « Se connecter » : la ligne reste « en cours », pas une erreur « busy »', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    let calls = 0
    mcp.connect.mockImplementation(async () => {
      calls++
      if (calls === 1) {
        world.states = [state('connecting', { host: 'www.figma.com' })]
        emit(state('connecting', { host: 'www.figma.com' }))
        return { started: true }
      }
      return { started: false, reason: 'busy' }
    })
    await open()
    const button = screen.getByTestId('mcp-auth-connect')
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await act(async () => {})
    expect(text()).toBe('Connexion en cours (www.figma.com)')
    expect(line().className).not.toContain('err')
  })

  it('Q2 focus après « Se connecter » : le bouton disparaît, le focus ne doit pas tomber sur la page', async () => {
    setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    await open()
    const button = screen.getByTestId('mcp-auth-connect')
    button.focus()
    expect(document.activeElement).toBe(button)
    await click(button)
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await act(async () => emit(state('connecting', { host: 'www.figma.com' })))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('Q3 « Annuler » au clavier : focus perdu aussi', async () => {
    setup({
      views: [opencode([figma()])],
      states: [state('connecting', { host: 'www.figma.com' })]
    })
    await open()
    const cancel = screen.getByTestId('mcp-auth-cancel')
    cancel.focus()
    await click(cancel)
    world.states = [state('to-connect')]
    await act(async () => emit(state('to-connect')))
    expect(document.activeElement).not.toBe(document.body)
  })
})
