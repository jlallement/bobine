/**
 * Outil `ask_user` que l'app fournit à l'agent (serveur MCP hébergé, fiche 028) : l'agent pose une
 * question à choix, l'app l'affiche avec la carte de questions (fiche 016) et renvoie la réponse.
 */
import type { ElicitationSchema } from './acp-sdk.mts'

export const ASK_USER_TOOL = 'ask_user'

/** Description de l'outil pour le modèle : c'est elle qui lui donne envie de s'en servir. */
export const ASK_USER_DEFINITION = {
  name: ASK_USER_TOOL,
  title: 'Ask the user',
  description:
    'Ask the user a question with predefined choices and wait for the answer. Use it whenever you ' +
    'need the user to decide between options (single or multiple choice) instead of asking in ' +
    'plain text. The user can also type their own answer or skip the question.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question, in the language of the user.' },
      header: { type: 'string', description: 'Very short label for the question (1–3 words).' },
      options: {
        type: 'array',
        minItems: 2,
        maxItems: 8,
        description: 'The choices offered to the user.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Short choice label.' },
            description: { type: 'string', description: 'Optional one-line explanation.' }
          },
          required: ['label']
        }
      },
      multiSelect: { type: 'boolean', description: 'Allow several choices. Default: false.' },
      allowOther: {
        type: 'boolean',
        description: 'Let the user type an answer of their own. Default: true.'
      }
    },
    required: ['question', 'options']
  }
} as const

export interface AskUserArgs {
  question: string
  header?: string
  options: { label: string; description?: string }[]
  multiSelect: boolean
  allowOther: boolean
}

const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

/** Valide les arguments envoyés par l'agent ; lève une erreur lisible (renvoyée à l'agent). */
export function parseAskUserArgs(value: unknown): AskUserArgs {
  if (typeof value !== 'object' || value === null) throw new Error('Arguments manquants')
  const a = value as Record<string, unknown>
  const question = text(a['question'], 1000)
  if (!question) throw new Error('`question` est obligatoire')
  if (!Array.isArray(a['options'])) throw new Error('`options` doit être une liste')
  const seen = new Set<string>()
  const options = a['options'].flatMap((o): AskUserArgs['options'] => {
    const raw = typeof o === 'string' ? { label: o } : (o as Record<string, unknown> | null)
    const label = text(raw?.['label'], 200)
    if (!label || seen.has(label)) return []
    seen.add(label)
    const description = text(raw?.['description'], 500)
    return [{ label, ...(description ? { description } : {}) }]
  })
  if (options.length < 1) throw new Error('Au moins un choix dans `options`')
  if (options.length > 12) throw new Error('Au plus 12 choix dans `options`')
  const header = text(a['header'], 40)
  return {
    question,
    ...(header ? { header } : {}),
    options,
    multiSelect: a['multiSelect'] === true,
    allowOther: a['allowOther'] !== false
  }
}

/** Formulaire d'élicitation équivalent, reconnu comme questionnaire par la fiche 016. */
export function askUserSchema(args: AskUserArgs): ElicitationSchema {
  const choices = args.options.map((o) => ({
    const: o.label,
    title: o.label,
    ...(o.description ? { description: o.description } : {})
  }))
  const answer = args.multiSelect
    ? { type: 'array', title: args.header, items: { anyOf: choices } }
    : { type: 'string', title: args.header, oneOf: choices }
  return {
    type: 'object',
    properties: {
      answer,
      ...(args.allowOther ? { answer_custom: { type: 'string', title: 'Autre' } } : {})
    }
  } as unknown as ElicitationSchema
}

/** Réponse renvoyée à l'agent comme résultat de l'outil. */
export function askUserResult(
  action: 'accept' | 'decline' | 'cancel',
  content: Record<string, unknown> | undefined
): { text: string; isError?: boolean } {
  if (action === 'cancel') return { text: 'The question was cancelled.', isError: true }
  if (action === 'decline') {
    return { text: 'The user skipped the question. Decide yourself or ask differently.' }
  }
  const picked = content?.['answer']
  const picks = Array.isArray(picked) ? picked.map(String) : picked ? [String(picked)] : []
  const custom =
    typeof content?.['answer_custom'] === 'string' ? content['answer_custom'].trim() : ''
  const parts = [
    ...(picks.length ? [`The user chose: ${picks.join(', ')}.`] : []),
    ...(custom ? [`The user wrote: ${custom}`] : [])
  ]
  return { text: parts.length ? parts.join('\n') : 'The user answered without choosing anything.' }
}
