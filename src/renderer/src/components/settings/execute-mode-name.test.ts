import { describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { executeModeName } from './ConversationSettings'

const mode = (options: { value: string; name: string }[]): SessionControl => ({
  id: 'mode',
  name: 'Session Mode',
  category: 'mode',
  type: 'select',
  currentValue: options[0]?.value ?? '',
  options
})

describe('mode d’exécution nommé comme l’agent (fiche 272, recette : « Exécution » / « Build »)', () => {
  it('le nom que l’agent donne à son mode qui n’est ni plan ni ask', () => {
    expect(
      executeModeName([
        mode([
          { value: 'build', name: 'Build' },
          { value: 'plan', name: 'Plan' }
        ])
      ])
    ).toBe('Build')
    expect(
      executeModeName([
        mode([
          { value: 'plan', name: 'Plan' },
          { value: 'ask', name: 'Ask' },
          { value: 'code', name: 'Code' }
        ])
      ])
    ).toBe('Code')
  })

  it('modes inconnus : rien (le mot du glossaire reste)', () => {
    expect(executeModeName(undefined)).toBeUndefined()
    expect(executeModeName([])).toBeUndefined()
  })
})
