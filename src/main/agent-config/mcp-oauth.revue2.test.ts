/**
 * Second passage du testeur adverse (fiche 293, sur `d5dac27b`), gardé comme essais permanents :
 * P1 (préfixe trop large pris pour celui de la page), P2 (déconnexion dont l'environnement échoue :
 * le renderer restait « en cours »), et son balayage de la règle D, ici avec les réponses attendues.
 * Assertions de P1 et P2 intactes ; imports remontés en tête.
 */
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState, McpServerEntry } from '@shared/mcp'
import { log } from '../log'
import { resolveProfiles } from '../agent/profiles'
import { McpOAuth } from './mcp-oauth'
import { checkPageUrl } from './mcp-oauth-output'
import { OPENCODE_MCP_AUTH } from './opencode-mcp-auth'

const PAGE_PREFIX = 'https://www.figma.com/oauth/mcp?response_type=code&client_id=FAKECLIENTID'

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
const PAGE = `${PAGE_PREFIX}&state=FAKESTATE&code_challenge=FAKECHALLENGE`
const flush = () => vi.advanceTimersByTimeAsync(0)
const first = (children: FakeChild[]): FakeChild => {
  const child = children[0]
  if (!child) throw new Error('aucune tentative lancée')
  return child
}

/** Monde contrôlé : `auth list` ne répond qu'à la demande (`releaseList`). */
const envFail = { on: false }
function world2(servers: McpServerEntry[] = [figma()], hangLogout = false) {
  const states: McpAuthState[] = []
  const opened: string[] = []
  const attempts: FakeChild[] = []
  const lists: FakeChild[] = []
  const logged: string[] = []
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    vi.spyOn(log, level).mockImplementation((m: string) => void logged.push(m))
  }
  const start = vi.fn((_c: string, args: readonly string[], opts: SpawnOptions) => {
    const child = new FakeChild(args, opts)
    if (args.includes('list')) lists.push(child)
    else if (args.includes('logout')) {
      if (!hangLogout) queueMicrotask(() => child.end(0))
    } else attempts.push(child)
    return child as unknown as ChildProcess
  })
  const stop = vi.fn((child: ChildProcess) => {
    const fake = child as unknown as FakeChild
    queueMicrotask(() => fake.end(null, 'SIGTERM'))
  })
  const engine = new McpOAuth({
    profiles: () => profiles,
    servers: () => servers,
    fallbackCwd: tmpdir(),
    env: async () => {
      if (envFail.on) throw new Error('trousseau verrouillé')
      return { PATH: '/x' }
    },
    findCommand: (c) => `/x/${c}`,
    openExternal: (url) => void opened.push(url),
    onState: (s) => states.push(s),
    start,
    stop,
    limits: { attemptMs: 600_000, noPageMs: 30_000, commandMs: 30_000, exitWaitMs: 5_000 }
  })
  const releaseList = (out = '[]') => {
    const c = lists.shift()
    if (!c) throw new Error('pas de auth list en attente')
    c.write(out)
    c.end(0)
  }
  return { engine, states, opened, attempts, lists, releaseList, logged, stop }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('REVUE 293 passage 2', () => {
  it('P1 préfixe de trois caractères : un texte libre suivi d’une adresse passe pour la page', () => {
    for (const l of [
      'see https://www.figma.com/oauth/mcp?client_id=X',
      'Go: https://www.figma.com/oauth/mcp?client_id=X',
      'or https://www.figma.com/oauth/mcp?client_id=X'
    ])
      expect(OPENCODE_MCP_AUTH.readLine(l), l).toBeUndefined()
  })
  it('P2 déconnexion dont l’environnement échoue : la fin de la tentative 1 n’est jamais émise, le renderer reste « en cours »', async () => {
    envFail.on = false
    const w = world2()
    const ws = tmpdir()
    await w.engine.connect('opencode', 'figma', ws)
    first(w.attempts).write(`${PAGE}\n`)
    w.engine.cancel('opencode', 'figma')
    await flush() // processus fini, place rendue, relecture de la tentative 1 en attente
    envFail.on = true
    await expect(w.engine.disconnect('opencode', 'figma', ws)).rejects.toThrow()
    envFail.on = false
    w.releaseList('[]')
    await flush()
    expect(w.states.at(-1)?.status).not.toBe('connecting')
  })
  it('balayage D : réponses attendues (préréglage de Figma, retour local exigé)', () => {
    const page = { host: 'www.figma.com', path: '/oauth/mcp', loopbackRedirect: true }
    const P = 'https://www.figma.com/oauth/mcp?response_type=code&client_id=ATTACKER'
    const cases: [string, boolean][] = [
      ['', false],
      [
        '&redirect_uri=http%3A%2F%2F127.0.0.1%3A1%2Fcb&redirect%5Furi=https%3A%2F%2Fevil.tld',
        false
      ],
      ['&REDIRECT_URI=https%3A%2F%2Fevil.tld%2Fcb', false],
      ['&a=1;redirect_uri=https://evil.tld/cb', false],
      ['&request_uri=https%3A%2F%2Fevil.tld%2Fpar', false],
      ['&request=eyJhbGciOiJub25lIn0.e30.', false],
      ['&redirect_uri=http%3A%2F%2F0x7f.1%3A1%2F', false],
      ['&redirect_uri=http%3A%2F%2F127.1%3A1%2F', false],
      ['&redirect_uri=http%3A%2F%2Flocalhost.%3A1%2F', false],
      ['&redirect_uri=http%3A%2F%2F%5B%3A%3A1%5D%3A1%2F', false],
      ['&redirect_uri=http%3A%2F%2Flocalhost%40evil.tld%3A1%2F', false],
      ['&redirect_uri=http%3A%2F%2F127.0.0.1.evil.tld%3A1%2F', false],
      ['#&redirect_uri=https://evil.tld', false],
      // Fragment de la page, après un retour local : le retour est `http://127.0.0.1:1/cb`.
      ['&redirect_uri=http://127.0.0.1:1/cb#x', true],
      ['&redirect_uri=http%3A%2F%2F127.0.0.1%3A1%5C%40evil.tld%2F', false],
      // Chemin du retour sur cette machine même : le retour reste local, accepté.
      ['&redirect_uri=http%3A%2F%2Flocalhost%3A1%2F..%2F%2Fevil.tld', true]
    ]
    for (const [q, ok] of cases) expect(checkPageUrl(P + q, page).ok, q).toBe(ok)
    const fx =
      'https://www.figma.com/oauth/mcp?response_type=code&client_id=FAKECLIENTID&code_challenge=FAKECHALLENGE&code_challenge_method=S256&redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=FAKESTATE&scope=mcp%3Aconnect&resource=https%3A%2F%2Fmcp.figma.com%2Fmcp'
    expect(checkPageUrl(fx, page).ok).toBe(true)
  })
})
