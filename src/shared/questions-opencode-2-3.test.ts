import { describe, expect, it } from 'vitest'
import type { ElicitationSchema } from './acp-sdk.mts'
import { answerContent, questionsOf } from './questions'

/**
 * Questions d'OpenCode 2.3.0 relevées dans Bobine le 2026-11-16 (fiche 232, journal ACP) : Bobine
 * reconnaît le formulaire et renvoie exactement ce qu'OpenCode a accepté.
 */
const options = (labels: string[], verb: string) =>
  labels.map((l) => ({ const: l, title: l, description: `${verb} ${l}` }))

// `q0` et `q0_custom` : forme relevée en entier ; `q1` : choix multiple ACP (`items.anyOf`).
const schema = {
  type: 'object',
  properties: {
    q0: {
      type: 'string',
      title: 'Langage préféré',
      description: 'Quel est ton langage préféré ?',
      oneOf: options(['TypeScript', 'Rust', 'Go'], 'Choisir')
    },
    q0_custom: { type: 'string', title: 'Langage préféré (other)' },
    q1: {
      type: 'array',
      title: 'Éditeurs utilisés',
      description: 'Quels éditeurs utilises-tu ?',
      items: { anyOf: options(['VS Code', 'Vim', 'Emacs'], 'Sélectionner') }
    }
  }
} as unknown as ElicitationSchema

describe('questions d’OpenCode 2.3.0 (fiche 232)', () => {
  const questions = questionsOf(schema, 'Questions')

  it('deux questions d’un appel : un choix avec « Autre », puis un choix multiple', () => {
    expect(questions?.map((q) => [q.key, q.multi, q.customKey ?? null])).toEqual([
      ['q0', false, 'q0_custom'],
      ['q1', true, null]
    ])
    expect(questions?.[1]?.options[1]).toEqual({
      value: 'Vim',
      label: 'Vim',
      description: 'Sélectionner Vim'
    })
  })

  it('réponses renvoyées telles que relevées : choix, choix multiple, texte libre seul', () => {
    if (!questions) throw new Error('formulaire non reconnu')
    expect(
      answerContent(questions, {
        q0: { picks: ['Go'], custom: '' },
        q1: { picks: ['Vim', 'Emacs'], custom: '' }
      })
    ).toEqual({ q0: 'Go', q1: ['Vim', 'Emacs'] })
    expect(
      answerContent(questions.slice(0, 1), { q0: { picks: [], custom: 'Zig, pour sa simplicité' } })
    ).toEqual({ q0_custom: 'Zig, pour sa simplicité' })
  })
})
