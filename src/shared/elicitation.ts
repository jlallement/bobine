/**
 * Validation d'une réponse à un formulaire d'élicitation contre son schéma ACP.
 * Le main s'en sert pour faire autorité (rien de non conforme n'est envoyé à l'agent) ; l'UI pour
 * guider la saisie.
 */
import type { ElicitationContentValue, ElicitationSchema } from './acp-sdk.mts'
import { t } from 'i18next'

export type ElicitationContent = Record<string, ElicitationContentValue>

export type ElicitationValidation =
  { ok: true; content: ElicitationContent } | { ok: false; errors: Record<string, string> }

type Property = NonNullable<ElicitationSchema['properties']>[string]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Valeurs autorisées d'une liste de choix (`enum` ou `oneOf` / `anyOf`), sinon `undefined`. */
export function choicesOf(property: Property): { value: string; label: string }[] | undefined {
  const p = property as Record<string, unknown>
  const source = p['type'] === 'array' ? (p['items'] as Record<string, unknown> | undefined) : p
  if (!source) return undefined
  if (Array.isArray(source['enum'])) {
    return (source['enum'] as string[]).map((value) => ({ value, label: value }))
  }
  const titled = (source['oneOf'] ?? source['anyOf']) as
    { const: string; title: string }[] | undefined
  return Array.isArray(titled) ? titled.map((o) => ({ value: o.const, label: o.title })) : undefined
}

function checkString(property: Property, value: unknown): string | undefined {
  if (typeof value !== 'string') return t('elicitation.check.text')
  const p = property as Record<string, unknown>
  const choices = choicesOf(property)
  if (choices && !choices.some((c) => c.value === value)) return t('elicitation.check.choice')
  if (typeof p['minLength'] === 'number' && value.length < p['minLength']) {
    return t('elicitation.check.minLength', { min: p['minLength'] })
  }
  if (typeof p['maxLength'] === 'number' && value.length > p['maxLength']) {
    return t('elicitation.check.maxLength', { max: p['maxLength'] })
  }
  if (typeof p['pattern'] === 'string') {
    try {
      if (!new RegExp(p['pattern'], 'u').test(value)) return t('elicitation.check.pattern')
    } catch {
      // Motif invalide fourni par l'agent : on ne bloque pas l'utilisateur dessus.
    }
  }
  switch (p['format']) {
    case 'email':
      return EMAIL.test(value) ? undefined : t('elicitation.check.email')
    case 'uri':
      return URL.canParse(value) ? undefined : t('elicitation.check.uri')
    case 'date':
      return DATE.test(value) && !Number.isNaN(Date.parse(value))
        ? undefined
        : t('elicitation.check.date')
    case 'date-time':
      return Number.isNaN(Date.parse(value)) ? t('elicitation.check.dateTime') : undefined
  }
  return undefined
}

function checkNumber(property: Property, value: unknown, integer: boolean): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return t('elicitation.check.number')
  if (integer && !Number.isInteger(value)) return t('elicitation.check.integer')
  const p = property as Record<string, unknown>
  if (typeof p['minimum'] === 'number' && value < p['minimum'])
    return t('elicitation.check.minimum', { min: p['minimum'] })
  if (typeof p['maximum'] === 'number' && value > p['maximum'])
    return t('elicitation.check.maximum', { max: p['maximum'] })
  return undefined
}

function checkArray(property: Property, value: unknown): string | undefined {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    return t('elicitation.check.list')
  const choices = choicesOf(property)
  if (choices && value.some((v) => !choices.some((c) => c.value === v)))
    return t('elicitation.check.choice')
  const p = property as Record<string, unknown>
  if (typeof p['minItems'] === 'number' && value.length < p['minItems']) {
    return t('elicitation.check.minItems', { min: p['minItems'] })
  }
  if (typeof p['maxItems'] === 'number' && value.length > p['maxItems']) {
    return t('elicitation.check.maxItems', { max: p['maxItems'] })
  }
  return undefined
}

export function checkProperty(property: Property, value: unknown): string | undefined {
  switch ((property as { type?: string }).type) {
    case 'string':
      return checkString(property, value)
    case 'number':
      return checkNumber(property, value, false)
    case 'integer':
      return checkNumber(property, value, true)
    case 'boolean':
      return typeof value === 'boolean' ? undefined : t('elicitation.check.boolean')
    case 'array':
      return checkArray(property, value)
    default:
      return t('elicitation.check.unsupported')
  }
}

/** Les champs absents ou vides (`''`, `undefined`) ne sont acceptés que s'ils sont facultatifs. */
export function validateElicitationContent(
  schema: ElicitationSchema,
  content: unknown
): ElicitationValidation {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    return { ok: false, errors: { _: t('elicitation.check.invalid') } }
  }
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  const errors: Record<string, string> = {}
  const clean: ElicitationContent = {}

  for (const [key, value] of Object.entries(content)) {
    if (!(key in properties) && value !== undefined) errors[key] = t('elicitation.check.unknown')
  }
  for (const [key, property] of Object.entries(properties)) {
    const value = (content as Record<string, unknown>)[key]
    if (value === undefined || value === '') {
      if (required.has(key)) errors[key] = t('elicitation.check.required')
      continue
    }
    const error = checkProperty(property, value)
    if (error) errors[key] = error
    else clean[key] = value as ElicitationContentValue
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, content: clean }
}
