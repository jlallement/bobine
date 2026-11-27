/**
 * Moteur de connexion (fiche 293) : courses entre opérations, fin du processus, journal sans sortie,
 * déconnexion honnête, serveur désactivé (relecture du lot 1, points A à I). Faux processus, horloge
 * simulée ; `auth list` ne répond qu'à la demande.
 */
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState, McpServerEntry } from '@shared/mcp'
import { log } from '../log'
import { resolveProfiles } from '../agent/profiles'
import { McpOAuth } from './mcp-oauth'

const PAGE =
  'https://www.figma.com/oauth/mcp?response_type=code&client_id=FAKECLIENTID&redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=FAKESTATE&code_challenge=FAKECHALLENGE'
const CONNECTED = JSON.stringify([
  { id: 'mcp_abc', name: 'figma', connections: [{ method: 'oauth' }] }
])
const SECRETS = [
  'state=',
  'code_challenge',
  'client_id',
  'FAKESTATE',
  'FAKECHALLENGE',
  'FAKECLIENTID'
]

class FakeChild extends EventEmitter {
  readonly stdout = new EventEmitter()
  readonly stderr = new EventEmitter()
  readonly stdin = new EventEmitter()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  readonly args: readonly string[]

  constructor(args: readonly string[]) {
    super()
    this.args = args
  }

  write(data: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    this[stream].emit('data', Buffer.from(data))
  }

  end(code: number | null, signal: NodeJS.Signals | null = null, holdOutput = false): void {
    if (this.exitCode !== null || this.signalCode !== null) return
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
    if (!holdOutput) this.emit('close', code, signal)
  }
}

const profiles = resolveProfiles({ appPath: '/app', execPath: '/e', isPackaged: false, env: {} })
const figma = (overrides: Partial<McpServerEntry> = {}): McpServerEntry => ({
  name: 'figma',
  transport: 'http',
  url: 'https://mcp.figma.com/mcp',
  enabled: true,
  scope: 'global',
  file: '/config/opencode.json',
  ...overrides
})
const flush = () => vi.advanceTimersByTimeAsync(0)

interface WorldOptions {
  servers?: McpServerEntry[]
  /** Déconnexion : fin normale, jamais de réponse, commande introuvable, lancement impossible. */
  logout?: 'ok' | 'hang' | 'missing' | 'throw'
  /** Environnement fourni à la demande (`releaseEnv`). */
  heldEnv?: boolean
  /** L'environnement rejette (trousseau verrouillé) tant que la fonction rend vrai. */
  envFails?: () => boolean
  startError?: Error
  openError?: Error
}

function world(options: WorldOptions = {}) {
  const states: McpAuthState[] = []
  const opened: string[] = []
  const attempts: FakeChild[] = []
  const lists: FakeChild[] = []
  const logouts: FakeChild[] = []
  const logged: string[] = []
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    vi.spyOn(log, level).mockImplementation(
      (...args: unknown[]) => void logged.push(args.join(' '))
    )
  }
  const envWaiters: ((env: NodeJS.ProcessEnv) => void)[] = []
  const start = vi.fn((_c: string, args: readonly string[], _o: SpawnOptions) => {
    const child = new FakeChild(args)
    if (args.includes('list')) lists.push(child)
    else if (args.includes('logout')) {
      if (options.logout === 'throw') throw new Error('spawn EPERM https://x.test/?state=FAKESTATE')
      logouts.push(child)
      if (options.logout === 'missing') {
        queueMicrotask(() => child.emit('error', Object.assign(new Error('x'), { code: 'ENOENT' })))
      } else if (options.logout !== 'hang') queueMicrotask(() => child.end(0))
    } else {
      if (options.startError) throw options.startError
      attempts.push(child)
    }
    return child as unknown as ChildProcess
  })
  const stop = vi.fn((child: ChildProcess) => {
    const fake = child as unknown as FakeChild
    queueMicrotask(() => fake.end(null, 'SIGTERM'))
  })
  const engine = new McpOAuth({
    profiles: () => profiles,
    servers: () => options.servers ?? [figma()],
    fallbackCwd: tmpdir(),
    env: () =>
      options.envFails?.()
        ? Promise.reject(new Error('trousseau verrouillé'))
        : options.heldEnv
          ? new Promise<NodeJS.ProcessEnv>((resolve) => envWaiters.push(resolve))
          : Promise.resolve({ PATH: '/x' }),
    findCommand: (c) => `/x/${c}`,
    openExternal: (url) => {
      if (options.openError) return Promise.reject(options.openError)
      opened.push(url)
    },
    onState: (s) => states.push(s),
    start,
    stop,
    limits: { attemptMs: 600_000, noPageMs: 30_000, commandMs: 30_000, exitWaitMs: 5_000 }
  })
  const releaseList = (out = '[]', index = 0) => {
    const [child] = lists.splice(index, 1)
    if (!child) throw new Error('pas de auth list en attente')
    child.write(out)
    child.end(0)
  }
  const releaseEnv = () => {
    for (const resolve of envWaiters.splice(0)) resolve({ PATH: '/x' })
  }
  const attempt = () => {
    const child = attempts.at(-1)
    if (!child) throw new Error('aucune tentative')
    return child
  }
  const stopsOf = (child: FakeChild) =>
    stop.mock.calls.filter(([c]) => c === (child as unknown)).length
  return {
    engine,
    states,
    opened,
    attempts,
    lists,
    logouts,
    logged,
    start,
    stop,
    releaseList,
    releaseEnv,
    attempt,
    stopsOf,
    last: () => states.at(-1)
  }
}

const ws = tmpdir()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('A. une fin périmée n’émet rien et ne range rien', () => {
  it('déconnexion partie pendant la relecture d’une tentative annulée : seule elle compte', async () => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().write(`${PAGE}\n`)
    w.engine.cancel('opencode', 'figma')
    await flush()
    expect(w.lists).toHaveLength(1) // relecture de la tentative, sans réponse
    const disconnect = w.engine.disconnect('opencode', 'figma', ws)
    await flush()
    expect(await w.engine.connect('opencode', 'figma', ws)).toMatchObject({ reason: 'busy' })
    expect(w.lists).toHaveLength(2)
    w.releaseList('[]', 1) // relecture de la déconnexion
    expect(await disconnect).toEqual({ done: true })
    const count = w.states.length
    expect(w.last()).toEqual({ profileId: 'opencode', name: 'figma', status: 'to-connect' })
    w.releaseList(CONNECTED, 0) // relecture périmée de la tentative : rien
    await flush()
    expect(w.states).toHaveLength(count)
    // …et rien de rangé : la vue suivante relit l'agent, sans fin d'erreur gardée.
    const view = w.engine.view('opencode', ws)
    await flush()
    w.releaseList('[]')
    expect((await view).servers[0]?.status).toBe('to-connect')
  })

  it('connexion dont l’environnement échoue pendant la relecture d’une autre : état émis', async () => {
    let failEnv = false
    const w = world({ envFails: () => failEnv })
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().write(`${PAGE}\n`)
    w.engine.cancel('opencode', 'figma')
    await flush()
    expect(w.lists).toHaveLength(1)
    failEnv = true
    expect(await w.engine.connect('opencode', 'figma', ws)).toEqual({ started: true })
    await flush()
    failEnv = false
    w.releaseList('[]') // relecture périmée de la première tentative
    await flush()
    expect(w.last()).toMatchObject({ status: 'error', reason: 'stopped' })
    expect(w.logged.some((l) => l.includes('fin périmée (cancel)'))).toBe(true)
    expect(w.logged.filter((l) => /: fin \(cancel/.test(l))).toEqual([])
  })

  it('déconnexion dont l’environnement échoue, sans tentative avant : rien de réservé ni d’émis', async () => {
    const w = world({ envFails: () => true })
    await expect(w.engine.disconnect('opencode', 'figma', ws)).rejects.toThrow()
    expect(w.states).toEqual([])
    expect(w.start).not.toHaveBeenCalled()
    expect(await w.engine.disconnect('opencode', 'autre', ws)).toMatchObject({
      reason: 'not-offered'
    })
  })

  it('relecture qui ne répond jamais : bornée par le délai des commandes, état inconnu', async () => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().write(`${PAGE}\n`)
    w.engine.cancel('opencode', 'figma')
    await flush()
    const list = w.lists[0]
    if (!list) throw new Error('relecture attendue')
    await vi.advanceTimersByTimeAsync(29_999)
    expect(w.last()?.status).toBe('connecting')
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(w.stopsOf(list)).toBe(1)
    expect(w.last()).toEqual({ profileId: 'opencode', name: 'figma', status: 'unknown' })
  })

  it('fermeture de l’app pendant la relecture : commande arrêtée, rien d’émis après', async () => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().write('https://evil.tld/\n')
    await flush()
    const list = w.lists[0]
    if (!list) throw new Error('relecture attendue')
    const count = w.states.length
    w.engine.stop()
    expect(w.stopsOf(list)).toBe(1)
    await flush()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.states).toHaveLength(count)
    expect(w.start).toHaveBeenCalledTimes(2) // la tentative et sa relecture, rien d'autre
  })

  it('fermeture de l’app pendant la relecture d’une tentative annulée : rien d’émis', async () => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().write(`${PAGE}\n`)
    w.engine.cancel('opencode', 'figma')
    await flush()
    const count = w.states.length
    w.engine.stop()
    await flush()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(w.states).toHaveLength(count)
  })

  it('fermeture de l’app pendant une déconnexion : rien d’émis', async () => {
    const w = world()
    const disconnect = w.engine.disconnect('opencode', 'figma', ws)
    await flush()
    w.engine.stop()
    await flush()
    if (w.lists.length) w.releaseList('[]')
    await flush()
    await disconnect
    expect(w.states).toEqual([])
  })
})

describe('B. jamais d’adresse lue après la fin du processus', () => {
  it('adresse arrivée entre `exit` et `close` : pas ouverte', async () => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().end(0, null, true)
    w.attempt().write(`${PAGE}\n`)
    w.attempt().emit('close', 0, null)
    await flush()
    expect(w.opened).toEqual([])
  })

  it('« Annuler » pendant la lecture de l’environnement : aucun processus lancé (pas d’orphelin)', async () => {
    const w = world({ heldEnv: true })
    const connect = w.engine.connect('opencode', 'figma', ws)
    expect(w.engine.cancel('opencode', 'figma')).toBe(true)
    w.releaseEnv()
    await flush()
    w.releaseEnv()
    expect(await connect).toEqual({ started: true })
    await flush()
    expect(w.attempts).toHaveLength(0)
  })

  it('fermeture pendant la lecture de l’environnement : aucun processus lancé, rien d’émis', async () => {
    const w = world({ heldEnv: true })
    const connect = w.engine.connect('opencode', 'figma', ws)
    w.engine.stop()
    w.releaseEnv()
    await connect
    await flush()
    expect(w.start).not.toHaveBeenCalled()
    expect(w.states).toEqual([])
  })
})

describe('C. aucune ligne de sortie au journal', () => {
  it('processus bavard : un compteur, pas une ligne de journal par ligne de sortie', async () => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    for (let i = 0; i < 5_000; i++) w.attempt().write(`bruit ${i} state=FAKESTATE\n`)
    w.attempt().write(`${PAGE}\n└  Failed\n`)
    w.attempt().end(0)
    await flush()
    w.releaseList('[]')
    await flush()
    expect(w.logged.length).toBeLessThan(10)
    expect(w.logged.join('\n')).toContain('5000 ligne(s) non reconnue(s)')
  })

  it.each([
    ['sans schéma', 'www.figma.com/oauth/mcp?state=FAKESTATE'],
    ['schéma à une barre', 'https:/www.figma.com/oauth/mcp?state=FAKESTATE'],
    ['antislashs', 'https:\\\\www.figma.com\\oauth?state=FAKESTATE'],
    ['paramètre après une espace', 'Error: for https://www.figma.com/x client_id=FAKECLIENTID'],
    ['adresse coupée en deux lignes', `${PAGE.slice(0, 60)}\n│  ${PAGE.slice(60)}`],
    ['adresse refusée', 'https://evil.tld/oauth/mcp?state=FAKESTATE&code_challenge=FAKECHALLENGE']
  ])('sortie piégée (%s) : rien de secret au journal ni dans les états', async (_l, output) => {
    const w = world()
    await w.engine.connect('opencode', 'figma', ws)
    w.attempt().write(`${output}\n`, 'stderr')
    w.attempt().end(0)
    await flush()
    if (w.lists.length) w.releaseList('[]')
    await flush()
    const all = JSON.stringify({ logged: w.logged, states: w.states })
    for (const secret of SECRETS) expect(all, secret).not.toContain(secret)
  })

  it('messages d’erreur du système (lancement, ouverture de la page) : adresses masquées', async () => {
    const w = world({ startError: new Error(`spawn failed ${PAGE}`) })
    await w.engine.connect('opencode', 'figma', ws)
    await flush()
    const u = world({ openError: new Error(`cannot open ${PAGE} (state=FAKESTATE)`) })
    await u.engine.connect('opencode', 'figma', ws)
    u.attempt().write(`${PAGE}\n`)
    await flush()
    const all = [...w.logged, ...u.logged].join('\n')
    expect(all).toContain('page non ouverte')
    expect(all).toContain('lancement impossible')
    for (const secret of SECRETS) expect(all, secret).not.toContain(secret)
  })
})

describe('E. déconnexion : jamais dite faite sans l’état relu', () => {
  it.each([
    ['commande introuvable', { logout: 'missing' as const }, '[]', { reason: 'agent-missing' }],
    ['sans réponse', { logout: 'hang' as const }, '[]', { reason: 'timeout' }],
    ['lancement impossible', { logout: 'throw' as const }, '[]', { reason: 'failed' }],
    ['connexion toujours là', {}, CONNECTED, { reason: 'still-connected' }],
    ['état illisible', {}, 'pas du JSON', { reason: 'unconfirmed' }],
    ['faite', {}, '[]', { done: true }]
  ])('%s', async (_label, options, list, expected) => {
    const w = world(options)
    const result = w.engine.disconnect('opencode', 'figma', ws)
    await flush()
    if (!w.lists.length) await vi.advanceTimersByTimeAsync(30_000) // déconnexion sans réponse
    if (w.lists.length) w.releaseList(list)
    expect(await result).toMatchObject(expected)
    const said = w.logged.filter((l) => l.includes('déconnecté'))
    expect(said).toHaveLength('done' in expected ? 1 : 0)
    for (const secret of SECRETS) expect(w.logged.join('\n'), secret).not.toContain(secret)
  })
})

describe('I. serveur désactivé ou non distant', () => {
  it('désactivé : refus typé, rien de lancé ; déclaration en commande locale : pas proposé', async () => {
    const w = world({ servers: [figma({ enabled: false })] })
    expect(await w.engine.connect('opencode', 'figma', ws)).toEqual({
      started: false,
      reason: 'disabled'
    })
    const local = world({
      servers: [
        figma({ transport: 'stdio', command: 'figma-mcp', url: 'https://mcp.figma.com/mcp' })
      ]
    })
    expect(await local.engine.connect('opencode', 'figma', ws)).toMatchObject({
      reason: 'not-offered'
    })
    expect(w.start).not.toHaveBeenCalled()
    expect(local.start).not.toHaveBeenCalled()
  })
})
