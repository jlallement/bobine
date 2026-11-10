import type { ElicitationSchema } from './acp-sdk.mts'
import { describe, expect, it } from 'vitest'
import { answerContent, describeAnswer, isAnswered, questionsOf } from './questions'

/**
 * Deux questions au format générique (celui de claude-agent-acp 0.89.1, dont l'aperçu d'option en
 * `_meta` n'est plus lu : fiche 140).
 */
const claude = {
  type: 'object',
  properties: {
    question_0: {
      type: 'string',
      title: 'Couleur',
      description: 'Ta couleur préférée ?',
      oneOf: [
        {
          const: 'Rouge',
          title: 'Rouge',
          description: 'Chaud',
          _meta: { '_claude/askUserQuestionOption': { preview: '■' } }
        },
        { const: 'Bleu', title: 'Bleu' }
      ]
    },
    question_0_custom: { type: 'string', title: 'Other' },
    question_1: {
      type: 'array',
      title: 'Fruits',
      description: 'Quels fruits ?',
      items: {
        anyOf: [
          { const: 'Pomme', title: 'Pomme' },
          { const: 'Kiwi', title: 'Kiwi' }
        ]
      }
    },
    question_1_custom: { type: 'string', title: 'Other' }
  }
} as unknown as ElicitationSchema

describe('questionsOf', () => {
  it('reconnaît les questions à choix et leurs champs « Autre » ; `_meta` ignoré', () => {
    const questions = questionsOf(claude, 'Please answer the following questions.')
    expect(questions).toEqual([
      {
        key: 'question_0',
        header: 'Couleur',
        text: 'Ta couleur préférée ?',
        multi: false,
        customKey: 'question_0_custom',
        options: [
          { value: 'Rouge', label: 'Rouge', description: 'Chaud' },
          { value: 'Bleu', label: 'Bleu' }
        ]
      },
      {
        key: 'question_1',
        header: 'Fruits',
        text: 'Quels fruits ?',
        multi: true,
        customKey: 'question_1_custom',
        options: [
          { value: 'Pomme', label: 'Pomme' },
          { value: 'Kiwi', label: 'Kiwi' }
        ]
      }
    ])
  })

  it('une seule question : le texte vient du message', () => {
    const schema = {
      type: 'object',
      properties: { q: { type: 'string', title: 'Choix', enum: ['a', 'b'] } }
    } as ElicitationSchema
    expect(questionsOf(schema, 'Lequel ?')?.[0]?.text).toBe('Lequel ?')
  })

  it('un `_meta` d’agent ne fait rien : note de Codex, rôles inversés (fiche 140)', () => {
    const codex = {
      type: 'object',
      properties: {
        shell: {
          title: 'Which shell?',
          description: 'Shell',
          _meta: { codex: { isOther: true } },
          type: 'string',
          oneOf: [{ const: 'bash', title: 'bash', description: 'Bash shebang.' }]
        },
        shell_note: {
          type: 'string',
          title: 'Additional answer or note',
          _meta: { codex: { questionId: 'shell', role: 'user_note' } }
        }
      },
      required: ['shell']
    } as unknown as ElicitationSchema
    // Le champ de note n'est pas un « Autre » générique : formulaire générique.
    expect(questionsOf(codex, 'm')).toBeUndefined()
    const marked = {
      type: 'object',
      properties: {
        choix: { type: 'string', enum: ['a', 'b'] },
        libre: { type: 'string', _meta: { customAnswer: { questionId: 'choix' } } }
      }
    } as unknown as ElicitationSchema
    expect(questionsOf(marked, 'm')).toBeUndefined()
  })

  it('question obligatoire au format générique : `required`, « Autre » en `<clé>_custom`', () => {
    const schema = {
      type: 'object',
      properties: {
        shell: {
          title: 'Shell',
          description: 'Which shell?',
          type: 'string',
          oneOf: [{ const: 'bash', title: 'bash', description: 'Bash shebang.' }]
        },
        shell_custom: { type: 'string', title: 'Other' }
      },
      required: ['shell']
    } as unknown as ElicitationSchema
    expect(questionsOf(schema, 'Question')).toEqual([
      {
        key: 'shell',
        header: 'Shell',
        text: 'Which shell?',
        multi: false,
        customKey: 'shell_custom',
        required: true,
        options: [{ value: 'bash', label: 'bash', description: 'Bash shebang.' }]
      }
    ])
  })

  it('forme d’OpenCode 2.0.31 (outil question) : q0 et q0_custom (fiche 078)', () => {
    const opencode = {
      type: 'object',
      properties: {
        q0: {
          type: 'string',
          title: 'Langage préféré',
          description: 'Quel langage préfères-tu ?',
          oneOf: [
            { const: 'TypeScript', title: 'TypeScript', description: 'JavaScript typé' },
            { const: 'Rust', title: 'Rust' }
          ]
        },
        q0_custom: {
          type: 'string',
          title: 'Langage préféré (other)',
          description: 'Type your own answer'
        }
      },
      required: []
    } as unknown as ElicitationSchema
    expect(questionsOf(opencode, 'Questions')).toEqual([
      {
        key: 'q0',
        header: 'Langage préféré',
        text: 'Quel langage préfères-tu ?',
        multi: false,
        options: [
          { value: 'TypeScript', label: 'TypeScript', description: 'JavaScript typé' },
          { value: 'Rust', label: 'Rust' }
        ],
        customKey: 'q0_custom'
      }
    ])
  })

  it('formulaire avec d’autres champs : pas un questionnaire', () => {
    const schema = {
      type: 'object',
      properties: {
        env: { type: 'string', enum: ['dev', 'prod'] },
        instances: { type: 'integer' }
      }
    } as ElicitationSchema
    expect(questionsOf(schema, 'm')).toBeUndefined()
    const textOnly = {
      type: 'object',
      properties: { nom: { type: 'string' } }
    } as ElicitationSchema
    expect(questionsOf(textOnly, 'm')).toBeUndefined()
  })
})

describe('réponses', () => {
  const questions = questionsOf(claude, 'm') ?? []

  it('answerContent : choix, cases cochées, texte libre ; rien pour une question passée', () => {
    expect(
      answerContent(questions, {
        question_0: { picks: ['Bleu'], custom: '  plutôt marine ' },
        question_1: { picks: ['Pomme', 'Kiwi', 'Inconnu'], custom: '' }
      })
    ).toEqual({
      question_0: 'Bleu',
      question_0_custom: 'plutôt marine',
      question_1: ['Pomme', 'Kiwi']
    })
    expect(answerContent(questions, {})).toEqual({})
  })

  it('isAnswered : une option ou un texte libre', () => {
    const [q0] = questions
    if (!q0) throw new Error('question manquante')
    expect(isAnswered(q0, undefined)).toBe(false)
    expect(isAnswered(q0, { picks: [], custom: ' ' })).toBe(false)
    expect(isAnswered(q0, { picks: [], custom: 'vert' })).toBe(true)
    expect(isAnswered(q0, { picks: ['Rouge'], custom: '' })).toBe(true)
  })

  it('describeAnswer : libellés et texte libre', () => {
    const [q0, q1] = questions
    if (!q0 || !q1) throw new Error('questions manquantes')
    expect(describeAnswer(q0, { question_0: 'Rouge', question_0_custom: 'vif' })).toBe(
      'Rouge, «\u00a0vif\u00a0»'
    )
    expect(describeAnswer(q1, { question_1: ['Pomme', 'Kiwi'] })).toBe('Pomme, Kiwi')
    expect(describeAnswer(q1, {})).toBeUndefined()
  })
})
