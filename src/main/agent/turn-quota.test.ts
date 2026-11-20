import { mkdtempSync } from 'node:fs'
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
 * Quota gratuit épuisé au tour (fiche 267, N3 de la recette du 2026-11-20) : OpenCode 2.3.0 refuse
 * le message par `-32603` « Internal error: Free usage limit reached… », sans nommer le modèle.
 * Bobine montre la carte « Modèle refusé » (fiche 259) avec « Choisir un autre modèle », pas
 * l'erreur brute en anglais.
 */

/** L'erreur telle que reçue (`profil-recette-266/logs/agents.log`, 07:55:01.908Z). */
const REAL = new RequestError(
  -32603,
  'Internal error: Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.'
)

const model = (current: string): SessionControl => ({
  id: 'model',
  name: 'Model',
  category: 'model',
  type: 'select',
  currentValue: current,
  options: [
    { value: 'opencode/deepseek-v4.1-flash-free', name: 'opencode/DeepSeek V4.1 Flash Free' },
    { value: 'opencode/big-pickle', name: 'opencode/Big Pickle' }
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

describe('turnAuthBlocker : quota gratuit épuisé (fiche 267)', () => {
  const login: AgentBlocker = {
    kind: 'auth',
    methods: [{ id: 'opencode-login', name: 'Login' }],
    authenticating: false
  }
  const blockerOf = (error: unknown) =>
    (error as { code?: unknown }).code === -32000 ? login : undefined
  const free = 'opencode/deepseek-v4.1-flash-free'

  it('profil OpenCode, l’erreur réelle : la carte du modèle de la session, quota épuisé', () => {
    expect(turnAuthBlocker(REAL, blockerOf, opencode, [model(free)])).toEqual({
      kind: 'auth',
      methods: [{ id: 'opencode-login', name: 'Login' }],
      authenticating: false,
      atTurn: true,
      model: {
        id: free,
        name: 'opencode/DeepSeek V4.1 Flash Free',
        unavailable: true,
        quota: true
      }
    })
  })

  it('faux positifs : autre code, phrase citée plus loin, autre texte, pas de modèle, autre profil', () => {
    const at = (error: unknown, controls: SessionControl[] = [model(free)]) =>
      turnAuthBlocker(error, blockerOf, opencode, controls)
    expect(at(new RequestError(-32602, REAL.message))).toBeUndefined()
    expect(
      at(new RequestError(-32603, 'Internal error: tool failed: "Free usage limit reached" quoted'))
    ).toBeUndefined()
    expect(at(new RequestError(-32603, 'Internal error: usage limit'))).toBeUndefined()
    // Sans réglage de modèle (Bob) : rien à nommer, erreur ordinaire.
    expect(at(REAL, [])).toBeUndefined()
    const { quota: _quota, ...withoutQuota } = MODEL_UNAVAILABLE
    expect(
      turnAuthBlocker(REAL, blockerOf, { modelRefusedAtTurn: withoutQuota }, [model(free)])
    ).toBeUndefined()
    expect(turnAuthBlocker(REAL, blockerOf, {}, [model(free)])).toBeUndefined()
    // Sans le préfixe « Internal error: » : reconnu aussi.
    expect(at(new RequestError(-32603, 'Free usage limit reached.'))?.model).toMatchObject({
      quota: true
    })
  })

  it('avis du fil : quota épuisé, marqué « refus »', () => {
    expect(
      authExpiredNotice('OpenCode', { name: 'DeepSeek', unavailable: true, quota: true })
    ).toEqual({
      type: 'notice',
      level: 'warning',
      message: { key: 'agentHost.modelQuota', params: { agent: 'OpenCode', model: 'DeepSeek' } },
      refusal: true
    })
  })
})

function mockProfile(): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'quota-store-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'quota-gratuit', '--delay', '0', '--store', store],
    env: {},
    modelRefusedAtTurn: MODEL_UNAVAILABLE
  }
}

async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('délai dépassé')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('hôte d’agent : quota gratuit épuisé (agent factice, scénario quota-gratuit)', () => {
  it('carte, pas d’erreur brute ; un autre modèle renvoie le message', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'quota-ws-'))
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile: mockProfile(),
      workspace,
      emit: (e) => events.push(e),
      refusedModels: new RefusedModels().of('mock')
    })
    const items = () => events.reduce(reduceTranscript, emptyTranscript).items
    await host.start()
    await host.prompt('Ajoute un test')
    expect(host.snapshot().status).toBe('needs-action')
    expect(host.snapshot().blocker).toMatchObject({
      kind: 'auth',
      atTurn: true,
      model: { id: 'factice-rapide', unavailable: true, quota: true }
    })
    expect(events.some((e) => e.type === 'turn-error')).toBe(false)
    expect(items().flatMap((i) => (i.kind === 'notice' ? [i.message?.key] : []))).toEqual([
      'agentHost.modelQuota'
    ])
    await host.setControl('model', 'factice-precis')
    await waitFor(
      () => host.snapshot().status === 'ready' && items().some((i) => i.kind === 'agent')
    )
    expect(items().flatMap((i) => (i.kind === 'agent' ? [i.text] : []))).toEqual([
      'Ce modèle a encore du quota, je peux répondre.'
    ])
    host.stop()
  })
})
