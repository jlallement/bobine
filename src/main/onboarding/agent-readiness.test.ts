import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { AUTH_REQUIRED_MESSAGE } from '../agent/opencode-contract'
import { EXPIRED_LOGIN_MESSAGE, INTERNAL_ERROR, UNTRUSTED_WORKSPACE } from '../agent/bob-contract'
import {
  checkAgent,
  MAX_REPLY_CHARS,
  outcomeOf,
  type ReadinessOptions,
  type TrialTurn
} from './agent-readiness'
import { bobDbCosts, readBobTaskCost } from '../agent/bob-costs'
import { AgentExited } from '../agent/short-lived-agent'
import { deleteEachSession } from '../agent/session-list'

/** Chaque agent lancé par l'essai, pour vérifier qu'aucun ne reste derrière. */
const spawned: ChildProcess[] = []
vi.mock('../agent/agent-process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent/agent-process')>()
  return {
    ...actual,
    spawnAgent: (...args: Parameters<typeof actual.spawnAgent>) => {
      const child = actual.spawnAgent(...args)
      spawned.push(child)
      return child
    }
  }
})

/** Sessions d'essai notées puis supprimées, comme le journal de l'app. */
const noted: string[] = []
const removed: string[] = []

afterEach(() => {
  spawned.length = 0
  noted.length = 0
  removed.length = 0
})

const mock = (scenario: string, ...args: string[]): AgentProfile => ({
  id: 'mock',
  label: 'Agent factice',
  command: process.execPath,
  // `--delay` donné après remplace celui-ci (pauses du scénario).
  args: [MOCK_AGENT_ENTRY, '--delay', '0', '--scenario', scenario, ...args],
  env: {},
  installHint: 'Installez-le.',
  terminalSteps: {
    'mock-login': { label: 'Se connecter', command: 'touch .mock-agent-logged-in' }
  },
  authAtTurn: { pattern: AUTH_REQUIRED_MESSAGE },
  trust: { pattern: UNTRUSTED_WORKSPACE, flag: '--trust' }
})

const folder = () => mkdtempSync(join(tmpdir(), 'bobine-essai-'))

function check(profile: AgentProfile, extra: Partial<ReadinessOptions> = {}) {
  return checkAgent({
    profile,
    level: 'reply',
    cwd: folder(),
    scratchParent: folder(),
    pathEnv: process.env['PATH'],
    onSession: (id) => noted.push(id),
    onSessionRemoved: (id) => removed.push(id),
    ...extra
  })
}

/** Toute session d'essai ouverte a été supprimée chez l'agent (et le magasin du factice vide). */
function expectSessionsRemoved(store?: string): void {
  expect(noted.length).toBeGreaterThan(0)
  expect(removed).toEqual(noted)
  if (store) expect(readdirSync(store)).toEqual([])
}

const store = () => mkdtempSync(join(tmpdir(), 'mock-store-'))

/** Le dernier agent lancé est arrêté (ou s'arrête dans la seconde). */
async function expectStopped(): Promise<void> {
  expect(spawned.length).toBeGreaterThan(0)
  await vi.waitFor(
    () => {
      for (const child of spawned) expect(child.exitCode ?? child.signalCode).not.toBeNull()
    },
    { timeout: 5000 }
  )
}

describe('essai « répond ? » du premier lancement (fiche 188)', () => {
  it('répond : texte, coût et jetons annoncés ; session d’essai supprimée, agent arrêté', async () => {
    const store = mkdtempSync(join(tmpdir(), 'mock-store-'))
    const result = await check(mock('premier-essai', '--store', store))
    expect(result).toMatchObject({
      state: 'ready',
      level: 'reply',
      reply: 'OK',
      cost: { currency: 'USD' },
      tokens: { input: expect.any(Number), output: expect.any(Number) }
    })
    expect(readdirSync(store)).toEqual([])
    await expectStopped()
  })

  it('« connecté ? » : session ouverte sans aucun message au modèle', async () => {
    const store = mkdtempSync(join(tmpdir(), 'mock-store-'))
    const result = await check(mock('premier-essai', '--store', store), { level: 'connect' })
    expect(result).toMatchObject({ state: 'ready', level: 'connect' })
    expect(result).not.toHaveProperty('reply')
    expect(result).not.toHaveProperty('cost')
    expect(readdirSync(store)).toEqual([])
    await expectStopped()
  })

  it('agent absent : rien n’est lancé, le profil dit quoi installer', async () => {
    const result = await check({ ...mock('premier-essai'), command: 'agent-introuvable-188' })
    expect(result).toEqual({
      state: 'missing',
      reason: expect.stringMatching(/agent-introuvable-188.*Installez-le\./)
    })
    expect(spawned).toEqual([])
  })

  it('connexion à faire : carte de connexion avec l’étape du profil, sans message', async () => {
    const result = await check(mock('connexion-terminal'), { level: 'connect' })
    expect(result).toMatchObject({
      state: 'auth',
      blocker: {
        kind: 'auth',
        methods: [{ id: 'mock-login', step: { command: 'touch .mock-agent-logged-in' } }]
      }
    })
    await expectStopped()
  })

  it('connexion faite (dans le dossier réservé, où l’agent est lancé) : connecté', async () => {
    const cwd = folder()
    writeFileSync(join(cwd, '.mock-agent-logged-in'), '')
    const result = await check(mock('connexion-terminal'), { cwd })
    expect(result).toMatchObject({ state: 'ready', reply: expect.stringContaining('Connecté') })
  })

  it('connexion expirée : session ouverte, message refusé → carte de connexion au tour (D10)', async () => {
    const result = await check(mock('connexion-expiree'))
    expect(result).toMatchObject({ state: 'auth', blocker: { kind: 'auth', atTurn: true } })
    await expectStopped()
  })

  it('refus de Bob 2.0.9 (`-32603` « Invalid or expired API key », fiche 200) : carte au tour', async () => {
    const bobLike: AgentProfile = {
      ...mock('connexion-expiree-bob'),
      authAtTurn: {
        pattern: AUTH_REQUIRED_MESSAGE,
        otherCodes: [{ code: INTERNAL_ERROR, pattern: EXPIRED_LOGIN_MESSAGE }],
        apiKey: true
      }
    }
    const result = await check(bobLike)
    expect(result).toMatchObject({
      state: 'auth',
      blocker: { kind: 'auth', atTurn: true, methods: [{ id: 'mock-sso' }] }
    })
    await expectStopped()
    // Sans la règle du profil (0.11.0) : l'erreur brute, pas de carte.
    expect(await check(mock('connexion-expiree-bob'))).toEqual({
      state: 'failed',
      message: 'Request Failed — Invalid or expired API key.'
    })
  })

  it('dossier à approuver : carte du dossier, pas une erreur', async () => {
    const result = await check(mock('bob-premiere-connexion'), { level: 'connect' })
    expect(result).toMatchObject({ state: 'trust', blocker: { kind: 'trust' } })
  })

  it('réseau coupé : reconnu comme tel', async () => {
    const result = await check(mock('reseau-instable'))
    expect(result).toMatchObject({ state: 'network', cause: 'network' })
  })

  it('plantage en plein tour : code et fin de la sortie d’erreur, processus arrêté', async () => {
    const result = await check(mock('plantage'))
    expect(result).toMatchObject({
      state: 'crashed',
      message: expect.stringContaining('code 3'),
      stderr: expect.stringContaining('plantage simulé')
    })
    await expectStopped()
  })

  it('démarrage trop lent : délai dépassé, agent arrêté', async () => {
    const result = await check(mock('premier-essai', '--demarrage-lent', '5000'), {
      timeouts: { startMs: 300 }
    })
    expect(result).toMatchObject({ state: 'timeout' })
    await expectStopped()
  })

  it('réponse trop lente (agent figé) : délai dépassé, session supprimée, agent arrêté', async () => {
    const result = await check(mock('muet'), { timeouts: { replyMs: 400, cleanupMs: 800 } })
    expect(result).toMatchObject({ state: 'timeout' })
    expectSessionsRemoved()
    await expectStopped()
  })

  it('annulé pendant la réponse : `session/delete` envoyé quand même, magasin vide, agent arrêté', async () => {
    const controller = new AbortController()
    const kept = store()
    const pending = check(mock('attend-stop', '--delay', '5', '--store', kept), {
      signal: controller.signal
    })
    await vi.waitFor(() => expect(noted.length).toBe(1))
    setTimeout(() => controller.abort(), 300)
    expect(await pending).toEqual({ state: 'cancelled' })
    expectSessionsRemoved(kept)
    await expectStopped()
  })

  it('« connecté ? » annulé juste après l’ouverture : session supprimée quand même', async () => {
    const controller = new AbortController()
    const kept = store()
    const result = await check(mock('premier-essai', '--store', kept), {
      level: 'connect',
      signal: controller.signal,
      onSession: (id) => {
        noted.push(id)
        controller.abort()
      }
    })
    expect(['cancelled', 'ready']).toContain(result.state)
    expectSessionsRemoved(kept)
    await expectStopped()
  })

  it('arrêt immédiat (fermeture de l’app) : l’agent est arrêté sans attendre', async () => {
    let stop: (() => void) | undefined
    const pending = check(mock('attend-stop', '--delay', '5'), { onStop: (s) => (stop = s) })
    await vi.waitFor(() => expect(noted.length).toBe(1))
    stop?.()
    await expectStopped()
    expect((await pending).state).not.toBe('ready')
  })

  it('méthode de connexion que l’agent n’annonce pas : refusée, rien lancé chez l’agent', async () => {
    const result = await check(mock('connexion-terminal'), {
      level: 'connect',
      authenticate: 'evil-method'
    })
    expect(result).toEqual({ state: 'failed', message: expect.any(String) })
    expect(noted).toEqual([])
  })

  it('annulé avant de commencer : rien n’est lancé', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await check(mock('premier-essai'), { signal: controller.signal })).toEqual({
      state: 'cancelled'
    })
    expect(spawned).toEqual([])
  })

  it('outil demandé pendant l’essai : refusé, tour annulé, branche « autoriser » jamais jouée', async () => {
    const kept = store()
    const result = await check(mock('premier-essai-outil', '--store', kept))
    expect(result).toEqual({ state: 'failed', message: expect.stringContaining('outil') })
    expect(JSON.stringify(result)).not.toContain('ESSAI-OUTIL-AUTORISE')
    expectSessionsRemoved(kept)
    await expectStopped()
  })

  it('outil demandé après du texte : l’agent répond, outil refusé et signalé', async () => {
    const result = await check(mock('demo'))
    expect(result).toMatchObject({ state: 'ready', toolRefused: true })
    if (result.state === 'ready') expect(result.reply?.length).toBeLessThanOrEqual(MAX_REPLY_CHARS)
    expect(JSON.stringify(result)).not.toContain('Configuration mise à jour')
    await expectStopped()
  })

  it('modèle de la session annoncé', async () => {
    const result = await check(mock('premier-essai'), { level: 'connect' })
    expect(result).toMatchObject({ state: 'ready', model: expect.any(String) })
  })

  it('session d’essai toujours dans un dossier jetable de l’app, supprimé ; jamais le dossier de lancement', async () => {
    const cwd = folder()
    const scratchParent = folder()
    const result = await check(mock('dossiers', '--sans-historique'), { cwd, scratchParent })
    expect(result.state).toBe('ready')
    if (result.state === 'ready') {
      expect(result.reply).toContain(join(scratchParent, 'essai-'))
      expect(result.reply).not.toContain(`${cwd}\n`)
    }
    expect(readdirSync(scratchParent)).toEqual([])
    expect(readdirSync(cwd)).toEqual([])
  })

  it('agent sans `session/delete` : rien de noté (rien à retenter), dossier jetable supprimé', async () => {
    const result = await check(mock('premier-essai', '--sans-historique'))
    expect(result.state).toBe('ready')
    expect(noted).toEqual([])
  })

  it('dossier de données pas inscriptible : un échec dit, pas une exception, rien lancé', async () => {
    const result = await check(mock('premier-essai'), { scratchParent: '/dev/null/impossible' })
    expect(result).toEqual({ state: 'failed', message: expect.any(String) })
    expect(spawned).toEqual([])
  })

  it('dossier jetable impossible à supprimer : le vrai résultat reste, sans erreur', async () => {
    const result = await check(mock('premier-essai'), {
      removeFolder: () => {
        throw Object.assign(new Error('ENOTEMPTY: directory not empty'), { code: 'ENOTEMPTY' })
      }
    })
    expect(result).toMatchObject({ state: 'ready', reply: 'OK' })
  })

  it('suppression session par session : faite, ou « introuvable » si l’agent ne sait pas supprimer', async () => {
    const kept = store()
    expect(
      await deleteEachSession({
        profile: mock('premier-essai', '--store', kept),
        cwd: folder(),
        sessionIds: ['x']
      })
    ).toEqual({ x: 'deleted' })
    expect(
      await deleteEachSession({
        profile: mock('premier-essai', '--sans-historique'),
        cwd: folder(),
        sessionIds: ['y']
      })
    ).toEqual({ y: 'missing' })
  })
})

describe('coût de l’essai (recette 0.10, D10)', () => {
  it('agent « comme Bob » (coût dans sa base, rien par ACP) : lu avant la suppression, montré et rapporté', async () => {
    const dbPath = join(folder(), 'bob.db')
    const profile = {
      ...mock('premier-essai', '--cout-bob', '--bob-db', dbPath),
      costSource: bobDbCosts(dbPath)
    }
    const turns: TrialTurn[] = []
    const result = await check(profile, { onTrialTurn: (turn) => turns.push(turn) })
    expect(result).toMatchObject({
      state: 'ready',
      cost: { amount: expect.any(Number), currency: 'bobcoins' }
    })
    if (result.state === 'ready') expect(result.cost?.amount).toBeGreaterThan(0)
    expect(turns).toEqual([
      expect.objectContaining({
        stopReason: 'end_turn',
        cost: { amount: expect.any(Number), currency: 'bobcoins' },
        model: expect.objectContaining({ name: expect.any(String) })
      })
    ])
    // La session supprimée, sa ligne de coût est partie de la base : il fallait la lire avant.
    expectSessionsRemoved()
    expect(readBobTaskCost(noted[0] ?? '', dbPath)).toBeUndefined()
  })

  it('agent qui donne son coût par ACP : rapporté tel quel, jetons compris', async () => {
    const turns: TrialTurn[] = []
    await check(mock('premier-essai'), { onTrialTurn: (turn) => turns.push(turn) })
    expect(turns).toEqual([
      expect.objectContaining({
        stopReason: 'end_turn',
        cost: { amount: expect.any(Number), currency: 'USD' },
        tokens: expect.objectContaining({ input: expect.any(Number), output: expect.any(Number) })
      })
    ])
  })

  it('essai annulé : le tour est rapporté quand même (coût éventuel jamais perdu)', async () => {
    const controller = new AbortController()
    const turns: TrialTurn[] = []
    const pending = check(mock('attend-stop', '--delay', '5'), {
      signal: controller.signal,
      onTrialTurn: (turn) => turns.push(turn)
    })
    await vi.waitFor(() => expect(noted.length).toBe(1))
    setTimeout(() => controller.abort(), 300)
    expect(await pending).toEqual({ state: 'cancelled' })
    expect(turns).toEqual([expect.objectContaining({ stopReason: 'cancelled' })])
  })

  it('« connecté ? » : aucun tour, rien rapporté', async () => {
    const turns: TrialTurn[] = []
    await check(mock('premier-essai'), {
      level: 'connect',
      onTrialTurn: (turn) => turns.push(turn)
    })
    expect(turns).toEqual([])
  })
})

describe('issue d’une erreur', () => {
  it('plantage sans sortie d’erreur : pas de champ vide', () => {
    expect(outcomeOf(new AgentExited(1, null), '  ')).toEqual({
      state: 'crashed',
      message: expect.stringContaining('code 1')
    })
  })

  it('erreur ordinaire : telle quelle', () => {
    expect(outcomeOf(new Error('boom'), '')).toEqual({ state: 'failed', message: 'boom' })
  })
})
