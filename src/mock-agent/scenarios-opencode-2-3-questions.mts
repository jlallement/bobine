/**
 * Questions d'OpenCode 2.3.0 (fiche 232), relevées le 2026-11-16 dans Bobine, `opencode acp`,
 * modèle `openai/gpt-6.1-sol`, journal ACP au niveau Trace :
 *
 * - outil `question` (`kind: other`) : `pending {}`, puis `in_progress` avec `rawInput.questions`
 *   (`question`, `header`, `options[{ label, description }]`, `multiple` pour un choix multiple) ;
 *   puis `elicitation/create` « Questions », `toolCallId` = l'appel, `qN` (`oneOf` de `{ const,
 *   title, description }`) et `qN_custom` (texte libre) ;
 * - accepté : `completed`, `rawOutput.metadata.answers` (une liste par question) et « User has
 *   answered your questions: "…"="…", … » ; le modèle continue dans le même tour ;
 * - écarté (`decline`) : `failed`, `rawOutput: { metadata: {}, error: "The user dismissed this
 *   question" }`, et le tour **finit en `cancelled`** (le modèle ne reprend pas) ;
 * - annulé (Stop : `session/cancel` puis `cancel`) : `$/cancel_request`, `failed`, `cancelled` ;
 * - un sous-agent (`general`) n'a pas l'outil `question` : dans Bobine, il pose sa question par
 *   l'outil `ask_user` de Bobine (Code Mode, `execute`), après la fin du tour du parent.
 *
 * Le schéma de la seconde question (choix multiple) est tronqué au journal : sa forme ici est celle
 * du choix multiple ACP (`items.anyOf`), reconnue par Bobine pendant l'essai ; la réponse renvoyée,
 * `{ q0: "Go", q1: ["Vim", "Emacs"] }`, est celle relevée.
 */
import type { SessionUpdate } from '../shared/acp-sdk.mts'
import type { Scenario, Step } from './scenario.mts'

interface Asked {
  question: string
  header: string
  options: { label: string; description: string }[]
  multiple?: boolean
}

const LANGUAGE: Asked = {
  question: 'Quel est ton langage préféré ?',
  header: 'Langage préféré',
  options: ['TypeScript', 'Rust', 'Go'].map((l) => ({ label: l, description: `Choisir ${l}` }))
}
const EDITORS: Asked = {
  question: 'Quels éditeurs utilises-tu ?',
  header: 'Éditeurs utilisés',
  options: ['VS Code', 'Vim', 'Emacs'].map((l) => ({ label: l, description: `Sélectionner ${l}` })),
  multiple: true
}
const FRUIT: Asked = {
  question: 'Quel est ton fruit préféré ?',
  header: 'Fruit préféré',
  options: [
    { label: 'pomme', description: 'Choisir la pomme' },
    { label: 'poire', description: 'Choisir la poire' },
    { label: 'kiwi', description: 'Choisir le kiwi' }
  ]
}

const tool = (id: string, status: 'pending' | 'in_progress', questions?: Asked[]): Step => ({
  kind: 'update',
  update: {
    sessionUpdate: status === 'pending' ? 'tool_call' : 'tool_call_update',
    toolCallId: id,
    title: 'question',
    kind: 'other',
    status,
    rawInput: questions ? { questions } : {}
  } as SessionUpdate
})

/** Formulaire d'élicitation d'OpenCode : `qN` et `qN_custom` par question. */
function schemaOf(questions: Asked[]) {
  const properties: Record<string, unknown> = {}
  questions.forEach((q, i) => {
    const options = q.options.map((o) => ({
      const: o.label,
      title: o.label,
      description: o.description
    }))
    properties[`q${i}`] = q.multiple
      ? { type: 'array', title: q.header, description: q.question, items: { anyOf: options } }
      : { type: 'string', title: q.header, description: q.question, oneOf: options }
    if (!q.multiple) {
      properties[`q${i}_custom`] = {
        type: 'string',
        title: `${q.header} (other)`,
        description: 'Type your own answer'
      }
    }
  })
  return { type: 'object', properties, required: [] }
}

/** Réponses d'une question telles qu'OpenCode les lit : la liste choisie, ou le texte libre. */
function answersOf(content: Record<string, unknown>, questions: Asked[]): string[][] {
  return questions.map((_, i) => {
    const custom = content[`q${i}_custom`]
    if (typeof custom === 'string' && custom.trim()) return [custom.trim()]
    const value = content[`q${i}`]
    return Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)]
  })
}

/** Question posée, puis ce que fait OpenCode 2.3.0 selon la réponse. */
function asking(id: string, questions: Asked[], reply: (answers: string[][]) => string): Step[] {
  const call = `call_${id}`
  return [
    tool(call, 'pending'),
    tool(call, 'in_progress', questions),
    {
      kind: 'elicitation',
      toolCallId: call,
      message: 'Questions',
      schema: schemaOf(questions) as never,
      onAccept: (content) => {
        const answers = answersOf(content, questions)
        const said = questions.map((q, i) => `"${q.question}"="${answers[i]?.join(', ') ?? ''}"`)
        return [
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: call,
              status: 'completed',
              content: [
                {
                  type: 'content',
                  content: {
                    type: 'text',
                    text: `User has answered your questions: ${said.join(', ')}. You can now continue with the user's answers in mind.`
                  }
                }
              ],
              rawOutput: { metadata: { answers, truncated: false } }
            }
          },
          { kind: 'text', text: reply(answers) }
        ]
      },
      // Écartée : l'outil échoue et OpenCode arrête le tour (`cancelled`), sans reprendre.
      onDecline: [
        {
          kind: 'update',
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: call,
            status: 'failed',
            content: [
              {
                type: 'content',
                content: { type: 'text', text: 'The user dismissed this question' }
              }
            ],
            rawOutput: { metadata: {}, error: 'The user dismissed this question' }
          }
        },
        { kind: 'stop-cancelled' }
      ]
    }
  ]
}

export const openCode23QuestionScenarios: Record<string, Scenario> = {
  'questions-opencode-2-3': {
    description:
      'Comme OpenCode 2.3.0 : deux questions d’un seul appel (choix unique avec « Autre », puis choix multiple), réponse rendue et utilisée dans le même tour',
    steps: asking(
      'questions',
      [LANGUAGE, EDITORS],
      ([language, editors]) =>
        `Ton langage préféré est ${language?.join(', ') || '—'} et tu utilises ${editors?.join(' et ') || '—'}.`
    )
  },
  'question-ecartee-opencode-2-3': {
    description:
      'Comme OpenCode 2.3.0 : une question ; « Passer » (decline) fait échouer l’outil et finit le tour en cancelled, sans reprise du modèle',
    steps: asking(
      'fruit',
      [FRUIT],
      ([fruit]) => `Tu préfères ${fruit?.join(', ') || '—'} : un choix plein de vitamines.`
    )
  },
  'sous-agent-question-2-3': {
    description:
      'Comme OpenCode 2.3.0 dans Bobine : un sous-agent en arrière-plan pose sa question par ask_user (pas d’outil question pour lui), après la fin du tour ; la réponse remonte, le parent répond hors tour',
    steps: [
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_couleur',
          title: 'subagent',
          kind: 'think',
          status: 'pending',
          rawInput: {}
        }
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_couleur',
          title: 'subagent',
          kind: 'think',
          status: 'in_progress',
          rawInput: {
            agent: 'general',
            description: 'Demander la couleur préférée',
            prompt:
              'Demande à l’utilisateur sa couleur préférée (rouge, vert, bleu) et rapporte-la.'
          }
        }
      },
      {
        kind: 'child-session',
        sessionId: 'ses_mock_couleur',
        history: [
          {
            sessionUpdate: 'user_message_chunk',
            content: {
              type: 'text',
              text: 'You are a subagent spawned by another session.\nDemande à l’utilisateur sa couleur préférée (rouge, vert, bleu) et rapporte-la.'
            }
          }
        ]
      },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_couleur',
          status: 'completed',
          content: [
            {
              type: 'content',
              content: {
                type: 'text',
                text: 'The subagent is working in the background (sessionID: ses_mock_couleur). You will receive a <subagent> message when it goes idle, and again after each later round of work.'
              }
            }
          ],
          rawOutput: {
            metadata: { sessionID: 'ses_mock_couleur', status: 'running', truncated: false }
          }
        }
      },
      {
        kind: 'text',
        text: 'Le sous-agent est lancé ; il te demandera ta couleur préférée et me rapportera ta réponse.'
      },
      {
        kind: 'after-turn',
        afterMs: 1500,
        steps: [
          {
            kind: 'ask-user',
            silent: true,
            args: {
              question: 'Quelle est votre couleur préférée ?',
              header: 'Couleur préférée',
              options: [{ label: 'rouge' }, { label: 'vert' }, { label: 'bleu' }]
            },
            onResult: (answer) => [
              {
                kind: 'child-session',
                sessionId: 'ses_mock_couleur',
                history: [
                  {
                    sessionUpdate: 'user_message_chunk',
                    content: {
                      type: 'text',
                      text: 'You are a subagent spawned by another session.\nDemande à l’utilisateur sa couleur préférée (rouge, vert, bleu) et rapporte-la.'
                    }
                  },
                  {
                    sessionUpdate: 'agent_message_chunk',
                    content: { type: 'text', text: `Réponse de l’utilisateur : ${answer}.` }
                  }
                ]
              },
              { kind: 'text', text: `Réponse rapportée par le sous-agent : ${answer}.` }
            ]
          }
        ]
      }
    ]
  }
}
