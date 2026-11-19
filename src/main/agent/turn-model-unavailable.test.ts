import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentBlocker, AgentEvent, SessionControl } from '@shared/agent'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { RequestError } from '../../shared/acp-sdk.mts'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import { MODEL_UNAVAILABLE } from './opencode-contract'
import { resolveProfiles, type AgentProfile } from './profiles'
import { RefusedModels } from './refused-models'
import { authExpiredNotice, turnAuthBlocker } from './turn-auth'

/**
 * Modèle indisponible au tour (fiche 259, D6 de l'exploration du 2026-11-19) : OpenCode 2.3.0
 * refuse le message par `-32603` « Internal error: Model unavailable: <modèle> ». Bobine montre la
 * carte « Modèle refusé » de la fiche 210, pas l'erreur brute, et l'avis d'un refus précédent est
 * retiré dès que l'agent répond autrement.
 */

/** L'erreur telle que reçue (`explo-sol-traces/agents.log`, 19:13:17.558Z). */
const REAL = new RequestError(-32603, 'Internal error: Model unavailable: openai/gpt-6.2-sol')

const AUTH = /authentication required/i

const model = (current: string): SessionControl => ({
  id: 'model',
  name: 'Model',
  category: 'model',
  type: 'select',
  currentValue: current,
  options: [
    { value: 'openai/gpt-6.1-sol', name: 'OpenAI/GPT-6.1 Sol' },
    { value: 'openai/gpt-6.2-sol', name: 'OpenAI/GPT-6.2 Sol' },
    { value: 'openai/gpt-6.2', name: 'OpenAI/GPT-6.2' }
  ]
})

const opencode = (() => {
  const found = resolveProfiles({
    appPath: join(__dirname, '../../..'),
    execPath: process.execPath,
    isPackaged: false,
    env: {}
  }).find((p) => p.id === 'opencode')
  if (!found) throw new Error('profil OpenCode absent')
  return found
})()

describe('turnAuthBlocker : modèle indisponible (fiche 259)', () => {
  const login: AgentBlocker = {
    kind: 'auth',
    methods: [{ id: 'opencode-login', name: 'Login' }],
    authenticating: false
  }
  /** Comme `sessionBlocker` : seul `authRequired` est une connexion. */
  const blockerOf = (error: unknown) =>
    (error as { code?: unknown }).code === -32000 ? login : undefined

  it('profil OpenCode, l’erreur réelle : la carte du modèle refusé, marquée indisponible', () => {
    expect(turnAuthBlocker(REAL, blockerOf, opencode, [model('openai/gpt-6.2-sol')])).toEqual({
      kind: 'auth',
      methods: [{ id: 'opencode-login', name: 'Login' }],
      authenticating: false,
      atTurn: true,
      model: { id: 'openai/gpt-6.2-sol', name: 'OpenAI/GPT-6.2 Sol', unavailable: true }
    })
  })

  it('un détail joint dans `data` ne gêne pas la reconnaissance', () => {
    const withData = new RequestError(-32603, REAL.message, { details: 'ProviderModelNotFound' })
    expect(
      turnAuthBlocker(withData, blockerOf, opencode, [model('openai/gpt-6.2-sol')])
    ).toMatchObject({ model: { id: 'openai/gpt-6.2-sol', unavailable: true } })
  })

  it('faux positifs : autre modèle, préfixe, autre code, autre texte, pas de modèle', () => {
    const at = (error: unknown, controls: SessionControl[]) =>
      turnAuthBlocker(error, blockerOf, opencode, controls)
    // Un autre modèle que celui de la session (un sous-agent…) : pas cette carte.
    expect(at(REAL, [model('openai/gpt-6.1-sol')])).toBeUndefined()
    // Identifiant entier, jamais un préfixe.
    expect(at(REAL, [model('openai/gpt-6.2')])).toBeUndefined()
    expect(
      at(new RequestError(-32603, 'Internal error: Model unavailable: openai/gpt-6.2-sol-x'), [
        model('openai/gpt-6.2-sol')
      ])
    ).toBeUndefined()
    // Même texte sous un autre code.
    expect(
      at(new RequestError(-32602, REAL.message), [model('openai/gpt-6.2-sol')])
    ).toBeUndefined()
    // Un `-32603` quelconque.
    expect(
      at(new RequestError(-32603, 'Internal error: socket hang up'), [model('openai/gpt-6.2-sol')])
    ).toBeUndefined()
    // Session sans réglage de modèle (Bob) : rien à nommer, erreur ordinaire.
    expect(at(REAL, [])).toBeUndefined()
  })

  it('profil sans la règle : erreur de tour ordinaire (rien de supposé)', () => {
    const bobLike: Pick<AgentProfile, 'authAtTurn' | 'modelRefusedAtTurn'> = {
      authAtTurn: { pattern: AUTH }
    }
    expect(turnAuthBlocker(REAL, blockerOf, bobLike, [model('openai/gpt-6.2-sol')])).toBeUndefined()
    expect(turnAuthBlocker(REAL, blockerOf, {}, [model('openai/gpt-6.2-sol')])).toBeUndefined()
  })

  it('le refus de connexion reste reconnu comme avant, sans la marque', () => {
    const expired = RequestError.authRequired(undefined, 'provider authentication required')
    const card = turnAuthBlocker(expired, blockerOf, opencode, [model('openai/gpt-6.2-sol')])
    expect(card?.model).toEqual({ id: 'openai/gpt-6.2-sol', name: 'OpenAI/GPT-6.2 Sol' })
  })

  it('avis du fil : indisponible, marqué « refus »', () => {
    expect(authExpiredNotice('OpenCode', { name: 'GPT', unavailable: true })).toEqual({
      type: 'notice',
      level: 'warning',
      message: { key: 'agentHost.modelUnavailable', params: { agent: 'OpenCode', model: 'GPT' } },
      refusal: true
    })
  })

  it('le motif d’OpenCode garde l’identifiant entier', () => {
    expect(MODEL_UNAVAILABLE.pattern.exec(REAL.message)?.[1]).toBe('openai/gpt-6.2-sol')
    expect(MODEL_UNAVAILABLE.code).toBe(REAL.code)
  })
})

function mockProfile(scenario: string): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'model-unavailable-store-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', store],
    env: {},
    terminalSteps: {
      'mock-login': { label: 'Se connecter', command: 'touch .mock-agent-logged-in' }
    },
    authAtTurn: { pattern: AUTH },
    modelRefusedAtTurn: MODEL_UNAVAILABLE
  }
}

function setup(profile: AgentProfile) {
  const workspace = mkdtempSync(join(tmpdir(), 'model-unavailable-ws-'))
  const events: AgentEvent[] = []
  const refused = new RefusedModels()
  const host = new AgentHost({
    profile,
    workspace,
    emit: (e) => events.push(e),
    refusedModels: refused.of('mock')
  })
  const items = () => events.reduce(reduceTranscript, emptyTranscript).items
  const notices = () =>
    items().flatMap((i) => (i.kind === 'notice' ? [{ key: i.message?.key, level: i.level }] : []))
  const replies = () => items().flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
  const login = () => writeFileSync(join(workspace, '.mock-agent-logged-in'), '')
  return { host, events, refused, notices, replies, login }
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('délai dépassé')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('hôte d’agent : modèle indisponible au tour (agent factice)', () => {
  it('carte, pas d’erreur rouge ; un autre modèle renvoie le message, l’avis est retiré', async () => {
    const { host, events, refused, notices, replies } = setup(mockProfile('modele-indisponible'))
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    expect(host.snapshot().status).toBe('needs-action')
    expect(host.snapshot().blocker).toMatchObject({
      kind: 'auth',
      atTurn: true,
      model: { id: 'factice-rapide', name: 'Factice rapide', unavailable: true }
    })
    expect(events.some((e) => e.type === 'turn-error')).toBe(false)
    expect(notices()).toEqual([{ key: 'agentHost.modelUnavailable', level: 'warning' }])
    // Pas une connexion à faire : le sélecteur ne le marque pas.
    expect(refused.has('mock', 'factice-rapide')).toBe(false)

    await host.setControl('model', 'factice-precis')
    await waitFor(() => replies().length === 1 && host.snapshot().status === 'ready')
    expect(host.currentSessionId).toBe(sessionId)
    expect(replies()).toEqual(['Ce modèle est disponible, je peux répondre.'])
    expect(events.filter((e) => e.type === 'resent')).toHaveLength(1)
    // L'agent a répondu : l'avis du refus n'est plus vrai.
    expect(notices()).toEqual([])
    host.stop()
  })

  it('parcours D6 : refus de connexion, connexion, « Réessayer » → carte indisponible, un seul avis', async () => {
    const { host, events, notices, replies, login } = setup(
      mockProfile('modele-indisponible-apres-connexion')
    )
    await host.start()
    await host.prompt('Ajoute un test')
    expect(host.snapshot().blocker).toMatchObject({ atTurn: true, model: { id: 'factice-rapide' } })
    expect(host.snapshot().blocker).not.toHaveProperty('model.unavailable')
    expect(notices()).toEqual([{ key: 'agentHost.modelAuthRefused', level: 'warning' }])

    login()
    await host.retrySession()
    await waitFor(() => host.snapshot().status === 'needs-action')
    expect(host.snapshot().blocker).toMatchObject({
      atTurn: true,
      model: { id: 'factice-rapide', unavailable: true }
    })
    expect(events.some((e) => e.type === 'turn-error')).toBe(false)
    // L'avis « pas connecté » est remplacé : on vient de se connecter.
    expect(notices()).toEqual([{ key: 'agentHost.modelUnavailable', level: 'warning' }])

    await host.setControl('model', 'factice-precis')
    await waitFor(() => replies().length === 1 && host.snapshot().status === 'ready')
    expect(notices()).toEqual([])
    host.stop()
  })

  it('profil sans la règle : l’erreur de tour d’avant, telle quelle', async () => {
    const { modelRefusedAtTurn: _rule, ...profile } = mockProfile('modele-indisponible')
    const { host, events } = setup(profile)
    await host.start()
    await host.prompt('Ajoute un test')
    expect(host.snapshot().status).toBe('ready')
    expect(events).toContainEqual({
      type: 'turn-error',
      message: 'Internal error: Model unavailable: factice-rapide'
    })
    host.stop()
  })
})
