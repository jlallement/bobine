import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentBlocker, AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { RequestError } from '../../shared/acp-sdk.mts'
import { BOB_EXPIRED_LOGIN } from '../../mock-agent/scenario.mts'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { parseTrace } from './acp-trace'
import { AgentHost, type AgentHostOptions } from './agent-host'
import { resolveProfiles, type AgentProfile } from './profiles'
import { TurnAuth, turnAuthBlocker, type AuthBlocker } from './turn-auth'

const AUTH = /authentication required/i

/** Agent factice dont la connexion a expiré (comme OpenCode 2.2.5), sessions gardées. */
function profile(scenario = 'connexion-expiree', extraArgs: string[] = []): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'auth-store-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [
      MOCK_AGENT_ENTRY,
      '--scenario',
      scenario,
      '--delay',
      '0',
      '--store',
      store,
      ...extraArgs
    ],
    env: {},
    terminalSteps: {
      'mock-login': { label: 'Se connecter', command: 'touch .mock-agent-logged-in' }
    },
    authAtTurn: { pattern: AUTH }
  }
}

function setup(p: AgentProfile, extra: Partial<AgentHostOptions> = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'auth-ws-'))
  writeFileSync(join(workspace, 'README.md'), '# Exemple\n')
  const events: AgentEvent[] = []
  const host = new AgentHost({ profile: p, workspace, emit: (e) => events.push(e), ...extra })
  const items = () => events.reduce(reduceTranscript, emptyTranscript).items
  const users = () => items().filter((i) => i.kind === 'user').length
  const replies = () => items().flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
  const login = () => writeFileSync(join(workspace, '.mock-agent-logged-in'), '')
  return { host, events, users, replies, login }
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('délai dépassé')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('connexion expirée pendant la conversation (recette 0.9, D10)', () => {
  it('message refusé : carte, pas l’erreur brute ; « Réessayer » le renvoie une fois', async () => {
    // Sans réglage de modèle (comme Bob) : la carte d'avant ; avec, voir `turn-auth-model.test.ts`.
    const { host, events, users, replies, login } = setup(
      profile('connexion-expiree', ['--sans-options']),
      {
        // Clé connue du profil : pas proposée (le profil ne dit pas qu'elle répond à ce refus).
        apiKeyInfo: () => ({ env: 'K', label: 'Clé', stored: false, fromEnvironment: false })
      }
    )
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    const snapshot = host.snapshot()
    expect(snapshot.status).toBe('needs-action')
    expect(snapshot.blocker).toMatchObject({
      kind: 'auth',
      atTurn: true,
      methods: [{ id: 'mock-login', step: { command: 'touch .mock-agent-logged-in' } }]
    })
    expect(snapshot.blocker).not.toHaveProperty('apiKey')
    expect(snapshot.blocker).not.toHaveProperty('toolsRan')
    expect(snapshot.blocker).not.toHaveProperty('message')
    expect(events.some((e) => e.type === 'turn-error')).toBe(false)
    expect(events).toContainEqual({
      type: 'notice',
      level: 'warning',
      message: { key: 'agentHost.authExpired', params: { agent: 'Agent factice' } }
    })

    login()
    // Pendant la réouverture et jusqu'au renvoi, rien d'autre ne part (pas « prêt »).
    const retry = host.retrySession()
    await waitFor(() => host.snapshot().status === 'starting')
    await expect(host.send('Autre chose')).rejects.toThrow()
    await retry
    await waitFor(() => events.some((e) => e.type === 'turn-end'))
    expect(host.currentSessionId).toBe(sessionId)
    expect(users()).toBe(1)
    expect(replies()).toEqual(['Reconnecté, je peux répondre.'])
    expect(host.snapshot().status).toBe('ready')
    // Une seule fois : plus rien à réessayer.
    await expect(host.retrySession()).rejects.toThrow()
    host.stop()
  })

  it('connexion par SSO (`authenticate`) : même session, le message renvoyé', async () => {
    const { host, events, users, replies } = setup(profile('connexion-expiree-sso'))
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    expect(host.snapshot().blocker).toMatchObject({
      kind: 'auth',
      atTurn: true,
      methods: [{ id: 'mock-sso' }]
    })
    await host.authenticate('mock-sso')
    await waitFor(() => events.some((e) => e.type === 'turn-end'))
    expect(host.currentSessionId).toBe(sessionId)
    expect(users()).toBe(1)
    expect(replies()).toEqual(['Reconnecté, je peux répondre.'])
    host.stop()
  })

  it('refus de Bob 2.0.9 (`-32603`, fiche 200) : carte, clé d’API, SSO puis renvoi', async () => {
    const bobLike: AgentProfile = {
      ...profile('connexion-expiree-bob'),
      authAtTurn: {
        pattern: AUTH,
        otherCodes: [{ code: -32603, pattern: /invalid or expired api key/i }],
        apiKey: true
      }
    }
    const { host, events, users, replies } = setup(bobLike, {
      apiKeyInfo: () => ({ env: 'K', label: 'Clé', stored: false, fromEnvironment: false })
    })
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    expect(host.snapshot().status).toBe('needs-action')
    expect(host.snapshot().blocker).toMatchObject({
      kind: 'auth',
      atTurn: true,
      methods: [{ id: 'mock-sso' }],
      apiKey: { env: 'K' }
    })
    expect(events.some((e) => e.type === 'turn-error')).toBe(false)
    expect(JSON.stringify(events)).not.toContain('Invalid or expired API key')
    await host.authenticate('mock-sso')
    await waitFor(() => events.some((e) => e.type === 'turn-end'))
    expect(host.currentSessionId).toBe(sessionId)
    expect(users()).toBe(1)
    expect(replies()).toEqual(['Reconnecté, je peux répondre.'])
    host.stop()
  })

  it('même refus sans la règle du profil (0.11.0) : erreur brute, pas de carte', async () => {
    const { host, events } = setup(profile('connexion-expiree-bob'))
    await host.start()
    await host.prompt('Ajoute un test')
    expect(host.snapshot().blocker).toBeUndefined()
    expect(events).toContainEqual({
      type: 'turn-error',
      message: 'Request Failed — Invalid or expired API key.'
    })
    host.stop()
  })

  it('refus après un outil : `toolsRan`, gardé si le renvoi est refusé de nouveau', async () => {
    const { host, login, users } = setup(profile('connexion-expiree-outil'))
    await host.start()
    await host.prompt('Lis le README')
    expect(host.snapshot().blocker).toMatchObject({ atTurn: true, toolsRan: true })
    // Réessayé sans s'être connecté : refusé avant tout outil, mais les outils ont déjà tourné.
    await host.retrySession()
    await waitFor(() => host.snapshot().status === 'needs-action')
    expect(host.snapshot().blocker).toMatchObject({ atTurn: true, toolsRan: true })
    login()
    await host.retrySession()
    await waitFor(() => host.snapshot().status === 'ready')
    expect(users()).toBe(1)
    host.stop()
  })

  it('arrêt puis relance sans « Réessayer » : le message refusé est oublié', async () => {
    const { host, events, login } = setup(profile())
    await host.start()
    await host.prompt('Ajoute un test')
    login()
    await host.restart()
    expect(host.snapshot().status).toBe('ready')
    expect(events.some((e) => e.type === 'turn-end')).toBe(false)
    host.stop()
  })

  it('session neuve (agent sans reprise, ADR-0030) : l’échange d’avant et le contexte de session suivent, une fois', async () => {
    const { host, events, users, replies, login } = setup(
      profile('connexion-expiree-echo', ['--sans-historique']),
      {
        extraContext: () => 'ÉCHANGE PRÉCÉDENT',
        sessionContext: () => 'CONTEXTE DE SESSION'
      }
    )
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    login()
    await host.retrySession()
    await waitFor(() => events.some((e) => e.type === 'turn-end'))
    expect(host.currentSessionId).not.toBe(sessionId)
    expect(events.some((e) => e.type === 'handover')).toBe(true)
    // Message renvoyé à la session neuve : vu une seule fois dans le fil.
    expect(users()).toBe(1)
    expect(replies()[0]).toContain('ÉCHANGE PRÉCÉDENT')
    expect(replies()[0]).toContain('CONTEXTE DE SESSION')
    await host.prompt('Encore')
    expect(replies()[1]).not.toContain('CONTEXTE DE SESSION')
    host.stop()
  })

  it('refus -32000 sans indice de connexion : erreur de tour ordinaire, pas de carte', async () => {
    const starts = vi.spyOn(
      AgentHost.prototype as unknown as { doStart: () => Promise<void> },
      'doStart'
    )
    const { host, events } = setup(profile('connexion-expiree-autre'))
    await host.start()
    await host.prompt('Ajoute un test')
    expect(host.snapshot().status).toBe('ready')
    expect(host.snapshot().blocker).toBeUndefined()
    // Ni avis « connexion expirée », ni agent relancé.
    expect(JSON.stringify(events)).not.toContain('agentHost.authExpired')
    expect(starts).toHaveBeenCalledTimes(1)
    starts.mockRestore()
    expect(events).toContainEqual({
      type: 'turn-error',
      message: expect.stringContaining('Quota exceeded')
    })
    host.stop()
  })

  it('réouverture refusée elle aussi (N2) : le message attend la connexion, puis part', async () => {
    const { host, events, users, replies, login } = setup(profile('connexion-expiree-rouverture'))
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    // Réessayé sans s'être connecté : la session elle-même est refusée (carte de session).
    await host.retrySession()
    expect(host.snapshot().status).toBe('needs-action')
    expect(host.snapshot().blocker).toMatchObject({ kind: 'auth' })
    expect(host.snapshot().blocker).not.toHaveProperty('atTurn')
    login()
    await host.retrySession()
    await waitFor(() => events.some((e) => e.type === 'turn-end'))
    expect(host.currentSessionId).toBe(sessionId)
    expect(users()).toBe(1)
    expect(replies()).toEqual(['Reconnecté, je peux répondre.'])
    host.stop()
  })
})

describe('turnAuthBlocker et TurnAuth', () => {
  const auth = (extra: Partial<AuthBlocker> = {}): AuthBlocker => ({
    kind: 'auth',
    methods: [{ id: 'login', name: 'Login' }],
    authenticating: false,
    apiKey: { env: 'K', label: 'Clé', stored: false, fromEnvironment: false },
    ...extra
  })
  /** Refus de session reconnus comme à l'ouverture : `authRequired` seulement, ici. */
  const blockerOf =
    (blocker: AgentBlocker = auth()) =>
    (error: unknown) =>
      (error as { code?: unknown }).code === -32000 ? blocker : undefined
  const expired = RequestError.authRequired(undefined, 'provider authentication required')
  const rule = { authAtTurn: { pattern: AUTH } }

  it('clé d’API : seulement si le profil la dit utile, ou si c’est le seul moyen', () => {
    expect(turnAuthBlocker(expired, blockerOf(), rule)).not.toHaveProperty('apiKey')
    expect(
      turnAuthBlocker(expired, blockerOf(), { authAtTurn: { pattern: AUTH, apiKey: true } })
    ).toHaveProperty('apiKey')
    expect(turnAuthBlocker(expired, blockerOf(auth({ methods: [] })), rule)).toHaveProperty(
      'apiKey'
    )
    expect(
      turnAuthBlocker(expired, blockerOf({ kind: 'trust' } as AgentBlocker), rule)
    ).toBeUndefined()
  })

  it('connexion à refaire seulement avec l’indice du profil (rien de supposé sinon)', () => {
    expect(turnAuthBlocker(expired, blockerOf(), rule)).toMatchObject({
      kind: 'auth',
      atTurn: true
    })
    const quota = new RequestError(-32000, 'Quota exceeded')
    expect(turnAuthBlocker(quota, blockerOf(), rule)).toBeUndefined()
    expect(turnAuthBlocker(expired, blockerOf(), {})).toBeUndefined()
  })

  describe('Bob 2.0.9 : `-32603` « Invalid or expired API key » (fiche 200)', () => {
    /** L'erreur telle qu'enregistrée par la sonde (`__traces__/bob-2.0.9`). */
    const recorded = (() => {
      const trace = parseTrace(
        readFileSync(
          join(
            __dirname,
            '__traces__/bob-2.0.9/refus-au-tour-cle-refusee-licence-acceptee-sur-ce-mac.ndjson'
          ),
          'utf8'
        )
      )
      const reply = trace.lines.find((l) => l.from === 'agent' && 'error' in l.msg)
      const error = (reply?.msg as { error?: { code: number; message: string; data?: unknown } })
        .error
      if (!error) throw new Error('refus absent de la trace')
      return new RequestError(error.code, error.message, error.data)
    })()
    const bob = (id: string) => {
      const found = resolveProfiles({
        appPath: join(__dirname, '../../..'),
        execPath: process.execPath,
        isPackaged: false,
        env: {}
      }).find((p) => p.id === id)
      if (!found) throw new Error(`profil absent : ${id}`)
      return found
    }

    it('la trace enregistrée est bien celle du mock (`connexion-expiree-bob`)', () => {
      expect({ code: recorded.code, message: recorded.message, data: recorded.data }).toEqual(
        BOB_EXPIRED_LOGIN
      )
    })

    it('profil Bob : carte de connexion au tour, clé d’API proposée', () => {
      expect(turnAuthBlocker(recorded, blockerOf(), bob('bob'))).toMatchObject({
        kind: 'auth',
        atTurn: true,
        apiKey: { env: 'K' }
      })
      // Toujours reconnu sous `authRequired` (ce que Bob envoie à `session/new`).
      expect(turnAuthBlocker(expired, blockerOf(), bob('bob'))).toMatchObject({ atTurn: true })
    })

    it('un autre `-32603`, ou ce message sous un autre code : erreur de tour ordinaire', () => {
      const other = (code: number, details: string) =>
        new RequestError(code, 'Internal error', { details })
      // Ce que Bob relaie d'un serveur MCP qui demande une connexion : pas la sienne.
      expect(
        turnAuthBlocker(other(-32603, 'Authentication required'), blockerOf(), bob('bob'))
      ).toBeUndefined()
      expect(
        turnAuthBlocker(other(-32603, 'Error: socket hang up'), blockerOf(), bob('bob'))
      ).toBeUndefined()
      expect(
        turnAuthBlocker(other(-32600, 'Invalid or expired API key.'), blockerOf(), bob('bob'))
      ).toBeUndefined()
    })

    it('profil OpenCode : l’erreur de Bob n’y est pas une connexion (rien de supposé)', () => {
      expect(turnAuthBlocker(recorded, blockerOf(), bob('opencode'))).toBeUndefined()
    })
  })

  it('oublié à l’arrêt ; jamais repris pour une carte qui n’est pas celle d’un tour', () => {
    const turns = new TurnAuth()
    const turn = { sessionId: 's1', blocks: [] }
    const blocker = turns.block(auth({ atTurn: true }), turn, 0)
    expect(turns.take(auth())).toBeUndefined()
    turns.block(blocker, turn, 0)
    turns.clear()
    expect(turns.take(blocker)).toBeUndefined()
    // Session ouverte sans renvoi : oublié aussi.
    turns.block(blocker, turn, 0)
    expect(turns.opened()).toBeUndefined()
    expect(turns.take(blocker)).toBeUndefined()
    // Réouverture refusée par une carte de session (N2) : le message en attente reste.
    turns.block(blocker, turn, 0)
    turns.expect(turns.take(blocker))
    expect(turns.take(auth())).toMatchObject({ sessionId: 's1' })
  })
})
