import { describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { MAX_RECENT_MODELS, noteModels, noteUsedModel, parseModelsSeen } from './models-seen'

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
  it('liste retenue à chaque instantané ; le modèle en cours n’entre pas dans les récents (E7)', () => {
    const first = noteModels(undefined, [control('a/un')])
    expect(first).toEqual({
      controlId: 'model',
      options: [
        { value: 'a/un', name: 'A/Un' },
        { value: 'a/deux', name: 'A/Deux' }
      ],
      recent: []
    })
    expect(noteModels(first, [control('a/un')])).toBeUndefined()
    expect(noteModels(first, [])).toBeUndefined()
    // Choisi dans la puce, ou refusé au premier message : pas un modèle « récent ».
    expect(noteModels(first, [control('a/deux')])).toBeUndefined()
  })

  it('un modèle entre dans les récents quand un tour a réussi avec lui (E7)', () => {
    const answered = noteUsedModel(undefined, [control('a/un')])
    expect(answered?.recent).toEqual(['a/un'])
    expect(noteUsedModel(answered, [control('a/un')])).toBeUndefined()
    expect(noteUsedModel(answered, [control('a/deux')])?.recent).toEqual(['a/deux', 'a/un'])
    // Un instantané ensuite garde les récents.
    expect(noteModels(answered, [control('a/deux')])).toBeUndefined()
  })

  it('derniers modèles bornés, le plus récent d’abord, sans doublon', () => {
    let seen = noteUsedModel(undefined, [control('m1')])
    for (const value of ['m2', 'm3', 'm4', 'm2']) {
      seen = noteUsedModel(seen, [control(value)]) ?? seen
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
