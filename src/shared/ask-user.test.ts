import { describe, expect, it } from 'vitest'
import { askUserResult, askUserSchema, parseAskUserArgs } from './ask-user'
import { questionsOf } from './questions'

describe('outil ask_user', () => {
  it('arguments : forme réelle de Bob 2.0.6, choix en texte simple, doublons écartés', () => {
    expect(
      parseAskUserArgs({
        question: 'Quel shell ?',
        options: [{ label: 'bash', description: 'Bourne Again Shell' }, 'zsh', 'zsh'],
        multiSelect: false
      })
    ).toEqual({
      question: 'Quel shell ?',
      options: [{ label: 'bash', description: 'Bourne Again Shell' }, { label: 'zsh' }],
      multiSelect: false,
      allowOther: true
    })
  })

  it('arguments invalides : erreur lisible pour l’agent', () => {
    expect(() => parseAskUserArgs(null)).toThrow('manquants')
    expect(() => parseAskUserArgs({ options: ['a'] })).toThrow('question')
    expect(() => parseAskUserArgs({ question: 'Q', options: 'a' })).toThrow('liste')
    expect(() => parseAskUserArgs({ question: 'Q', options: [] })).toThrow('Au moins')
  })

  it('schéma : reconnu comme questionnaire (carte de la fiche 016)', () => {
    const single = askUserSchema(
      parseAskUserArgs({ question: 'Quel shell ?', header: 'Shell', options: ['bash', 'zsh'] })
    )
    expect(questionsOf(single, 'Quel shell ?')).toEqual([
      {
        key: 'answer',
        header: 'Shell',
        text: 'Quel shell ?',
        multi: false,
        customKey: 'answer_custom',
        options: [
          { value: 'bash', label: 'bash' },
          { value: 'zsh', label: 'zsh' }
        ]
      }
    ])
    const multi = askUserSchema(
      parseAskUserArgs({
        question: 'Pages ?',
        options: ['a', 'b'],
        multiSelect: true,
        allowOther: false
      })
    )
    expect(questionsOf(multi, 'Pages ?')?.[0]).toMatchObject({ multi: true })
    expect(questionsOf(multi, 'Pages ?')?.[0]).not.toHaveProperty('customKey')
  })

  it('résultat renvoyé à l’agent', () => {
    expect(askUserResult('accept', { answer: 'zsh' }).text).toBe('The user chose: zsh.')
    expect(askUserResult('accept', { answer: ['a', 'b'], answer_custom: ' c ' }).text).toBe(
      'The user chose: a, b.\nThe user wrote: c'
    )
    expect(askUserResult('decline', undefined).text).toContain('skipped')
    expect(askUserResult('cancel', undefined)).toMatchObject({ isError: true })
  })
})
