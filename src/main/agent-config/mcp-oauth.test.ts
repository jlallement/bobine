import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState, McpServerEntry } from '@shared/mcp'
import { log } from '../log'
import { resolveProfiles } from '../agent/profiles'
import { terminalCommand } from './mcp-oauth-command'
import { McpOAuth, attemptOutcome } from './mcp-oauth'

const FIXTURES = join(__dirname, 'fixtures', 'opencode-2.3.0-mcp-auth')
const SUCCESS = readFileSync(join(FIXTURES, 'sortie-reussie.txt'))
const FIXTURE_PREFIX = 'https://www.figma.com/oauth/mcp?response_type=code&client_id=FAKECLIENTID'
/** Adresse écrite par les essais : avec le retour local que le préréglage de Figma exige. */
const PAGE_PREFIX = `${FIXTURE_PREFIX}&redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback`
const CONNECTED = JSON.stringify([
  {
    id: 'mcp_abc',
    name: 'figma',
    connections: [{ type: 'credential', id: 'cred_1', label: 'x', method: 'oauth' }]
  }
])
const SECRETS = ['state=', 'code_challenge', 'client_id', 'FAKESTATE', 'FAKECHALLENGE']

/** Processus factice : sorties et fin émises à la demande, de façon synchrone. */
class FakeChild extends EventEmitter {
  readonly stdout = new EventEmitter()
  readonly stderr = new EventEmitter()
  readonly stdin = new EventEmitter()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  readonly args: readonly string[]
  readonly options: SpawnOptions

  constructor(args: readonly string[], options: SpawnOptions) {
    super()
    this.args = args
    this.options = options
  }

  write(data: Buffer | string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    this[stream].emit('data', typeof data === 'string' ? Buffer.from(data) : data)
  }

  /** Fin du processus : `exit` puis, sauf `holdOutput`, `close` (sorties fermées). */
  end(code: number | null, signal: NodeJS.Signals | null = null, holdOutput = false): void {
    if (this.exitCode !== null || this.signalCode !== null) return
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
    if (!holdOutput) this.emit('close', code, signal)
  }
}

const profiles = resolveProfiles({
  appPath: '/app',
  execPath: '/electron',
  isPackaged: false,
  env: {}
})

const figma = (overrides: Partial<McpServerEntry> = {}): McpServerEntry => ({
  name: 'figma',
  transport: 'http',
  url: 'https://mcp.figma.com/mcp',
  enabled: true,
  scope: 'global',
  file: '/config/opencode.json',
  ...overrides
})

interface SetupOptions {
  agentFound?: boolean
  servers?: McpServerEntry[]
  /** Sortie de `auth list` (fausse commande), modifiable en cours d'essai. */
  authList?: string
}

function setup(options: SetupOptions = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'mcp-oauth-ws-'))
  const states: McpAuthState[] = []
  const opened: string[] = []
  const attempts: FakeChild[] = []
  const commands: FakeChild[] = []
  const world = { authList: options.authList ?? '[]', agentFound: options.agentFound ?? true }
  const servers = options.servers ?? [figma()]
  const start = vi.fn((command: string, args: readonly string[], opts: SpawnOptions) => {
    const child = new FakeChild(args, opts)
    if (args.includes('auth') && args.includes('list')) {
      commands.push(child)
      const output = world.authList
      queueMicrotask(() => {
        child.write(output)
        child.end(0)
      })
    } else if (args.includes('logout')) {
      commands.push(child)
      queueMicrotask(() => child.end(0))
    } else {
      attempts.push(child)
    }
    return child as unknown as ChildProcess
  })
  // `killTree` simulé : l'arbre s'arrête au tour suivant (comme R6 : « Cancelled », puis fin).
  const stop = vi.fn((child: ChildProcess) => {
    const fake = child as unknown as FakeChild
    queueMicrotask(() => fake.end(null, 'SIGTERM'))
  })
  const engine = new McpOAuth({
    profiles: () => profiles,
    servers: () => servers,
    fallbackCwd: tmpdir(),
    env: async () => ({ PATH: '/opt/agents/bin', BOBINE_TEST_MARK: 'oui' }),
    findCommand: (command) => (world.agentFound ? `/opt/agents/bin/${command}` : undefined),
    openExternal: (url) => {
      opened.push(url)
    },
    onState: (state) => states.push(state),
    start,
    stop,
    limits: { attemptMs: 600_000, noPageMs: 30_000, commandMs: 30_000, exitWaitMs: 5_000 }
  })
  const attempt = () => {
    const child = attempts.at(-1)
    if (!child) throw new Error('aucune tentative lancée')
    return child
  }
  const last = () => states.at(-1)
  /** Arrêts de l'arbre de la tentative (ceux des commandes courtes à part). */
  const attemptStops = () => stop.mock.calls.filter(([c]) => attempts.includes(c as never)).length
  return {
    engine,
    workspace,
    states,
    opened,
    attempts,
    commands,
    world,
    start,
    stop,
    attempt,
    last,
    attemptStops
  }
}

/** Laisse passer les promesses et les microtâches en attente (horloge simulée). */
const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('connexion d’un serveur MCP par l’agent : moteur (fiche 293, ADR-0077)', () => {
  it('réussite relevée : commande de l’agent dans le dossier, page ouverte une fois, état relu', async () => {
    const t = setup()
    expect(await t.engine.connect('opencode', 'figma', t.workspace)).toEqual({ started: true })
    const child = t.attempt()
    expect(t.start.mock.calls[0]?.[0]).toBe('opencode')
    expect(child.args).toEqual(['mcp', 'auth', 'figma', '--standalone'])
    expect(child.options.cwd).toBe(t.workspace)
    expect(child.options.env).toMatchObject({ BOBINE_TEST_MARK: 'oui' })
    expect(t.last()).toEqual({
      profileId: 'opencode',
      name: 'figma',
      status: 'connecting',
      host: 'www.figma.com'
    })
    // Sortie relevée, en morceaux de 50 octets.
    for (let i = 0; i < SUCCESS.length; i += 50) child.write(SUCCESS.subarray(i, i + 50))
    expect(t.opened).toHaveLength(1)
    expect(t.opened[0]?.startsWith(FIXTURE_PREFIX)).toBe(true)
    t.world.authList = CONNECTED
    child.end(0)
    await flush()
    expect(t.last()).toEqual({ profileId: 'opencode', name: 'figma', status: 'connected' })
    // L'état vient de `auth list`, lancé lui aussi avec `--standalone` dans le même dossier.
    expect(t.commands[0]?.args).toEqual(['auth', 'list', '--format', 'json', '--standalone'])
    expect(t.commands[0]?.options.cwd).toBe(t.workspace)
    // Fin naturelle : l'arbre est arrêté quand même (petits-enfants restés), une seule fois.
    expect(t.stop.mock.calls.filter(([c]) => c === (child as unknown))).toHaveLength(1)
  })

  it('fin jugée à l’état relu, jamais au code : « Connected » puis code 1, mais relu connecté', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(SUCCESS)
    t.world.authList = CONNECTED
    t.attempt().end(1)
    await flush()
    expect(t.last()?.status).toBe('connected')
  })

  it('« Connected to » sans connexion relue : erreur, pas « connecté »', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(SUCCESS)
    t.attempt().end(0)
    await flush()
    expect(t.last()).toMatchObject({ status: 'error', reason: 'failed' })
  })

  it('expiration relevée : « Authorization expired », « Failed », code 0 → pas de réponse', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`●  ${PAGE_PREFIX}&state=S\n`)
    t.attempt().write('■  Authorization expired\n└  Failed\n')
    t.attempt().end(0)
    await flush()
    expect(t.last()).toEqual({
      profileId: 'opencode',
      name: 'figma',
      status: 'error',
      reason: 'timeout'
    })
  })

  it('fin non reconnue après l’adresse : « s’est arrêté » ; « Failed » seul : « n’a pas abouti »', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n`)
    t.attempt().end(0)
    await flush()
    expect(t.last()).toMatchObject({ status: 'error', reason: 'stopped' })
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n└  Failed\n`)
    t.attempt().end(0)
    await flush()
    expect(t.last()).toMatchObject({ status: 'error', reason: 'failed' })
  })

  it('fin sans adresse (commande inconnue d’une autre version) : « pas de page de connexion »', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write('error: unknown command "auth"\n', 'stderr')
    t.attempt().end(1)
    await flush()
    expect(t.last()).toMatchObject({ status: 'no-page' })
    expect(t.opened).toEqual([])
  })

  it('adresse lue sur la sortie d’erreur aussi, et adresse arrivée en plusieurs morceaux', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    const line = `●  ${PAGE_PREFIX}&state=S\n`
    for (const piece of [line.slice(0, 12), line.slice(12, 40), line.slice(40)]) {
      t.attempt().write(piece, 'stderr')
      expect(t.opened).toHaveLength(piece === line.slice(40) ? 1 : 0)
    }
    expect(t.opened).toEqual([`${PAGE_PREFIX}&state=S`])
  })

  it.each([
    ['suffixe', 'https://www.figma.com.evil.tld/oauth/mcp?state=S', 'www.figma.com.evil.tld'],
    ['hôte en requête', 'https://evil.tld/?x=www.figma.com', 'evil.tld'],
    ['http', 'http://www.figma.com/oauth/mcp?state=S', 'www.figma.com'],
    ['identifiants', 'https://user@www.figma.com@evil.tld/', 'evil.tld'],
    ['IDN', 'https://www.fіgma.com/oauth', 'www.xn--fgma-l9d.com']
  ])(
    'page inattendue (%s) : rien d’ouvert, arbre arrêté, erreur avec le seul hôte',
    async (_label, url, host) => {
      const t = setup()
      await t.engine.connect('opencode', 'figma', t.workspace)
      t.attempt().write(`●  ${url}\n`)
      expect(t.opened).toEqual([])
      expect(t.stop).toHaveBeenCalledTimes(1)
      await flush()
      expect(t.last()).toEqual({
        profileId: 'opencode',
        name: 'figma',
        status: 'error',
        reason: 'unexpected-page',
        host
      })
    }
  )

  it('deux adresses : la première décide (ouverte une fois, la seconde ignorée)', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\nhttps://evil.tld/autre\n${PAGE_PREFIX}&state=T\n`)
    expect(t.opened).toEqual([`${PAGE_PREFIX}&state=S`])
    expect(t.stop).not.toHaveBeenCalled()
    // Première refusée : rien d'ouvert, même si une bonne adresse suit.
    const u = setup()
    await u.engine.connect('opencode', 'figma', u.workspace)
    u.attempt().write(`https://evil.tld/\n${PAGE_PREFIX}&state=S\n`)
    expect(u.opened).toEqual([])
    expect(u.stop).toHaveBeenCalledTimes(1)
  })

  it('« Annuler » : arbre arrêté une fois, état relu (à connecter), pas de fin de tentative gardée', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n`)
    expect(t.engine.cancel('opencode', 'autre')).toBe(false)
    expect(t.engine.cancel('opencode', 'figma')).toBe(true)
    expect(t.engine.cancel('opencode', 'figma')).toBe(true) // déjà en fin : sans effet
    await flush()
    expect(t.attemptStops()).toBe(1)
    expect(t.last()).toEqual({ profileId: 'opencode', name: 'figma', status: 'to-connect' })
    // La sortie de fin (« Cancelled ») arrive après : ignorée, aucun autre état.
    const count = t.states.length
    t.attempt().write('└  Cancelled\n')
    await flush()
    expect(t.states).toHaveLength(count)
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('to-connect')
  })

  it('délai de 10 min (horloge simulée) : rien à 9 min 59, puis arbre arrêté et « pas de réponse »', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n`)
    await vi.advanceTimersByTimeAsync(599_000)
    expect(t.stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(t.attemptStops()).toBe(1)
    await flush()
    expect(t.last()).toMatchObject({ status: 'error', reason: 'timeout' })
  })

  it('aucune adresse en 30 s : arbre arrêté, « pas de page de connexion »', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write('◇  Starting authorization...\n')
    await vi.advanceTimersByTimeAsync(29_999)
    expect(t.stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(t.attemptStops()).toBe(1)
    expect(t.last()).toMatchObject({ status: 'no-page' })
  })

  it('sortie gardée ouverte par un petit-enfant : jugée au plus 5 s après la fin du processus', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n■  Authorization expired\n`)
    t.attempt().end(0, null, true)
    await vi.advanceTimersByTimeAsync(4_999)
    expect(t.last()?.status).toBe('connecting')
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(t.last()).toMatchObject({ status: 'error', reason: 'timeout' })
  })

  it.each([
    ['annuler, délai, fin', ['cancel', 'timeout', 'exit']],
    ['fin, annuler, délai', ['exit', 'cancel', 'timeout']],
    ['délai, fin, annuler', ['timeout', 'exit', 'cancel']],
    ['fermeture, fin, annuler', ['quit', 'exit', 'cancel']]
  ])('fins en course (%s) : une seule traitée, arbre arrêté une fois', async (_label, order) => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n`)
    const before = t.states.length
    for (const step of order) {
      if (step === 'cancel') t.engine.cancel('opencode', 'figma')
      if (step === 'timeout') vi.advanceTimersByTime(600_000)
      if (step === 'exit') t.attempt().end(0)
      if (step === 'quit') t.engine.stop()
    }
    await flush()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(t.attemptStops()).toBe(1)
    expect(t.states.length - before).toBe(order[0] === 'quit' ? 0 : 1)
  })

  it('une seule connexion à la fois : refus côté main, même pour deux clics simultanés', async () => {
    const t = setup({ servers: [figma(), figma({ name: 'figma-2' })] })
    const [first, second] = await Promise.all([
      t.engine.connect('opencode', 'figma', t.workspace),
      t.engine.connect('opencode', 'figma-2', t.workspace)
    ])
    expect(first).toEqual({ started: true })
    expect(second).toEqual({ started: false, reason: 'busy' })
    expect(await t.engine.connect('opencode', 'figma', t.workspace)).toMatchObject({
      reason: 'busy'
    })
    expect(await t.engine.disconnect('opencode', 'figma-2', t.workspace)).toMatchObject({
      reason: 'busy'
    })
    expect(t.attempts).toHaveLength(1)
    // Fin de la première : la suivante part.
    t.engine.cancel('opencode', 'figma')
    await flush()
    expect(await t.engine.connect('opencode', 'figma-2', t.workspace)).toEqual({ started: true })
    expect(t.attempts).toHaveLength(2)
  })

  it('fermeture de l’app : arbre arrêté, plus rien de relu, d’émis ni de lancé', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write(`${PAGE_PREFIX}&state=S\n`)
    const emitted = t.states.length
    t.engine.stop()
    expect(t.stop).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.commands).toHaveLength(0)
    expect(t.states).toHaveLength(emitted)
    expect(await t.engine.connect('opencode', 'figma', t.workspace)).toMatchObject({
      reason: 'busy'
    })
    expect(t.engine.reopen('opencode', 'figma')).toBe(false)
  })

  it('« Rouvrir la page » : la même adresse vérifiée, seulement pendant la tentative', async () => {
    const t = setup()
    expect(t.engine.reopen('opencode', 'figma')).toBe(false)
    await t.engine.connect('opencode', 'figma', t.workspace)
    expect(t.engine.reopen('opencode', 'figma')).toBe(false) // pas encore d'adresse
    t.attempt().write(`${PAGE_PREFIX}&state=S\n`)
    expect(t.engine.reopen('opencode', 'figma')).toBe(true)
    expect(t.opened).toEqual([`${PAGE_PREFIX}&state=S`, `${PAGE_PREFIX}&state=S`])
    t.engine.cancel('opencode', 'figma')
    expect(t.engine.reopen('opencode', 'figma')).toBe(false)
  })

  it('« Dans un terminal » : commande de l’agent sans `--standalone`, une ligne `cd` d’abord si le serveur n’est déclaré que là', async () => {
    const both = setup({
      servers: [figma(), figma({ scope: 'project', file: '/p/opencode.json' })]
    })
    expect((await both.engine.view('opencode', both.workspace)).terminal).toEqual({
      figma: 'opencode mcp auth figma'
    })
    const here = setup({ servers: [figma({ scope: 'project', file: '/p/opencode.json' })] })
    const { terminal } = await here.engine.view('opencode', here.workspace)
    expect(terminal['figma']).toBe(
      terminalCommand(process.platform, ['opencode', 'mcp', 'auth', 'figma'], here.workspace)
    )
    expect(terminal['figma']?.split('\n')).toHaveLength(2)
    expect(terminal['figma']).not.toContain('&&')
  })

  it('agent absent : rien de lancé, état « agent absent » ; commande disparue au lancement aussi', async () => {
    const t = setup({ agentFound: false })
    expect(await t.engine.connect('opencode', 'figma', t.workspace)).toEqual({
      started: false,
      reason: 'agent-missing'
    })
    expect(t.start).not.toHaveBeenCalled()
    expect(t.last()?.status).toBe('agent-missing')
    expect(await t.engine.view('opencode', t.workspace)).toEqual({
      profileId: 'opencode',
      agentFound: false,
      servers: [{ profileId: 'opencode', name: 'figma', status: 'agent-missing' }],
      terminal: { figma: 'opencode mcp auth figma' }
    })
    const u = setup()
    await u.engine.connect('opencode', 'figma', u.workspace)
    u.attempt().emit('error', Object.assign(new Error('spawn opencode ENOENT'), { code: 'ENOENT' }))
    await flush()
    expect(u.last()?.status).toBe('agent-missing')
    expect(u.commands).toHaveLength(0)
    // Agent installé depuis : l'état relu reprend, plus d'« agent absent ».
    t.world.agentFound = true
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('to-connect')
  })

  it('agent sans la capacité (IBM Bob) : rien de proposé ni de lancé, même Figma déclaré', async () => {
    const t = setup()
    expect(await t.engine.connect('bob', 'figma', t.workspace)).toEqual({
      started: false,
      reason: 'not-offered'
    })
    expect(await t.engine.disconnect('bob', 'figma', t.workspace)).toMatchObject({
      reason: 'not-offered'
    })
    await expect(t.engine.view('bob', t.workspace)).rejects.toThrow('profileId')
    expect(t.engine.cancel('bob', 'figma')).toBe(false)
    expect(t.start).not.toHaveBeenCalled()
  })

  it('serveur non connectable : autre adresse, nom ambigu, nom qui serait une option', async () => {
    const other = setup({ servers: [figma({ url: 'https://mcp.example.test/mcp' })] })
    expect(await other.engine.connect('opencode', 'figma', other.workspace)).toMatchObject({
      reason: 'not-offered'
    })
    // Même nom déclaré deux fois avec deux adresses (R7 non relevé) : rien de deviné.
    const twice = setup({
      servers: [figma(), figma({ scope: 'project', url: 'https://mcp.example.test/mcp' })]
    })
    expect(await twice.engine.connect('opencode', 'figma', twice.workspace)).toMatchObject({
      reason: 'not-offered'
    })
    expect((await twice.engine.view('opencode', twice.workspace)).servers).toEqual([])
    const option = setup({ servers: [figma({ name: '--help' })] })
    expect(await option.engine.connect('opencode', '--help', option.workspace)).toMatchObject({
      reason: 'not-offered'
    })
    expect([other, twice, option].every((t) => t.start.mock.calls.length <= 1)).toBe(true)
    expect(other.attempts.length + twice.attempts.length + option.attempts.length).toBe(0)
  })

  it('état relu : connecté sans `status`, `needs_auth` facultatif, illisible = inconnu', async () => {
    const t = setup({ authList: CONNECTED })
    expect((await t.engine.view('opencode', t.workspace)).servers).toEqual([
      { profileId: 'opencode', name: 'figma', status: 'connected' }
    ])
    t.world.authList = JSON.stringify([
      {
        id: 'mcp_abc',
        name: 'figma',
        connections: [{ method: 'oauth', status: { status: 'needs_auth', message: 'm' } }]
      }
    ])
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('expired')
    t.world.authList = 'No authenticated integrations'
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('unknown')
    t.world.authList = '[]'
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('to-connect')
  })

  it('fin d’une tentative montrée jusqu’à une connexion relue (faite ailleurs, en terminal)', async () => {
    const t = setup()
    await t.engine.connect('opencode', 'figma', t.workspace)
    t.attempt().write('https://evil.tld/\n')
    await flush()
    expect((await t.engine.view('opencode', t.workspace)).servers[0]).toMatchObject({
      status: 'error',
      reason: 'unexpected-page',
      host: 'evil.tld'
    })
    t.world.authList = CONNECTED
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('connected')
    t.world.authList = '[]'
    expect((await t.engine.view('opencode', t.workspace)).servers[0]?.status).toBe('to-connect')
  })

  it('« Se déconnecter » : commande de l’agent avec `--standalone`, puis état relu', async () => {
    const t = setup({ authList: CONNECTED })
    t.world.authList = '[]'
    expect(await t.engine.disconnect('opencode', 'figma', t.workspace)).toEqual({ done: true })
    expect(t.commands[0]?.args).toEqual(['mcp', 'logout', 'figma', '--standalone'])
    expect(t.commands[1]?.args).toContain('list')
    expect(t.last()).toEqual({ profileId: 'opencode', name: 'figma', status: 'to-connect' })
  })

  it('commande d’état sans réponse : arrêtée au délai, état inconnu ; sortie énorme : illisible', async () => {
    const t = setup()
    t.start.mockImplementation((_c, args, opts) => {
      const child = new FakeChild(args, opts)
      t.commands.push(child)
      return child as unknown as ChildProcess
    })
    const view = t.engine.view('opencode', t.workspace)
    await vi.advanceTimersByTimeAsync(30_000)
    expect((await view).servers[0]?.status).toBe('unknown')
    expect(t.stop).toHaveBeenCalledTimes(1)
    const big = t.engine.view('opencode', t.workspace)
    await flush()
    t.commands.at(-1)?.write(Buffer.alloc(1024 * 1024 + 1, 0x20))
    await flush()
    expect((await big).servers[0]?.status).toBe('unknown')
    expect(t.stop).toHaveBeenCalledTimes(2)
  })

  it('jamais l’adresse complète au journal, dans les états ni dans les réponses', async () => {
    const logged: unknown[][] = []
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      vi.spyOn(log, level).mockImplementation((...args: unknown[]) => void logged.push(args))
    }
    const results: unknown[] = []
    const run = async (lines: string, end: () => void) => {
      const t = setup()
      results.push(await t.engine.connect('opencode', 'figma', t.workspace))
      t.attempt().write(lines)
      results.push(t.engine.reopen('opencode', 'figma'))
      end.call(t)
      t.attempt().end(0)
      await flush()
      results.push(await t.engine.view('opencode', t.workspace))
      return t
    }
    const outputs = [
      SUCCESS.toString('utf8'),
      'https://www.figma.com.evil.tld/oauth?state=FAKESTATE&client_id=FAKECLIENTID\n',
      `${PAGE_PREFIX}&state=FAKESTATE\nhttps://evil.tld/?code_challenge=FAKECHALLENGE\n`,
      'http://www.figma.com/oauth?code_challenge=FAKECHALLENGE&state=FAKESTATE\n'
    ]
    const all: McpAuthState[] = []
    for (const output of outputs) all.push(...(await run(output, () => {})).states)
    const everything = JSON.stringify({ logged, all, results })
    expect(logged.length).toBeGreaterThan(5)
    for (const secret of SECRETS) expect(everything, secret).not.toContain(secret)
    // Garde-fou de l'essai : la sortie contenait bien ces secrets.
    expect(SUCCESS.toString('utf8')).toContain('state=FAKESTATE')
  })
})

describe('issue d’une tentative (fiche 293)', () => {
  it('l’état relu « connecté » l’emporte ; sinon la fin dite, jamais le code de sortie', () => {
    expect(attemptOutcome({ kind: 'timeout' }, {}, true, 'connected')).toEqual({
      status: 'connected'
    })
    expect(attemptOutcome({ kind: 'cancel' }, {}, true, 'none')).toEqual({ status: 'to-connect' })
    expect(attemptOutcome({ kind: 'cancel' }, {}, true, undefined)).toEqual({ status: 'unknown' })
    expect(attemptOutcome({ kind: 'cancel' }, {}, true, 'expired')).toEqual({ status: 'expired' })
    expect(attemptOutcome({ kind: 'exit' }, { refused: true }, true, 'none')).toEqual({
      status: 'refused'
    })
    expect(attemptOutcome({ kind: 'spawn-failed', missing: false }, {}, false, 'none')).toEqual({
      status: 'error',
      reason: 'stopped'
    })
  })
})
