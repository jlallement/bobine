import { describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { markRefused, RefusedModels } from './refused-models'

describe('modèles refusés faute de connexion (fiche 210)', () => {
  it('retenus par profil et par modèle ; effacés un à un, ou pour tout le profil', () => {
    const refused = new RefusedModels()
    refused.add('opencode', 'openai/gpt-5.2')
    refused.add('opencode', 'anthropic/claude')
    refused.add('autre', 'openai/gpt-5.2')
    expect(refused.has('opencode', 'openai/gpt-5.2')).toBe(true)
    expect(refused.has('opencode', 'opencode/big-pickle')).toBe(false)
    refused.of('opencode').remove('anthropic/claude')
    expect(refused.has('opencode', 'anthropic/claude')).toBe(false)
    refused.of('opencode').clear()
    expect(refused.has('opencode', 'openai/gpt-5.2')).toBe(false)
    expect(refused.has('autre', 'openai/gpt-5.2')).toBe(true)
  })

  const model: SessionControl = {
    id: 'model',
    name: 'Modèle',
    category: 'model',
    type: 'select',
    currentValue: 'a',
    options: [
      { value: 'a', name: 'A' },
      { value: 'b', name: 'B', group: 'G' }
    ]
  }
  const mode: SessionControl = { ...model, id: 'mode', category: 'mode' }

  it('marque les options refusées du seul réglage de modèle, sans rien retirer', () => {
    const refused = new RefusedModels()
    refused.add('p', 'b')
    refused.add('p', 'a')
    const [marked, untouched] = markRefused([model, mode], refused.of('p'))
    expect(marked?.options).toEqual([
      { value: 'a', name: 'A', authRequired: true },
      { value: 'b', name: 'B', group: 'G', authRequired: true }
    ])
    expect(untouched).toBe(mode)
  })

  it('rien de refusé, ou pas de réglage de modèle : les réglages tels quels', () => {
    const controls = [model, mode]
    expect(markRefused(controls, new RefusedModels().of('p'))).toBe(controls)
    expect(markRefused(controls, undefined)).toBe(controls)
    const refused = new RefusedModels()
    refused.add('p', 'a')
    expect(markRefused([mode], refused.of('p'))).toEqual([mode])
  })
})
