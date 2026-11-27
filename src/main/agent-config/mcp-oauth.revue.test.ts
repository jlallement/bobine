/**
 * Preuves du testeur adverse (relecture du lot 1, fiche 293), gardées telles quelles comme essais
 * permanents : six essais rouges sur `8c550084` (courses entre tentatives, page ouverte après la fin
 * du processus, journal qui fuyait, déconnexion ratée dite faite). Seules retouches : imports
 * inutilisés retirés et `!` remplacé par `first()` (règles ESLint du dépôt) ; au second passage, R4
 * réécrit sur le contrat actuel, et les adresses de R1 à R3 dotées du `redirect_uri` local que le
 * préréglage exige (sans lui, ces essais ne pouvaient plus échouer).
 */
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState, McpServerEntry } from '@shared/mcp'
import { log } from '../log'
import { resolveProfiles } from '../agent/profiles'
import { McpOAuth } from './mcp-oauth'

// Second passage : le préréglage exige désormais un `redirect_uri` local ; sans lui, R1, R2 et R3
// visaient une page refusée d'avance et ne pouvaient plus échouer pour la raison qu'ils nomment.
const PAGE_PREFIX =
  'https://www.figma.com/oauth/mcp?response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A1%2Fcb&client_id=FAKECLIENTID'

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
    env: async () => ({ PATH: '/x' }),
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

describe('REVUE 293 : preuves', () => {
  it('R1 course : la fin relue de la tentative 1 écrase l’état « en cours » de la tentative 2', async () => {
    const w = world2()
    const ws = tmpdir()
    await w.engine.connect('opencode', 'figma', ws)
    first(w.attempts).write(`${PAGE}\n`)
    w.engine.cancel('opencode', 'figma')
    await flush() // arbre arrêté, `current` libéré, `auth list` lancé mais sans réponse
    expect(w.lists).toHaveLength(1)
    // Second clic pendant la relecture : accepté, tentative 2 en cours.
    expect(await w.engine.connect('opencode', 'figma', ws)).toEqual({ started: true })
    expect(w.states.at(-1)).toMatchObject({ status: 'connecting' })
    w.releaseList('[]') // la relecture de la tentative 1 répond enfin
    await flush()
    // Dernier état émis au renderer pendant que la tentative 2 tourne :
    expect(w.states.at(-1)).toMatchObject({ status: 'connecting' })
  })

  it('R1b course : une fin d’erreur périmée est gardée et remplace l’état pendant la tentative 2', async () => {
    const w = world2()
    const ws = tmpdir()
    await w.engine.connect('opencode', 'figma', ws)
    first(w.attempts).write('https://evil.tld/\n') // tentative 1 : page refusée
    await flush()
    await w.engine.connect('opencode', 'figma', ws)
    w.releaseList('[]')
    await flush()
    expect(w.states.at(-1)).toMatchObject({ status: 'connecting' })
  })

  it('R2 page ouverte après la fin du processus, depuis une dernière ligne sans retour (adresse tronquée)', async () => {
    const w = world2()
    await w.engine.connect('opencode', 'figma', tmpdir())
    // Processus tué de l'extérieur au milieu de l'écriture de l'adresse.
    first(w.attempts).write(
      '●  https://www.figma.com/oauth/mcp?response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A1%2Fcb&client_id=FAKE'
    )
    first(w.attempts).end(null, 'SIGKILL')
    await flush()
    expect(w.opened).toEqual([])
  })

  it('R3 adresse coupée en deux lignes : paramètres au journal, page tronquée ouverte', async () => {
    const w = world2()
    await w.engine.connect('opencode', 'figma', tmpdir())
    first(w.attempts).write(`●  ${PAGE_PREFIX}&\n│  state=FAKESTATE&code_challenge=FAKECHALLENGE\n`)
    const all = w.logged.join('\n')
    expect(all).not.toContain('FAKESTATE')
  })

  it('R3b adresse coupée par une espace (sortie d’erreur) : paramètres au journal', async () => {
    const w = world2()
    await w.engine.connect('opencode', 'figma', tmpdir())
    first(w.attempts).write(
      `Error: authorization failed for https://www.figma.com/oauth/mcp?client_id=FAKECLIENTID state=FAKESTATE\n`,
      'stderr'
    )
    expect(w.logged.join('\n')).not.toContain('FAKESTATE')
  })

  it('R4 déconnexion en échec (délai) : ni succès rendu, ni succès au journal', async () => {
    // Réécrit au second passage : le contrat a changé (`McpDisconnectResult`), l'ancienne forme ne
    // pouvait plus échouer.
    const w = world2([figma()], true)
    const p = w.engine.disconnect('opencode', 'figma', tmpdir())
    await flush()
    await vi.advanceTimersByTimeAsync(30_000)
    if (w.lists.length) w.releaseList('[]')
    await flush()
    expect(await p).toEqual({ done: false, reason: 'timeout' })
    expect(w.logged.filter((l) => l.includes('déconnecté'))).toEqual([])
    expect(w.logged.some((l) => l.includes('pas de réponse'))).toBe(true)
  })
})
