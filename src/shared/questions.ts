/**
 * Questionnaire (fiche 016) : un formulaire d'élicitation fait uniquement de questions à choix,
 * affiché en cartes de questions. Lu d'après le JSON Schema seul, sans `_meta` d'un agent
 * (fiche 140) :
 * - une question = un champ `string` à `enum` ou `oneOf` (choix unique), ou `array` dont les
 *   `items` ont `enum` ou `anyOf` / `oneOf` (choix multiple) ; `title` = en-tête court,
 *   `description` = la question ; `required` = réponse obligatoire ;
 * - « Autre » = champ texte compagnon `<clé>_custom` (convention d'OpenCode 2, et de Claude Code).
 */
import type { ElicitationSchema } from './acp-sdk.mts'
import { t } from 'i18next'

export interface QuestionOption {
  value: string
  label: string
  description?: string
}

export interface Question {
  /** Clé du champ dans le formulaire. */
  key: string
  /** En-tête court (onglet). */
  header?: string
  text: string
  multi: boolean
  options: QuestionOption[]
  /** Clé du champ texte libre « Autre » associé, s'il existe. */
  customKey?: string
  /** Réponse obligatoire (`required` du schéma) : « Envoyer » attend une réponse. */
  required?: boolean
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined

function optionsOf(property: Json): { options: QuestionOption[]; multi: boolean } | undefined {
  const multi = property['type'] === 'array'
  const source = multi ? property['items'] : property
  if (!isObject(source)) return undefined
  if (!multi && property['type'] !== 'string') return undefined
  if (Array.isArray(source['enum'])) {
    const values = source['enum'].filter((v): v is string => typeof v === 'string')
    return values.length > 0
      ? { multi, options: values.map((value) => ({ value, label: value })) }
      : undefined
  }
  const titled = source['oneOf'] ?? source['anyOf']
  if (!Array.isArray(titled) || titled.length === 0) return undefined
  const options: QuestionOption[] = []
  for (const entry of titled) {
    if (!isObject(entry) || typeof entry['const'] !== 'string') return undefined
    const description = str(entry['description'])
    options.push({
      value: entry['const'],
      label: str(entry['title']) ?? entry['const'],
      ...(description ? { description } : {})
    })
  }
  return { multi, options }
}

/** Clé de la question dont ce champ texte est le « Autre », sinon `undefined`. */
function customAnswerTarget(
  key: string,
  property: Json,
  choiceKeys: Set<string>
): string | undefined {
  if (property['type'] !== 'string' || optionsOf(property)) return undefined
  const match = /^(.+)_custom$/.exec(key)
  return match?.[1] && choiceKeys.has(match[1]) ? match[1] : undefined
}

/**
 * Questions du formulaire, ou `undefined` s'il contient autre chose que des choix et leurs champs
 * « Autre » (il garde alors l'affichage générique).
 */
export function questionsOf(schema: ElicitationSchema, message: string): Question[] | undefined {
  const entries = Object.entries(schema.properties ?? {}).map(
    ([key, p]) => [key, p as unknown as Json] as const
  )
  if (entries.length === 0) return undefined
  const choices = new Map<string, NonNullable<ReturnType<typeof optionsOf>>>()
  for (const [key, property] of entries) {
    const parsed = optionsOf(property)
    if (parsed) choices.set(key, parsed)
  }
  if (choices.size === 0) return undefined

  const customs = new Map<string, string>()
  for (const [key, property] of entries) {
    if (choices.has(key)) continue
    const target = customAnswerTarget(key, property, new Set(choices.keys()))
    if (!target) return undefined // Champ qui n'est pas un « Autre » : formulaire générique.
    customs.set(target, key)
  }

  const single = choices.size === 1
  const required = new Set(schema.required ?? [])
  return entries
    .filter(([key]) => choices.has(key))
    .map(([key, property]) => {
      const { options, multi } = choices.get(key) as NonNullable<ReturnType<typeof optionsOf>>
      const title = str(property['title'])
      const description = str(property['description'])
      const customKey = customs.get(key)
      return {
        key,
        ...(title ? { header: title } : {}),
        text: single ? (description ?? message) : (description ?? title ?? key),
        multi,
        options,
        ...(customKey ? { customKey } : {}),
        ...(required.has(key) ? { required: true } : {})
      }
    })
}

/** Réponse de l'utilisateur à une question : options choisies et texte libre. */
export interface QuestionAnswer {
  picks: string[]
  custom: string
}

export const emptyAnswer = (): QuestionAnswer => ({ picks: [], custom: '' })

/** Contenu du formulaire à renvoyer à l'agent. Les questions sans réponse sont omises. */
export function answerContent(
  questions: Question[],
  answers: Record<string, QuestionAnswer>
): Record<string, string | string[]> {
  const content: Record<string, string | string[]> = {}
  for (const q of questions) {
    const answer = answers[q.key] ?? emptyAnswer()
    const picks = answer.picks.filter((p) => q.options.some((o) => o.value === p))
    if (q.multi) {
      if (picks.length > 0) content[q.key] = picks
    } else if (picks[0] !== undefined) {
      content[q.key] = picks[0]
    }
    const custom = answer.custom.trim()
    if (custom && q.customKey) content[q.customKey] = custom
  }
  return content
}

/** Une question a une réponse : au moins une option, ou un texte libre si c'est possible. */
export function isAnswered(q: Question, answer: QuestionAnswer | undefined): boolean {
  if (!answer) return false
  return answer.picks.length > 0 || (!!q.customKey && answer.custom.trim() !== '')
}

/** Résumé lisible d'une réponse (fil, après envoi). */
export function describeAnswer(q: Question, content: Record<string, unknown>): string | undefined {
  const value = content[q.key]
  const labels = (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(
    (v) => q.options.find((o) => o.value === v)?.label ?? String(v)
  )
  const custom = q.customKey ? content[q.customKey] : undefined
  if (typeof custom === 'string' && custom.trim())
    labels.push(t('question.customAnswer', { text: custom.trim() }))
  return labels.length > 0 ? labels.join(', ') : undefined
}
