import { describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { MAX_RECENT_MODELS, noteModels, parseModelsSeen } from './models-seen'

const control = (current: string): SessionControl => ({
  id: 'model',
  name: 'Model',
  category: 'model',
  type: 'select',
  currentValue: current,
  options: [
    { value: 'a/un', name: 'A/Un' },
    { value: 'a/deux', name: 'A/Deux', group: 'g' }
  ]
})

describe('modèles retenus par agent (fiche 108)', () => {
  it('liste et modèle en cours retenus ; rien si rien ne change ou sans réglage de modèle', () => {
    const first = noteModels(undefined, [control('a/un')])
    expect(first).toEqual({
      controlId: 'model',
      options: [
        { value: 'a/un', name: 'A/Un' },
        { value: 'a/deux', name: 'A/Deux' }
      ],
      recent: ['a/un']
    })
    expect(noteModels(first, [control('a/un')])).toBeUndefined()
    expect(noteModels(first, [])).toBeUndefined()
    expect(noteModels(first, [control('a/deux')])?.recent).toEqual(['a/deux', 'a/un'])
  })

  it('derniers modèles bornés, le plus récent d’abord, sans doublon', () => {
    let seen = noteModels(undefined, [control('m1')])
    for (const value of ['m2', 'm3', 'm4', 'm2']) {
      seen = noteModels(seen, [control(value)]) ?? seen
    }
    expect(seen?.recent).toEqual(['m2', 'm4', 'm3'])
    expect(seen?.recent).toHaveLength(MAX_RECENT_MODELS)
  })

  it('lecture de settings.json : entrées mal formées ignorées', () => {
    expect(
      parseModelsSeen({
        opencode: {
          controlId: 'model',
          options: [{ value: 'a/un', name: 'Un' }, { value: 3 }, 'x'],
          recent: ['a/un', 4, '', 'b', 'c', 'd']
        },
        cassé: { options: [] },
        rien: null
      })
    ).toEqual({
      opencode: {
        controlId: 'model',
        options: [{ value: 'a/un', name: 'Un' }],
        recent: ['a/un', 'b', 'c']
      }
    })
    expect(parseModelsSeen('non')).toEqual({})
  })
})
