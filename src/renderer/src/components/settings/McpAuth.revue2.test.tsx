/**
 * Essai Q5 du testeur (second passage du lot 2, sur `4ca2e240`), gardé comme essai permanent,
 * assertion intacte. Seule adaptation : la relecture rend le dossier relu (`workspace`, magasin
 * rangé par agent et dossier depuis la correction M3).
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
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
    workspace: '/projets/demo',
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

describe('REVUE lot 2, passage 2', () => {
  it('Q5 « Se connecter » sans réponse du main (environnement qui attend le trousseau) : « Annuler » doit rester possible', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    mcp.connect.mockImplementation(() => new Promise(() => {}))
    await open()
    await click(screen.getByTestId('mcp-auth-connect'))
    // Second clic, ou « Annuler » si l'état passe « en cours » par une autre voie : rien ne part.
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await act(async () => emit(state('connecting', { host: 'www.figma.com' })))
    await click(screen.getByTestId('mcp-auth-cancel'))
    expect(mcp.cancelConnect).toHaveBeenCalled()
  })
})
