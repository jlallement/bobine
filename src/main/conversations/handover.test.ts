import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProvidersView } from '@shared/providers'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { continueWith, destinationOf, handoverTargets, targetModels } from './handover'
import { ConversationManager } from './manager'

function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

const llmaas = {
  id: 'llmaas',
  name: 'LLMaaS',
  baseURL: 'https://llm.example/v1',
  models: [
    { id: 'qwen3-32b', name: 'Qwen3 32B' },
    { id: 'mistral-small', name: 'Mistral Small' }
  ],
  enabled: true
}

describe('destination des messages (fiche 108)', () => {
  it('fournisseur déclaré, sinon préfixe, sinon ce que dit le profil, sinon rien', () => {
    expect(destinationOf('llmaas/qwen3-32b', [llmaas], undefined)).toEqual({
      kind: 'provider',
      name: 'LLMaaS',
      url: 'https://llm.example/v1'
    })
    expect(destinationOf('openrouter/meta/llama', [llmaas], 'x')).toEqual({
      kind: 'prefix',
      provider: 'openrouter'
    })
    expect(destinationOf(undefined, [], 'le service d’IBM Bob')).toEqual({
      kind: 'agent',
      text: 'le service d’IBM Bob'
    })
    expect(destinationOf('factice-rapide', [], undefined)).toEqual({ kind: 'unknown' })
  })

  it('modèles : récents, puis fournisseurs déclarés (4 au plus), puis les autres vus', () => {
    const models = targetModels(
      {
        controlId: 'model',
        options: [
          { value: 'opencode/big-pickle', name: 'opencode/Big Pickle' },
          { value: 'llmaas/qwen3-32b', name: 'LLMaaS/Qwen3 32B' },
          { value: 'openai/gpt-6', name: 'openai/GPT-6' },
          { value: 'openai/gpt-6-fast', name: 'openai/GPT-6 Fast' }
        ],
        recent: ['openai/gpt-6', 'opencode/big-pickle']
      },
      [llmaas, { ...llmaas, id: 'off', enabled: false }],
      undefined
    )
    expect(models.map((m) => [m.value, m.featured ?? '-'])).toEqual([
      ['openai/gpt-6', 'recent'],
      ['opencode/big-pickle', 'recent'],
      ['llmaas/qwen3-32b', 'provider'],
      ['llmaas/mistral-small', 'provider'],
      ['openai/gpt-6-fast', '-']
    ])
    // Nom vu chez l'agent s'il l'a déjà montré, sinon celui du fichier.
    expect(models[2]?.name).toBe('LLMaaS/Qwen3 32B')
    expect(models[3]?.name).toBe('LLMaaS/Mistral Small')
    expect(models[2]?.destination).toMatchObject({ kind: 'provider', name: 'LLMaaS' })
    expect(targetModels(undefined, [], 'Bob')).toEqual([])
  })
})

describe('continuer avec un autre agent, contre l’agent factice (fiche 108)', () => {
  function launch() {
    const root = mkdtempSync(join(tmpdir(), 'handover-'))
    const workspace = mkdtempSync(join(tmpdir(), 'ws-handover-'))
    const mock = (id: string, label: string, scenario: string, env = {}): AgentProfile => ({
      id,
      label,
      command: process.execPath,
      args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0'],
      env
    })
    const profiles = [
      { ...mock('bob-like', 'Façon Bob', 'streaming-texte'), destination: 'le service de Bob' },
      mock('peer', 'Façon OpenCode', 'contexte-recu', {
        MOCK_MODELS: 'llmaas/qwen3-32b=LLMaaS/Qwen3 32B'
      })
    ]
    const manager = new ConversationManager({
      profiles,
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
    const providers = (): ProvidersView[] => [
      {
        profileId: 'peer',
        label: 'Façon OpenCode',
        file: '~/opencode.json',
        only: false,
        providers: [
          { ...llmaas, key: { kind: 'none' }, keyStored: false, keyFromEnvironment: false }
        ]
      }
    ]
    const status = (id: string) => manager.view(id).snapshot?.status
    const lastAgent = (id: string) =>
      manager
        .view(id)
        .transcript.items.filter((i) => i.kind === 'agent')
        .at(-1)
    return { manager, providers, status, lastAgent }
  }

  it('même conversation, nouvelle session, modèle réglé, contexte joint une seule fois', async () => {
    const { manager, providers, status, lastAgent } = launch()
    const { activeId: id } = manager.state()
    await manager.startActive()
    // Conversation vide : rien à continuer.
    expect(handoverTargets(manager, providers, id)).toEqual([])
    await manager.prompt(id, 'Bonjour Bob')
    await waitFor(() => status(id) === 'ready')
    const before = manager.view(id)
    const firstSession = manager.view(id).summary

    const [target] = handoverTargets(manager, providers, id)
    expect(target).toMatchObject({
      profileId: 'peer',
      label: 'Façon OpenCode',
      destination: { kind: 'unknown' }
    })
    expect(target?.models[0]).toMatchObject({
      value: 'llmaas/qwen3-32b',
      featured: 'provider',
      destination: { kind: 'provider', url: 'https://llm.example/v1' }
    })

    const view = await continueWith(manager, providers, id, 'peer', 'llmaas/qwen3-32b')
    expect(view.summary).toMatchObject({ id, profileId: 'peer', profileLabel: 'Façon OpenCode' })
    expect(manager.state().activeId).toBe(id)
    expect(view.transcript.items.slice(0, before.transcript.items.length)).toEqual(
      before.transcript.items
    )
    expect(view.transcript.items.at(-1)).toMatchObject({
      kind: 'handover',
      from: { profileId: 'bob-like', label: 'Façon Bob' },
      to: { profileId: 'peer' },
      model: 'LLMaaS/Qwen3 32B'
    })
    const model = view.snapshot?.controls.find((c) => c.category === 'model')
    expect(model?.currentValue).toBe('llmaas/qwen3-32b')
    expect(firstSession.profileId).toBe('bob-like')

    await manager.prompt(id, 'Continue')
    await waitFor(() => status(id) === 'ready' && lastAgent(id)?.kind === 'agent')
    await waitFor(() => (lastAgent(id) as { text: string }).text.includes('Contexte reçu'))
    expect((lastAgent(id) as { text: string }).text).toContain(
      "Contexte reçu de « Façon Bob » : 1 message(s) de l'utilisateur, 1 réponse(s)."
    )
    await manager.prompt(id, 'Encore')
    await waitFor(() => (lastAgent(id) as { text: string }).text.includes('Aucun contexte'))

    // Les modèles de l'agent sont retenus pour la prochaine fois.
    expect(manager.settings.current.models?.['peer']?.recent[0]).toBe('llmaas/qwen3-32b')
    expect(handoverTargets(manager, providers, id).map((t) => t.profileId)).toEqual(['bob-like'])
    manager.stopAll()
  })

  it('refusée pendant une réponse, vers le même agent ou un agent inconnu', async () => {
    const { manager, providers } = launch()
    const { activeId: id } = manager.state()
    await manager.startActive()
    await expect(continueWith(manager, providers, id, 'peer')).rejects.toThrow()
    void manager.prompt(id, '/scenario lent')
    await waitFor(() => manager.view(id).snapshot?.status === 'busy')
    await expect(continueWith(manager, providers, id, 'peer')).rejects.toThrow()
    await manager.cancel(id)
    await expect(continueWith(manager, providers, id, 'bob-like')).rejects.toThrow()
    await expect(continueWith(manager, providers, id, 'inconnu')).rejects.toThrow()
    expect(handoverTargets(manager, providers, id)).toHaveLength(1)
    manager.stopAll()
  })
})
