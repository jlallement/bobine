import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentBlocker, AgentEvent, SessionControl } from '@shared/agent'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { RequestError } from '../../shared/acp-sdk.mts'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import type { AgentProfile } from './profiles'
import { RefusedModels } from './refused-models'
import { TurnAuth, authExpiredNotice, turnAuthBlocker } from './turn-auth'

/**
 * Modèle refusé faute de connexion (fiche 210) : la carte nomme le modèle, un autre modèle choisi
 * renvoie le message une fois dans la même session, et le modèle refusé est retenu pour le profil.
 */
const AUTH = /authentication required/i

function profile(scenario: string): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'model-auth-store-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', store],
    env: {},
    terminalSteps: {
      'mock-login': { label: 'Se connecter', command: 'touch .mock-agent-logged-in' }
    },
    authAtTurn: { pattern: AUTH }
  }
}

function setup(scenario: string) {
  const workspace = mkdtempSync(join(tmpdir(), 'model-auth-ws-'))
  const events: AgentEvent[] = []
  const refused = new RefusedModels()
  const host = new AgentHost({
    profile: profile(scenario),
    workspace,
    emit: (e) => events.push(e),
    refusedModels: refused.of('mock')
  })
  const items = () => events.reduce(reduceTranscript, emptyTranscript).items
  const users = () => items().filter((i) => i.kind === 'user').length
  const replies = () => items().flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
  const marked = () =>
    (host.snapshot().controls.find((c) => c.category === 'model')?.options ?? [])
      .filter((o) => o.authRequired)
      .map((o) => o.value)
  const login = () => writeFileSync(join(workspace, '.mock-agent-logged-in'), '')
  return { host, events, refused, users, replies, marked, login }
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('délai dépassé')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('modèle refusé faute de connexion (fiche 210)', () => {
  it('carte avec le modèle ; un autre modèle choisi renvoie le message une fois, même session', async () => {
    const { host, events, refused, users, replies, marked } = setup('connexion-expiree-modele')
    await host.start()
    const sessionId = host.currentSessionId
    await host.prompt('Ajoute un test')
    expect(host.snapshot().status).toBe('needs-action')
    expect(host.snapshot().blocker).toMatchObject({
      kind: 'auth',
      atTurn: true,
      model: { id: 'factice-rapide', name: 'Factice rapide' }
    })
    expect(events).toContainEqual({
      type: 'notice',
      level: 'warning',
      message: {
        key: 'agentHost.modelAuthRefused',
        params: { agent: 'Agent factice', model: 'Factice rapide' }
      }
    })
    expect(refused.has('mock', 'factice-rapide')).toBe(true)
    expect(marked()).toEqual(['factice-rapide'])
    // Un autre réglage que le modèle : refusé tant que la carte est là.
    await expect(host.setControl('verbose', true)).rejects.toThrow()

    await host.setControl('model', 'factice-precis')
    await waitFor(() => events.some((e) => e.type === 'turn-end'))
    await waitFor(() => host.snapshot().status === 'ready')
    expect(host.currentSessionId).toBe(sessionId)
    expect(users()).toBe(1)
    expect(replies()).toEqual(['Ce modèle est connecté, je peux répondre.'])
    expect(events.filter((e) => e.type === 'resent')).toHaveLength(1)
    // Le modèle refusé reste marqué, celui qui a répondu ne l'est pas.
    expect(marked()).toEqual(['factice-rapide'])
    // Une seule fois : plus rien à renvoyer.
    await expect(host.retrySession()).rejects.toThrow()
    host.stop()
  })

  it('aucun modèle ne répond : la carte revient avec le nouveau modèle, les deux marqués', async () => {
    const { host, events, users, marked } = setup('connexion-expiree-modele-aucun')
    await host.start()
    await host.prompt('Ajoute un test')
    await host.setControl('model', 'factice-precis')
    await waitFor(() => host.snapshot().status === 'needs-action')
    expect(host.snapshot().blocker).toMatchObject({
      atTurn: true,
      model: { id: 'factice-precis' }
    })
    expect(users()).toBe(1)
    expect(events.filter((e) => e.type === 'turn-error')).toHaveLength(0)
    expect(marked()).toEqual(['factice-rapide', 'factice-precis'])
    host.stop()
  })

  it('« Réessayer » pendant le changement de modèle : le message part une fois, jamais perdu', async () => {
    const { host, events, users, replies, login } = setup('connexion-expiree-modele')
    await host.start()
    await host.prompt('Ajoute un test')
    // Le réglage met du temps à revenir ; entre-temps, l'utilisateur se connecte et réessaie.
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const apply = vi
      .spyOn(
        AgentHost.prototype as unknown as { applyControl: () => Promise<void> },
        'applyControl'
      )
      .mockImplementationOnce(() => gate)
    try {
      const change = host.setControl('model', 'factice-precis')
      login()
      const retry = host.retrySession()
      // Le réglage revient pendant la réouverture : le message attend son renvoi, pas ce chemin-ci.
      await waitFor(() => host.snapshot().status === 'starting')
      release()
      await change
      await retry
      await waitFor(() => replies().length === 1 && host.snapshot().status === 'ready')
      expect(replies()).toEqual(['Reconnecté, je peux répondre.'])
      expect(users()).toBe(1)
      expect(events.filter((e) => e.type === 'resent')).toHaveLength(1)
    } finally {
      apply.mockRestore()
      host.stop()
    }
  })

  it('« Réessayer » de la carte (reconnexion) : plus aucun modèle marqué pour ce profil', async () => {
    const { host, refused, marked } = setup('connexion-expiree-modele-aucun')
    refused.add('autre', 'factice-rapide')
    await host.start()
    await host.prompt('Ajoute un test')
    refused.add('mock', 'factice-precis')
    expect(marked()).toEqual(['factice-rapide', 'factice-precis'])
    await host.retrySession()
    // Refusé de nouveau (toujours pas connecté) : le modèle de la session est remarqué, seul.
    await waitFor(() => host.snapshot().status === 'needs-action')
    expect(marked()).toEqual(['factice-rapide'])
    expect(refused.has('autre', 'factice-rapide')).toBe(true)
    host.stop()
  })

  it('tour réussi avec un modèle marqué : la marque disparaît', async () => {
    const { host, refused, marked } = setup('connexion-expiree-modele')
    refused.add('mock', 'factice-precis')
    await host.start()
    await host.setControl('model', 'factice-precis')
    expect(marked()).toEqual(['factice-precis'])
    await host.prompt('Bonjour')
    expect(host.snapshot().status).toBe('ready')
    expect(marked()).toEqual([])
    host.stop()
  })
})

describe('turnAuthBlocker avec un modèle (fiche 210)', () => {
  const blocker: AgentBlocker = { kind: 'auth', methods: [], authenticating: false }
  const expired = RequestError.authRequired(undefined, 'provider authentication required')
  const rule = { authAtTurn: { pattern: AUTH } }
  const model: SessionControl = {
    id: 'model',
    name: 'Modèle',
    category: 'model',
    type: 'select',
    currentValue: 'openai/gpt-5.2',
    options: [
      { value: 'opencode/big-pickle', name: 'OpenCode Zen/Big Pickle' },
      { value: 'openai/gpt-5.2', name: 'OpenAI/GPT-5.2' }
    ]
  }

  it('le modèle choisi, tel quel (identifiant jamais découpé) ; sans réglage de modèle, rien', () => {
    expect(turnAuthBlocker(expired, () => blocker, rule, [model])).toMatchObject({
      atTurn: true,
      model: { id: 'openai/gpt-5.2', name: 'OpenAI/GPT-5.2' }
    })
    expect(turnAuthBlocker(expired, () => blocker, rule, [])).not.toHaveProperty('model')
    expect(turnAuthBlocker(expired, () => blocker, rule)).not.toHaveProperty('model')
  })

  it('seul le réglage du modèle, sur la carte d’un tour, renvoie le message', () => {
    const atTurn: AgentBlocker = { ...blocker, atTurn: true }
    expect(TurnAuth.retriesWithModel(atTurn, [model], 'model')).toBe(true)
    expect(TurnAuth.retriesWithModel(atTurn, [model], 'mode')).toBe(false)
    expect(TurnAuth.retriesWithModel(blocker, [model], 'model')).toBe(false)
    expect(TurnAuth.retriesWithModel(undefined, [model], 'model')).toBe(false)
    expect(TurnAuth.retriesWithModel(atTurn, [], 'model')).toBe(false)
  })

  it('avis du fil : avec le modèle, sinon celui d’avant', () => {
    expect(authExpiredNotice('OpenCode', { name: 'GPT' })).toMatchObject({
      message: { key: 'agentHost.modelAuthRefused', params: { agent: 'OpenCode', model: 'GPT' } }
    })
    expect(authExpiredNotice('Bob')).toMatchObject({
      message: { key: 'agentHost.authExpired', params: { agent: 'Bob' } }
    })
  })
})
