import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import type { AgentReadiness, OnboardingMark } from '@shared/onboarding'
import type { AgentProfile } from '../agent/profiles'
import type { ReadinessOptions } from './agent-readiness'
import { createOnboarding, firstLaunchFacts, Onboarding, type OnboardingDeps } from './onboarding'
import { onboardingHandlers } from './onboarding-ipc'
import { hasConversations } from './onboarding-state'
import { TrialSessions } from './trial-sessions'
import type { DeleteOutcome } from '../agent/session-list'
import { agentSessions } from '../conversations/agent-outside'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'

const profile: AgentProfile = {
  id: 'mock',
  label: 'Agent factice',
  command: 'x',
  args: [],
  env: {}
}
const summary = { id: 'mock', label: 'Agent factice', available: true } as ProfileSummary

function setup(overrides: Partial<OnboardingDeps> = {}) {
  let mark: OnboardingMark | undefined
  const setOnboarding = vi.fn((next: OnboardingMark) => (mark = next))
  const calls: ReadinessOptions[] = []
  const deps: OnboardingDeps = {
    decision: {
      due: true,
      write: { outcome: 'pending', at: '2026-11-07T00:00:00.000Z', version: '0.10.0' }
    },
    settings: {
      onboarding: () => mark,
      setOnboarding,
      credentials: async () => ({ MOCK_AGENT_API_KEY: 'clé' }),
      keyInfo: () => [
        { env: 'MOCK_AGENT_API_KEY', label: 'Clé', stored: true, fromEnvironment: false }
      ]
    },
    profiles: () => [profile],
    summaries: () => [summary],
    cwd: '/neutre',
    scratchParent: mkdtempSync(join(tmpdir(), 'bobine-188-scratch-')),
    trialSessions: new TrialSessions(join(mkdtempSync(join(tmpdir(), 'bobine-188-j-')), 'j.json')),
    workspaceOf: () => '',
    runInTerminal: () => 'tab-1',
    trialParent: '/inexistant',
    trialRoot: '/inexistant',
    pathEnv: () => '/usr/bin',
    version: '0.10.0',
    now: () => new Date('2026-11-07T08:00:00.000Z'),
    check: async (options) => {
      calls.push(options)
      return { state: 'ready', level: options.level, ms: 1 }
    },
    ...overrides
  }
  return { onboarding: new Onboarding(deps), setOnboarding, calls, mark: () => mark }
}

describe('accueil du premier lancement, côté main (fiche 188)', () => {
  it('premier lancement : marque « en cours » posée tout de suite, agents proposés', () => {
    const { onboarding, setOnboarding } = setup()
    expect(setOnboarding).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'pending' }))
    expect(onboarding.state()).toMatchObject({ due: true, agents: [summary] })
  })

  it('pas à montrer : aucun agent demandé, rien d’écrit', () => {
    const summaries = vi.fn(() => [summary])
    const { onboarding, setOnboarding } = setup({ decision: { due: false }, summaries })
    expect(onboarding.state()).toMatchObject({ due: false, agents: [] })
    expect(summaries).not.toHaveBeenCalled()
    expect(setOnboarding).not.toHaveBeenCalled()
  })

  it('fini puis passé : la première marque reste, l’accueil ne revient plus', () => {
    const { onboarding, mark } = setup()
    onboarding.finish('finished')
    expect(mark()).toEqual({
      outcome: 'finished',
      at: '2026-11-07T08:00:00.000Z',
      version: '0.10.0'
    })
    onboarding.finish('skipped')
    expect(mark()?.outcome).toBe('finished')
    expect(onboarding.state().due).toBe(false)
  })

  it('essai : clés de l’app, clé proposée, dossier neutre, PATH du shell', async () => {
    const { onboarding, calls } = setup()
    await onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    expect(calls[0]).toMatchObject({
      profile,
      level: 'reply',
      cwd: '/neutre',
      credentials: { MOCK_AGENT_API_KEY: 'clé' },
      apiKey: { env: 'MOCK_AGENT_API_KEY' },
      pathEnv: '/usr/bin',
      clientVersion: '0.10.0'
    })
  })

  it('un seul essai à la fois : le suivant, Annuler et la fin annulent celui en cours', async () => {
    const signals: AbortSignal[] = []
    const check = (options: ReadinessOptions) =>
      new Promise<AgentReadiness>((resolve) => {
        const signal = options.signal ?? new AbortController().signal
        signals.push(signal)
        signal.addEventListener('abort', () => resolve({ state: 'cancelled' }))
      })
    const { onboarding } = setup({ check })
    const first = onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    await vi.waitFor(() => expect(signals).toHaveLength(1))
    const second = onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'connect' })
    expect(await first).toEqual({ state: 'cancelled' })
    await vi.waitFor(() => expect(signals).toHaveLength(2))
    onboarding.cancel()
    expect(await second).toEqual({ state: 'cancelled' })
    const third = onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    await vi.waitFor(() => expect(signals).toHaveLength(3))
    onboarding.finish('skipped')
    expect(await third).toEqual({ state: 'cancelled' })
  })

  it('étape de connexion : seulement celle du profil, dans le terminal de la conversation', () => {
    const runInTerminal = vi.fn(() => 'tab-7')
    const withStep = {
      ...profile,
      terminalSteps: { login: { label: 'Connexion', command: 'x login' } }
    }
    const { onboarding } = setup({ runInTerminal, profiles: () => [withStep] })
    expect(onboarding.runStep('c1', 'mock', 'login')).toBe('tab-7')
    expect(runInTerminal).toHaveBeenCalledWith('c1', '/neutre', 'x login')
    expect(() => onboarding.runStep('c1', 'mock', 'rm -rf /')).toThrow()
  })

  it('tour d’essai : une ligne du journal de consommation, sur la conversation de l’accueil', async () => {
    const recordUsage = vi.fn()
    const { onboarding } = setup({
      recordUsage,
      check: async (options) => {
        options.onTrialTurn?.({
          startedAt: 1000,
          endedAt: 4200,
          stopReason: 'end_turn',
          tokens: { input: 3000, output: 3 },
          cost: { amount: 0.42, currency: 'bobcoins' },
          model: { id: 'premium', name: 'Premium' }
        })
        return { state: 'ready', level: 'reply', ms: 3200 }
      }
    })
    await onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    expect(recordUsage).toHaveBeenCalledWith({
      id: 'c1:1000',
      conversationId: 'c1',
      startedAt: 1000,
      endedAt: 4200,
      profileId: 'mock',
      profileLabel: 'Agent factice',
      model: { id: 'premium', name: 'Premium' },
      stopReason: 'end_turn',
      tokens: { input: 3000, output: 3 },
      cost: { amount: 0.42, currency: 'bobcoins' },
      tools: {},
      subagents: 0
    })
  })

  it('journal qui refuse l’écriture : l’essai n’en souffre pas', async () => {
    const { onboarding } = setup({
      recordUsage: () => {
        throw new Error('base en lecture seule')
      },
      check: async (options) => {
        options.onTrialTurn?.({ startedAt: 1, endedAt: 2, stopReason: 'end_turn', tokens: {} })
        return { state: 'ready', level: 'reply', ms: 1 }
      }
    })
    await expect(
      onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    ).resolves.toMatchObject({ state: 'ready' })
  })

  it('essai réussi : l’agent est dit prêt (quota relu, fiche 205) ; refusé : non', async () => {
    const onReady = vi.fn()
    const { onboarding } = setup({ onReady })
    await onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'connect' })
    expect(onReady).toHaveBeenCalledWith('mock')
    const refused = vi.fn()
    const { onboarding: blocked } = setup({
      onReady: refused,
      check: async () => ({ state: 'failed', message: 'non' })
    })
    await blocked.check({ conversationId: 'c1', profileId: 'mock', level: 'connect' })
    expect(refused).not.toHaveBeenCalled()
  })

  it('agent inconnu : refusé', async () => {
    const { onboarding } = setup()
    await expect(
      onboarding.check({ conversationId: 'c1', profileId: 'inconnu', level: 'reply' })
    ).rejects.toThrow('inconnu')
  })
})

describe('canaux onboarding:*', () => {
  it('arguments vérifiés', async () => {
    const { onboarding } = setup()
    const h = onboardingHandlers(onboarding)
    expect(() =>
      h['onboarding:check']({ conversationId: 'c1', profileId: '', level: 'reply' })
    ).toThrow('profileId')
    expect(() =>
      h['onboarding:check']({ conversationId: 'c1', profileId: 'mock', level: 'tout' as 'reply' })
    ).toThrow('level')
    expect(() => h['onboarding:finish']('oui' as 'finished')).toThrow('outcome')
    expect(
      await h['onboarding:check']({ conversationId: 'c1', profileId: 'mock', level: 'connect' })
    ).toMatchObject({ state: 'ready' })
    expect(h['onboarding:state']()).toMatchObject({ due: true })
  })

  it('sans accueil branché : erreur claire', () => {
    expect(() => onboardingHandlers(undefined)['onboarding:state']()).toThrow()
  })
})

describe('relevé du premier lancement', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'bobine-188-'))

  it('conversations : absent, vide, index vide → non ; le reste (même illisible) → oui', () => {
    const d = dir()
    expect(hasConversations(join(d, 'absent'))).toBe(false)
    expect(hasConversations(d)).toBe(false)
    writeFileSync(join(d, 'index.json'), '[]')
    expect(hasConversations(d)).toBe(false)
    writeFileSync(join(d, 'index.json'), '[{"id":"c1"}]')
    expect(hasConversations(d)).toBe(true)
    writeFileSync(join(d, 'index.json'), '{abîmé')
    expect(hasConversations(d)).toBe(true)
    writeFileSync(join(d, 'index.json'), '[]')
    writeFileSync(join(d, 'c1.json'), '{}')
    expect(hasConversations(d)).toBe(true)
  })

  it('dossier de données neuf : accueil dû ; réglages déjà là : non', () => {
    const d = dir()
    const deps = {
      settings: setupSettings(),
      profiles: () => [profile],
      summaries: () => [summary],
      cwd: '/neutre',
      userData: d,
      workspaceOf: () => '',
      runInTerminal: () => 'tab-1',
      version: '0.10.0'
    }
    const initial = { recentWorkspaces: [] }
    expect(createOnboarding(firstLaunchFacts(d), initial, false, deps, {}).state().due).toBe(true)
    mkdirSync(join(d, 'conversations'))
    writeFileSync(join(d, 'settings.json'), '{}')
    expect(createOnboarding(firstLaunchFacts(d), initial, false, deps, {}).state().due).toBe(false)
  })

  it('settings.json avec seulement `window` (une 0.9 juste ouverte) : pas d’accueil', () => {
    const d = dir()
    writeFileSync(
      join(d, 'settings.json'),
      JSON.stringify({ window: { x: 0, y: 0, width: 900, height: 700 } })
    )
    const deps = {
      settings: setupSettings(),
      profiles: () => [profile],
      summaries: () => [summary],
      cwd: '/neutre',
      userData: d,
      workspaceOf: () => '',
      runInTerminal: () => 'tab-1',
      version: '0.10.0'
    }
    const onboarding = createOnboarding(
      firstLaunchFacts(d),
      { recentWorkspaces: [] },
      false,
      deps,
      {}
    )
    expect(onboarding.state().due).toBe(false)
  })
})

describe('sessions d’essai notées (relecture du tech lead)', () => {
  const journalFile = () => join(mkdtempSync(join(tmpdir(), 'bobine-188-j-')), 'sessions.json')

  it('suppression ratée : masquée de « Reprendre une session », y compris après relance', async () => {
    const file = journalFile()
    const trialSessions = new TrialSessions(file)
    const { onboarding } = setup({
      trialSessions,
      check: async (options) => {
        options.onSession?.('ses-essai')
        return { state: 'cancelled' }
      }
    })
    await onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    expect(onboarding.hiddenSessions('mock')).toEqual(['ses-essai'])
    // Relance : le journal est relu.
    expect(new TrialSessions(file).ids('mock')).toEqual(['ses-essai'])
    const store = mkdtempSync(join(tmpdir(), 'mock-store-'))
    writeFileSync(
      join(store, 'ses-essai.json'),
      JSON.stringify({ sessionId: 'ses-essai', cwd: tmpdir(), title: 'Essai', history: [] })
    )
    const listed = await agentSessions({
      profile: {
        ...profile,
        command: process.execPath,
        args: [MOCK_AGENT_ENTRY, '--store', store]
      },
      only: undefined,
      records: [],
      settings: { current: { recentWorkspaces: [] }, credentials: async () => ({}) } as never,
      neutralFolder: tmpdir(),
      clientVersion: undefined,
      hidden: new TrialSessions(file).ids('mock')
    })
    expect(listed.map((s) => s.sessionId)).not.toContain('ses-essai')
  })

  it('au lancement suivant : une à une ; faites ou introuvables oubliées, ratées gardées 3 fois au plus', async () => {
    const trialSessions = new TrialSessions(journalFile())
    for (const sessionId of ['a', 'b', 'c']) trialSessions.add({ profileId: 'mock', sessionId })
    const real = { ...profile, command: process.execPath }
    const deleteSessions = vi.fn(async (): Promise<Record<string, DeleteOutcome>> => ({
      a: 'deleted',
      b: 'missing',
      c: 'failed'
    }))
    const { onboarding } = setup({ trialSessions, deleteSessions, profiles: () => [real] })
    await onboarding.retryPendingDeletes()
    expect(deleteSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionIds: ['a', 'b', 'c'], cwd: '/neutre' })
    )
    expect(trialSessions.ids('mock')).toEqual(['c'])
    deleteSessions.mockImplementation(async () => {
      throw new Error('agent injoignable')
    })
    await onboarding.retryPendingDeletes()
    expect(trialSessions.ids('mock')).toEqual(['c'])
    await onboarding.retryPendingDeletes()
    expect(trialSessions.ids('mock')).toEqual([])
  })

  it('journal vide (agent sans `session/delete`) : aucun agent lancé au démarrage suivant', async () => {
    const deleteSessions = vi.fn(async (): Promise<Record<string, DeleteOutcome>> => ({}))
    const real = { ...profile, command: process.execPath }
    const { onboarding } = setup({ deleteSessions, profiles: () => [real] })
    await onboarding.retryPendingDeletes()
    expect(deleteSessions).not.toHaveBeenCalled()
  })

  it('pas de suppression retentée pendant un essai', async () => {
    const trialSessions = new TrialSessions(journalFile())
    trialSessions.add({ profileId: 'mock', sessionId: 'a' })
    const deleteSessions = vi.fn(async (): Promise<Record<string, DeleteOutcome>> => ({
      a: 'deleted'
    }))
    const real = { ...profile, command: process.execPath }
    const { onboarding } = setup({
      trialSessions,
      deleteSessions,
      profiles: () => [real],
      check: (options) =>
        new Promise((resolve) =>
          options.signal?.addEventListener('abort', () => resolve({ state: 'cancelled' }))
        )
    })
    const pending = onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    await vi.waitFor(() => expect(onboarding['running']).toBeDefined())
    await onboarding.retryPendingDeletes()
    expect(deleteSessions).not.toHaveBeenCalled()
    onboarding.cancel()
    await pending
    await onboarding.retryPendingDeletes()
    expect(deleteSessions).toHaveBeenCalledOnce()
  })

  it('stop() : agent arrêté sur-le-champ, essai annulé, rien qui reste en cours', async () => {
    const stopAgent = vi.fn()
    let signal: AbortSignal | undefined
    const { onboarding, calls } = setup({
      check: (options) => {
        calls.push(options)
        signal = options.signal
        options.onStop?.(stopAgent)
        return new Promise((resolve) =>
          options.signal?.addEventListener('abort', () => resolve({ state: 'cancelled' }))
        )
      }
    })
    const pending = onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    onboarding.stop()
    expect(stopAgent).toHaveBeenCalledOnce()
    expect(signal?.aborted).toBe(true)
    expect(await pending).toEqual({ state: 'cancelled' })
    expect(onboarding['running']).toBeUndefined()
    onboarding.stop()
    expect(stopAgent).toHaveBeenCalledOnce()
  })

  it('restes d’essais d’un lancement précédent : vidés au démarrage', () => {
    const d = mkdtempSync(join(tmpdir(), 'bobine-188-'))
    const left = join(d, 'onboarding-trials', 'essai-abc')
    mkdirSync(left, { recursive: true })
    writeFileSync(join(left, 'note.txt'), 'reste')
    createOnboarding(
      firstLaunchFacts(d),
      { recentWorkspaces: [] },
      false,
      {
        settings: setupSettings(),
        profiles: () => [profile],
        summaries: () => [summary],
        cwd: '/neutre',
        userData: d,
        workspaceOf: () => '',
        runInTerminal: () => 'tab-1',
        version: '0.10.0'
      },
      {}
    )
    expect(existsSync(join(d, 'onboarding-trials'))).toBe(false)
  })

  it('essai : agent lancé dans le dossier réservé, session dans un dossier jetable de l’app', async () => {
    const { onboarding, calls } = setup({ workspaceOf: () => '/projets/meteo' })
    await onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'reply' })
    expect(calls[0]?.cwd).toBe('/neutre')
    expect(calls[0]?.scratchParent).toContain('bobine-188-scratch-')
    expect(JSON.stringify(calls[0])).not.toContain('/projets/meteo')
  })

  it('connexion par une méthode jamais annoncée par l’agent : refusée', async () => {
    const { onboarding } = setup({
      check: async () => ({
        state: 'auth',
        blocker: { kind: 'auth', methods: [{ id: 'sso', name: 'SSO' }], authenticating: false }
      })
    })
    await expect(
      onboarding.check({
        conversationId: 'c1',
        profileId: 'mock',
        level: 'connect',
        authenticate: 'sso'
      })
    ).rejects.toThrow()
    await onboarding.check({ conversationId: 'c1', profileId: 'mock', level: 'connect' })
    await expect(
      onboarding.check({
        conversationId: 'c1',
        profileId: 'mock',
        level: 'connect',
        authenticate: 'evil'
      })
    ).rejects.toThrow('evil')
    await onboarding.check({
      conversationId: 'c1',
      profileId: 'mock',
      level: 'connect',
      authenticate: 'sso'
    })
  })
})

function setupSettings(): OnboardingDeps['settings'] {
  let mark: OnboardingMark | undefined
  return {
    onboarding: () => mark,
    setOnboarding: (next) => (mark = next),
    credentials: async () => ({}),
    keyInfo: () => []
  }
}
