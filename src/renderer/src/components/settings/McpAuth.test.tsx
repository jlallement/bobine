/**
 * Réglages › Serveurs MCP : connexion d'un serveur par l'agent (fiche 293, lot 2), contre un faux
 * `api` (aucun réseau, aucun processus). États, actions, raisons, clavier, ligne d'aide.
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
import { MCP_ACTION_GUARD_MS, readMcpAuth, resetMcpAuthStore } from '../../mcp-auth'

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
const row = (name: string) =>
  screen.getAllByTestId('mcp-server').find((r) => r.dataset['name'] === name) as HTMLElement
const line = (name = 'figma') => within(row(name)).getByTestId('mcp-auth')
const text = (name = 'figma') =>
  nbsp(within(row(name)).getByTestId('mcp-auth-text').textContent ?? '')
const links = (name = 'figma') =>
  [...line(name).querySelectorAll('button')].map((b) => b.textContent)
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

describe('ligne « Figma » à ajouter (fiche 293)', () => {
  it('carte pleine sous la liste : logo officiel (texte alternatif vide), phrase, « Connecter Figma »', async () => {
    const mcp = setup()
    await open()
    const preset = screen.getByTestId('mcp-preset')
    const logo = within(preset).getByTestId('mcp-preset-logo') as HTMLImageElement
    expect(logo.getAttribute('alt')).toBe('')
    expect(logo.getAttribute('src')).toMatch(/Figma|svg/)
    expect(logo.className).toContain('size-56')
    expect(preset.textContent).toContain(
      'Serveur officiel de Figma. La connexion se fait dans votre navigateur, avec OpenCode.'
    )
    const button = within(preset).getByTestId('mcp-preset-connect')
    expect(button.textContent).toBe('Connecter Figma')
    expect(button.className).toContain('primary')
    await click(button)
    expect(mcp.addPreset).toHaveBeenCalledWith('opencode', 'figma')
    expect(mcp.connect).toHaveBeenCalledWith('opencode', 'figma')
    // Le serveur ajouté remplace la carte.
    expect(screen.queryByTestId('mcp-preset')).toBeNull()
    expect(row('figma')).toBeTruthy()
  })

  it('absente si l’adresse est déjà déclarée, sous n’importe quel nom', async () => {
    setup({
      views: [bob, opencode([figma({ name: 'maquettes' })])],
      states: [state('to-connect', { name: 'maquettes' })]
    })
    await open()
    expect(screen.queryByTestId('mcp-preset')).toBeNull()
    expect(within(row('maquettes')).getByTestId('mcp-preset-logo').className).toContain('size-28')
  })

  it('agent absent : bouton grisé (atteignable), raison en clair dessous ; rien de lancé', async () => {
    const mcp = setup({ agentFound: false })
    await open()
    const button = screen.getByTestId('mcp-preset-connect')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-description')).toBe('OpenCode n’est pas installé.')
    expect(nbsp(screen.getByTestId('mcp-preset-reason').textContent ?? '')).toBe(
      'OpenCode n’est pas installé.'
    )
    await click(button)
    expect(mcp.addPreset).not.toHaveBeenCalled()
  })
})

describe('ligne d’état d’un serveur connecté par l’agent : un état = une ligne', () => {
  it.each([
    [
      state('to-connect'),
      'À connecter',
      ['Se connecter'],
      'La connexion se fait dans votre navigateur, avec OpenCode.'
    ],
    [
      state('connecting', { host: 'www.figma.com' }),
      'Connexion en cours (www.figma.com)',
      ['Rouvrir la page', 'Annuler'],
      'Page de connexion ouverte dans votre navigateur : autorisez l’accès, puis revenez ici. Sans réponse, abandon au bout de 10 min.'
    ],
    [
      state('connected'),
      'Connecté par OpenCode',
      ['Se déconnecter'],
      'Le jeton reste chez OpenCode : Bobine ne le voit jamais.'
    ],
    [
      state('expired'),
      'Connexion expirée',
      ['Se reconnecter'],
      'OpenCode demande une nouvelle connexion.'
    ],
    [
      state('error', { reason: 'timeout' }),
      'Pas de réponse en 10 min',
      ['Réessayer', 'Dans un terminal'],
      'La connexion n’a pas abouti : OpenCode n’a pas reçu l’accord en 10 min ; la commande a été arrêtée.'
    ],
    [
      state('error', { reason: 'unexpected-page', host: 'evil.test' }),
      'Page inattendue (evil.test)',
      ['Réessayer', 'Dans un terminal'],
      'La connexion n’a pas abouti : la page proposée n’était pas sur www.figma.com ; rien n’a été ouvert, la commande a été arrêtée.'
    ],
    [
      state('error', { reason: 'stopped' }),
      'OpenCode s’est arrêté',
      ['Réessayer', 'Dans un terminal'],
      undefined
    ],
    [
      state('error', { reason: 'failed' }),
      'La connexion n’a pas abouti',
      ['Réessayer', 'Dans un terminal'],
      undefined
    ],
    // R2 non relevé : jamais d'état « refusé » inventé, l'échec générique.
    [state('refused'), 'La connexion n’a pas abouti', ['Réessayer', 'Dans un terminal'], undefined],
    [
      state('no-page'),
      'Pas de page de connexion',
      ['Dans un terminal', 'Réessayer'],
      'OpenCode n’a pas proposé de page de connexion.'
    ],
    [state('agent-missing'), 'OpenCode n’est pas installé.', [], undefined],
    [
      state('unknown'),
      'État de la connexion inconnu',
      ['Se connecter'],
      'L’état n’a pas pu être relu chez OpenCode.'
    ]
  ])('%o', async (s, expected, actions, tip) => {
    setup({ views: [bob, opencode([recherche, figma()])], states: [s] })
    await open()
    expect(text()).toBe(expected)
    expect(links()).toEqual(actions)
    if (tip) expect(nbsp(line().title)).toBe(tip)
    expect(line().dataset['status']).toBe(s.status)
    // Pas de « Tester » pour ce serveur ; l'autre le garde.
    expect(within(row('figma')).queryByTestId('mcp-test')).toBeNull()
    expect(within(row('recherche')).getByTestId('mcp-test')).toBeTruthy()
    // L'état est annoncé poliment, jamais par la seule couleur (icône + texte).
    const live = line().querySelector('[role=status]')
    expect(live?.getAttribute('aria-live')).toBe('polite')
    expect(live?.querySelector('svg')).toBeTruthy()
    // Jamais l'adresse de la page dans le DOM.
    expect(document.body.innerHTML).not.toMatch(/oauth\/mcp|code_challenge|client_id|[?&]state=/)
  })

  it('page inattendue : hôte long raccourci par le début, en entier au survol et pour l’accessibilité', async () => {
    setup({
      views: [opencode([figma()])],
      states: [state('error', { reason: 'unexpected-page', host: 'www.figma.com.evil.test' })]
    })
    await open()
    const host = within(row('figma')).getByTestId('mcp-auth-host')
    expect(host.title).toBe('www.figma.com.evil.test')
    expect(host.querySelector('[aria-hidden=true]')?.textContent).toBe('…com.evil.test')
    expect(host.querySelector('.sr-only')?.textContent).toBe('www.figma.com.evil.test')
  })

  it('« · » jamais seul en début de ligne : chaque séparateur suit son élément, dans le même bloc', async () => {
    setup({
      views: [opencode([figma()])],
      states: [state('connecting', { host: 'www.figma.com' })]
    })
    await open()
    const blocks = [...line().children].map((c) => [c.className, c.textContent])
    expect(blocks).toEqual([
      ['st', 'Connexion en cours (www.figma.com)·'],
      ['act', 'Rouvrir la page·'],
      ['act', 'Annuler']
    ])
  })

  it('actions : se connecter, rouvrir, annuler (et l’état relu après chaque action)', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    await open()
    const reads = mcp.authStates.mock.calls.length
    await click(screen.getByTestId('mcp-auth-connect'))
    expect(mcp.connect).toHaveBeenCalledWith('opencode', 'figma')
    expect(mcp.authStates.mock.calls.length).toBe(reads + 1)
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await act(async () => emit(state('connecting', { host: 'www.figma.com' })))
    expect(text()).toBe('Connexion en cours (www.figma.com)')
    await click(screen.getByTestId('mcp-auth-reopen'))
    expect(mcp.reopenPage).toHaveBeenCalledWith('opencode', 'figma')
    await click(screen.getByTestId('mcp-auth-cancel'))
    expect(mcp.cancelConnect).toHaveBeenCalledWith('opencode', 'figma')
  })

  it('événement `mcp:authState` : la ligne change sans recharger ; un autre agent n’y touche pas', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    await open()
    const reads = mcp.authStates.mock.calls.length
    await act(async () => emit(state('connected')))
    expect(text()).toBe('Connecté par OpenCode')
    await act(async () => emit({ ...state('to-connect'), profileId: 'bob' }))
    expect(text()).toBe('Connecté par OpenCode')
    expect(mcp.authStates.mock.calls.length).toBe(reads)
    expect(within(row('figma')).getByTestId('mcp-dot').dataset['state']).toBe('ok')
  })

  it('relecture plus ancienne qu’un événement : l’événement l’emporte', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    let release: (view: McpAuthView) => void = () => {}
    await open()
    mcp.authStates.mockImplementationOnce(
      () => new Promise<McpAuthView>((resolve) => (release = resolve))
    )
    await click(screen.getByTestId('mcp-auth-connect'))
    await act(async () => emit(state('connecting', { host: 'www.figma.com' })))
    await act(async () =>
      release({
        profileId: 'opencode',
        workspace: '/projets/demo',
        agentFound: true,
        servers: [state('to-connect')],
        terminal: {}
      })
    )
    expect(text()).toBe('Connexion en cours (www.figma.com)')
  })

  it('une connexion en cours : les autres « Se connecter » grisés avec la raison (fiche 287)', async () => {
    const mcp = setup({
      views: [opencode([figma(), figma({ name: 'figma-2', scope: 'project' })])],
      states: [
        state('connecting', { host: 'www.figma.com' }),
        state('to-connect', { name: 'figma-2' })
      ]
    })
    await open()
    const other = within(row('figma-2')).getByTestId('mcp-auth-connect')
    expect(other.getAttribute('aria-disabled')).toBe('true')
    expect(other.getAttribute('aria-description')).toBe('Une connexion est déjà en cours.')
    expect(other.tabIndex).not.toBe(-1)
    await click(other)
    expect(mcp.connect).not.toHaveBeenCalled()
  })

  it.each([
    [{ started: false, reason: 'busy' } as const, 'Une connexion est déjà en cours.'],
    [
      { started: false, reason: 'disabled' } as const,
      'Serveur désactivé : activez-le pour vous connecter.'
    ],
    [
      { started: false, reason: 'not-offered' } as const,
      'OpenCode ne sait pas connecter ce serveur.'
    ]
  ])(
    'refus du main à « Se connecter » (%o) : dit dans la ligne, actions gardées',
    async (result, said) => {
      setup({ views: [opencode([figma()])], states: [state('to-connect')], connect: result })
      await open()
      await click(screen.getByTestId('mcp-auth-connect'))
      expect(text()).toBe(said)
      expect(line().className).toContain('err')
      expect(links()).toEqual(['Se connecter'])
      // Un nouvel état efface la note.
      await act(async () => emit(state('expired')))
      expect(text()).toBe('Connexion expirée')
    }
  )

  it.each([
    [{ done: true } as const, 'Connecté par OpenCode'],
    [{ done: false, reason: 'timeout' } as const, 'Pas de réponse de OpenCode pour la déconnexion'],
    [
      { done: false, reason: 'failed' } as const,
      'Déconnexion impossible : OpenCode n’a pas pu être lancé'
    ],
    [{ done: false, reason: 'still-connected' } as const, 'Toujours connecté selon OpenCode'],
    [{ done: false, reason: 'unconfirmed' } as const, 'Déconnexion non confirmée : état illisible'],
    [{ done: false, reason: 'busy' } as const, 'Une connexion est déjà en cours.']
  ])('se déconnecter, confirmé dans la ligne ; résultat %o', async (result, said) => {
    const mcp = setup({
      views: [opencode([figma()])],
      states: [state('connected')],
      disconnect: result
    })
    await open()
    const link = screen.getByTestId('mcp-auth-disconnect')
    await click(link)
    expect(link.getAttribute('aria-expanded')).toBe('true')
    const confirm = within(row('figma')).getByTestId('confirm-row')
    expect(nbsp(confirm.textContent ?? '')).toContain(
      'Se déconnecter de Figma ? OpenCode oubliera l’accès ; il faudra vous reconnecter.'
    )
    expect(mcp.disconnect).not.toHaveBeenCalled()
    await click(within(confirm).getByTestId('confirm-row-confirm'))
    expect(mcp.disconnect).toHaveBeenCalledWith('opencode', 'figma')
    expect(within(row('figma')).queryByTestId('confirm-row')).toBeNull()
    expect(text()).toBe(said.replace('de OpenCode', 'd’OpenCode'))
  })

  it('« Dans un terminal » copie la commande, puis « Copiée : … · Réessayer ici »', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('no-page')] })
    await open()
    const terminal = screen.getByTestId('mcp-auth-terminal')
    expect(
      nbsp(
        terminal.getAttribute('aria-description') ??
          terminal.closest('[title]')?.getAttribute('title') ??
          ''
      )
    ).toBeTruthy()
    await click(terminal)
    expect(clipboard.writeText).toHaveBeenCalledWith('opencode mcp auth figma')
    expect(text()).toBe('Copiée : opencode mcp auth figma')
    expect(line().querySelector('code')?.textContent).toBe('opencode mcp auth figma')
    expect(links()).toEqual(['Réessayer ici'])
    await click(screen.getByTestId('mcp-auth-retryHere'))
    expect(mcp.connect).toHaveBeenCalledWith('opencode', 'figma')
  })

  it.each([
    // macOS, Linux : une seule ligne.
    ["cd -- '/projets/l'\\''atelier' && opencode mcp auth figma", 'Copiée : '],
    // Windows (PowerShell) : deux lignes, dit.
    [
      "Set-Location -LiteralPath 'C:\\projets\\l''atelier'\nopencode mcp auth figma",
      'Copiée (2 lignes) : '
    ]
  ])(
    'commande copiée %j : ce qui est montré et au survol est exactement ce qui est copié',
    async (command, prefix) => {
      setup({ views: [opencode([figma({ scope: 'project' })])], states: [state('no-page')] })
      window.api.mcp.authStates = vi.fn(async () => ({
        profileId: 'opencode',
        workspace: '/projets/demo',
        agentFound: true,
        servers: [state('no-page')],
        terminal: { figma: command }
      }))
      await open()
      await click(screen.getByTestId('mcp-auth-terminal'))
      expect(clipboard.writeText).toHaveBeenCalledWith(command)
      const copied = clipboard.writeText.mock.calls.at(-1)?.[0]
      const code = within(line()).getByTestId('mcp-auth-copied')
      expect(code.textContent).toBe(copied)
      expect(code.title).toBe(copied)
      expect(text()).toBe(nbsp(`${prefix}${copied}`))
    }
  )

  it('serveur désactivé : dit, rien à lancer ; connecté : la déconnexion reste possible', async () => {
    setup({ views: [opencode([figma({ enabled: false })])], states: [state('to-connect')] })
    const { unmount } = await open()
    expect(text()).toBe('Serveur désactivé : activez-le pour vous connecter.')
    expect(links()).toEqual([])
    expect(within(row('figma')).getByTestId('mcp-dot').dataset['state']).toBe('off')
    unmount()
    setup({ views: [opencode([figma({ enabled: false })])], states: [state('connected')] })
    await open()
    expect(links()).toEqual(['Se déconnecter'])
  })

  it('supprimer un serveur connecté : la confirmation dit que l’agent garde l’accès', async () => {
    setup({ views: [opencode([figma()])], states: [state('connected')] })
    await open()
    await click(within(row('figma')).getByTestId('mcp-remove'))
    expect(nbsp(within(row('figma')).getByTestId('confirm-row').textContent ?? '')).toContain(
      'Supprimer le serveur « figma » ? OpenCode garde l’accès tant que vous ne vous déconnectez pas.'
    )
  })

  it('changement de dossier : rien de l’ancien état montré, l’état est relu', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('connected')] })
    const { rerender } = await open()
    expect(text()).toBe('Connecté par OpenCode')
    const pending: ((view: McpAuthView) => void)[] = []
    mcp.authStates.mockImplementation(
      () => new Promise<McpAuthView>((resolve) => pending.push(resolve))
    )
    world.views = [opencode([figma({ scope: 'project', file: '/autre/opencode.json' })])]
    await act(async () => {
      rerender(<McpSettings workspace="/projets/autre" initialTab="opencode" />)
    })
    expect(within(row('figma')).queryByTestId('mcp-auth')).toBeNull()
    expect(pending.length).toBeGreaterThan(0)
    await act(async () => {
      for (const resolve of pending)
        resolve({
          profileId: 'opencode',
          workspace: '/projets/demo',
          agentFound: true,
          servers: [state('to-connect')],
          terminal: {}
        })
    })
    expect(text()).toBe('À connecter')
  })

  it('relecture impossible (IPC) : « état inconnu » avec la raison, jamais un état deviné', async () => {
    const mcp = setup({ views: [opencode([figma()])] })
    mcp.authStates.mockRejectedValue(new Error('main indisponible'))
    await open()
    expect(text()).toBe('État de la connexion inconnu')
    expect(line().title).toContain('main indisponible')
  })

  it('au clavier : chaque action est un bouton atteignable par Tab, nommé par son texte', async () => {
    setup({
      views: [opencode([figma()])],
      states: [state('connecting', { host: 'www.figma.com' })]
    })
    await open()
    for (const name of ['Rouvrir la page', 'Annuler']) {
      const button = screen.getByRole('button', { name })
      button.focus()
      expect(document.activeElement).toBe(button)
      expect(button.getAttribute('type')).toBe('button')
    }
  })
})

describe('relecture adverse du lot 2 : clics, focus, notes, relecture', () => {
  it('focus : l’utilisateur est allé ailleurs pendant l’action, il n’est pas repris', async () => {
    setup({ views: [opencode([recherche, figma()])], states: [state('to-connect')] })
    await open()
    const button = screen.getByTestId('mcp-auth-connect')
    button.focus()
    await click(button)
    const elsewhere = within(row('recherche')).getByTestId('mcp-edit')
    elsewhere.focus()
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await act(async () => emit(state('connecting', { host: 'www.figma.com' })))
    expect(document.activeElement).toBe(elsewhere)
    // …ni plus tard, à un autre changement de la ligne.
    await act(async () => emit(state('to-connect')))
    expect(document.activeElement).toBe(elsewhere)
  })

  it('focus : après « Connecter Figma », il va à la ligne du serveur ajouté', async () => {
    setup()
    await open()
    const button = screen.getByTestId('mcp-preset-connect')
    button.focus()
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await click(button)
    await act(async () => {})
    expect(document.activeElement).toBe(screen.getByTestId('mcp-auth-reopen'))
  })

  it('double clic pendant que la première demande est en vol : une seule demande au main', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    let release: (result: McpConnectResult) => void = () => {}
    mcp.connect.mockImplementation(
      () => new Promise<McpConnectResult>((resolve) => (release = resolve))
    )
    await open()
    const button = screen.getByTestId('mcp-auth-connect')
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(mcp.connect).toHaveBeenCalledTimes(1)
    await act(async () => release({ started: true }))
    expect(line().className).not.toContain('err')
  })

  it('« Annuler » pendant que « Se connecter » attend encore le main : envoyé (garde par action)', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    mcp.connect.mockImplementation(() => new Promise<McpConnectResult>(() => {}))
    await open()
    await click(screen.getByTestId('mcp-auth-connect'))
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await act(async () => emit(state('connecting', { host: 'www.figma.com' })))
    const cancel = screen.getByTestId('mcp-auth-cancel')
    await act(async () => {
      fireEvent.click(cancel)
      fireEvent.click(cancel)
    })
    // Le double clic sur « Annuler » reste une seule demande.
    expect(mcp.cancelConnect).toHaveBeenCalledTimes(1)
  })

  it('une demande sans réponse ne garde pas son bouton pour toujours (borne)', async () => {
    vi.useFakeTimers()
    try {
      const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
      mcp.connect.mockImplementation(() => new Promise<McpConnectResult>(() => {}))
      render(<McpSettings workspace="/projets/demo" initialTab="opencode" />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      fireEvent.click(screen.getByTestId('mcp-auth-connect'))
      fireEvent.click(screen.getByTestId('mcp-auth-connect'))
      expect(mcp.connect).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(MCP_ACTION_GUARD_MS - 1)
      })
      fireEvent.click(screen.getByTestId('mcp-auth-connect'))
      expect(mcp.connect).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      fireEvent.click(screen.getByTestId('mcp-auth-connect'))
      expect(mcp.connect).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('M3 dans l’onglet : une relecture faite pour un autre dossier (menu d’une autre conversation) ne change pas ce qui est montré', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('connected')] })
    await open()
    expect(text()).toBe('Connecté par OpenCode')
    mcp.authStates.mockImplementationOnce(async (profileId: string) => ({
      profileId,
      workspace: '/projets/autre',
      agentFound: true,
      servers: [state('to-connect')],
      terminal: {}
    }))
    await act(async () => {
      await readMcpAuth('opencode')
    })
    expect(text()).toBe('Connecté par OpenCode')
  })

  it('« busy » alors que ce serveur est déjà « en cours » (autre fenêtre) : pas de note rouge', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('to-connect')] })
    await open()
    mcp.connect.mockImplementation(async () => {
      emit(state('connecting', { host: 'www.figma.com' }))
      return { started: false, reason: 'busy' }
    })
    world.states = [state('connecting', { host: 'www.figma.com' })]
    await click(screen.getByTestId('mcp-auth-connect'))
    expect(text()).toBe('Connexion en cours (www.figma.com)')
    expect(line().className).not.toContain('err')
  })

  it('une nouvelle action efface la note de la précédente, même si l’état n’a pas changé', async () => {
    const mcp = setup({
      views: [opencode([figma()])],
      states: [state('to-connect')],
      connect: { started: false, reason: 'not-offered' }
    })
    await open()
    await click(screen.getByTestId('mcp-auth-connect'))
    expect(text()).toBe('OpenCode ne sait pas connecter ce serveur.')
    mcp.connect.mockResolvedValue({ started: true })
    await click(screen.getByTestId('mcp-auth-connect'))
    expect(text()).toBe('À connecter')
  })

  it('une note ne survit pas à un changement de dossier (même état)', async () => {
    setup({
      views: [opencode([figma()])],
      states: [state('to-connect')],
      connect: { started: false, reason: 'not-offered' }
    })
    const { rerender } = await open()
    await click(screen.getByTestId('mcp-auth-connect'))
    expect(text()).toBe('OpenCode ne sait pas connecter ce serveur.')
    await act(async () => {
      rerender(<McpSettings workspace="/projets/autre" initialTab="opencode" />)
    })
    await act(async () => {})
    expect(text()).toBe('À connecter')
  })

  it('presse-papiers refusé : « Copie impossible », rien de prétendu copié', async () => {
    setup({ views: [opencode([figma()])], states: [state('no-page')] })
    clipboard.writeText.mockRejectedValueOnce(new Error('refusé'))
    await open()
    await click(screen.getByTestId('mcp-auth-terminal'))
    expect(text()).toBe('Copie impossible')
    expect(line().querySelector('code')).toBeNull()
  })

  it('« Copiée » puis connexion faite dans le terminal : relue au retour dans la fenêtre', async () => {
    const mcp = setup({ views: [opencode([figma()])], states: [state('no-page')] })
    await open()
    await click(screen.getByTestId('mcp-auth-terminal'))
    expect(text()).toBe('Copiée : opencode mcp auth figma')
    const reads = mcp.authStates.mock.calls.length
    world.states = [state('connected')]
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(mcp.authStates.mock.calls.length).toBe(reads + 1)
    expect(text()).toBe('Connecté par OpenCode')
  })

  it('carte « Figma » pendant une connexion : bouton grisé, raison au survol et au focus', async () => {
    setup({
      views: [
        opencode([
          figma({
            name: 'autre',
            scope: 'project',
            url: 'https://x.test/mcp',
            authPreset: undefined
          })
        ])
      ],
      states: []
    })
    await open()
    await act(async () =>
      emit({ profileId: 'opencode', name: 'autre', status: 'connecting', host: 'h' })
    )
    const button = screen.getByTestId('mcp-preset-connect')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('aria-description')).toBe('Une connexion est déjà en cours.')
  })

  it('onglet de l’agent qui a la capacité : pas de ligne d’aide', async () => {
    setup()
    await open()
    expect(screen.queryByTestId('mcp-preset-help')).toBeNull()
  })

  it('« Tout tester » ne teste jamais un serveur connecté par l’agent', async () => {
    const mcp = setup({ views: [opencode([recherche, figma()])], states: [state('to-connect')] })
    await open()
    mcp.test.mockClear()
    await click(screen.getByTestId('mcp-test-all'))
    await act(async () => {})
    expect(mcp.test.mock.calls.map((c: unknown[]) => c[2])).toEqual(['recherche'])
  })
})

describe('onglet d’un agent sans la capacité (fiche 293, Q3)', () => {
  it('ligne d’aide d’après les profils, lien vers la liste ouvert par le main ; aucun bouton', async () => {
    const mcp = setup()
    await open('bob')
    const help = screen.getByTestId('mcp-preset-help')
    expect(nbsp(help.textContent ?? '')).toBe(
      'Figma : pas proposé pour IBM Bob. Figma n’accepte que les applications de sa liste ; Bobine ne sait le connecter que par OpenCode. Liste de Figma'
    )
    expect(screen.queryByTestId('mcp-preset')).toBeNull()
    await click(within(help).getByTestId('mcp-preset-list'))
    expect(mcp.openPresetList).toHaveBeenCalledWith('figma')
    expect(document.body.innerHTML).not.toContain('developers.figma.com')
    expect(mcp.authStates).not.toHaveBeenCalled()
  })

  it('aucun agent n’a la capacité : rien', async () => {
    setup({ views: [bob] })
    await open('bob')
    expect(screen.queryByTestId('mcp-preset-help')).toBeNull()
  })
})

describe('vocabulaire de marque (fiche 293)', () => {
  it('jamais « partenaire », « certifié », « recommandé par », « intégration officielle »', async () => {
    const fr = (await import('@shared/i18n/locales/fr.json')).default as { mcp: unknown }
    const en = (await import('@shared/i18n/locales/en.json')).default as { mcp: unknown }
    const texts = JSON.stringify([fr.mcp, en.mcp]).toLowerCase()
    for (const word of [
      'partenaire',
      'certifi',
      'recommandé par',
      'intégration officielle',
      'partner',
      'endorse',
      'recommended by',
      'official integration'
    ]) {
      expect(texts, word).not.toContain(word)
    }
  })
})
