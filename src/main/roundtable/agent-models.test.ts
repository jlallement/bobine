import { afterEach, describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { AgentModels, RETRY_MS } from './agent-models'
import { roundtableOptions } from './options'
import { motherWithExchange, roundtableEnv, type RoundtableEnv } from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

const models: SessionControl = {
  id: 'model',
  name: 'Modèle',
  category: 'model',
  type: 'select',
  currentValue: 'a',
  options: [{ value: 'a', name: 'A' }]
}

describe('modèles d’un agent sans session (contre-recette N2)', () => {
  it('chargement, puis les modèles de l’agent dans le menu, sans ligne nue', async () => {
    const env = await roundtableEnv({
      profiles: (mock) => [mock('neuf', 'avis-participant')]
    })
    envs.push(env)
    const mother = await motherWithExchange(env)
    const agentModels = new AgentModels({
      check: async (id) => (await env.manager.checkAgent(id)).snapshot?.controls,
      note: (id, controls) => env.manager.settings.noteModels(id, controls)
    })
    const deps = {
      conversations: env.manager,
      children: env.children,
      providers: () => [],
      models: agentModels
    }
    const neuf = () => roundtableOptions(deps, mother).agents.find((a) => a.profileId === 'neuf')
    expect(neuf()).toMatchObject({ modelChoice: true, modelsState: 'loading', others: [] })
    await agentModels.settled('neuf')
    const after = neuf()
    expect(after?.modelsState).toBeUndefined()
    expect([...(after?.recent ?? []), ...(after?.others ?? [])].map((m) => m.value)).toContain(
      'factice-precis'
    )
  })

  it('aucun modèle annoncé : « modèle par défaut », pas de nouvel essai avant le délai', async () => {
    let now = 0
    let calls = 0
    const noted: string[] = []
    const agentModels = new AgentModels({
      check: async () => {
        calls++
        return calls > 1 ? [models] : undefined
      },
      note: (id) => noted.push(id),
      now: () => now
    })
    expect(agentModels.ensure('x')).toBe('loading')
    expect(agentModels.ensure('x')).toBe('loading')
    await agentModels.settled('x')
    expect(agentModels.ensure('x')).toBe('default')
    expect(calls).toBe(1)
    now = RETRY_MS
    expect(agentModels.ensure('x')).toBe('loading')
    await agentModels.settled('x')
    expect(noted).toEqual(['x'])
  })
})
