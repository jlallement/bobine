import { Ban, Check, ClipboardList, ExternalLink, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ElicitationSchema } from '../../../../shared/acp-sdk.mts'
import type { ElicitationAnswer } from '@shared/agent'
import { choicesOf, validateElicitationContent } from '@shared/elicitation'
import { describeAnswer, questionsOf } from '@shared/questions'
import type { TranscriptItem } from '@shared/transcript'
import { QuestionCard } from './QuestionCard'
import { Trans, useTranslation } from 'react-i18next'

type ElicitationItem = Extract<TranscriptItem, { kind: 'elicitation' }>
export type RespondElicitation = (requestId: string, answer: ElicitationAnswer) => void

/** Demande d'information de l'agent : formulaire généré depuis le schéma, ou page à ouvrir. */
export function ElicitationCard({
  item,
  onRespond
}: {
  item: ElicitationItem
  onRespond: RespondElicitation
}) {
  const { t } = useTranslation()
  if (item.state !== 'pending') return <Answered item={item} />
  const respond = (answer: ElicitationAnswer) => onRespond(item.requestId, answer)
  const { prompt } = item

  if (prompt.mode === 'url') {
    let host = prompt.url
    try {
      host = new URL(prompt.url).host
    } catch {
      // Lien illisible : affiché tel quel, le main refusera de l'ouvrir.
    }
    return (
      <div className="permission-card" data-testid="elicitation">
        <div className="pc-head">
          <ExternalLink size={18} className="pc-icon" />
          <div>
            <div className="pc-title elicitation-message">{prompt.message}</div>
            <div className="pc-sub">
              <Trans
                t={t}
                i18nKey="elicitation.url.ask"
                values={{ host }}
                components={{ strong: <strong /> }}
              />
            </div>
          </div>
        </div>
        <div className="pc-actions">
          <button className="btn ghost" onClick={() => respond({ action: 'decline' })}>
            {t('elicitation.decline')}
          </button>
          <button
            className="btn primary"
            onClick={() => respond({ action: 'accept' })}
            data-testid="elicitation-open"
          >
            {t('elicitation.url.open')}
          </button>
        </div>
      </div>
    )
  }
  const questions = questionsOf(prompt.schema, prompt.message)
  if (questions) {
    return (
      <QuestionCard
        message={prompt.message}
        questions={questions}
        onSubmit={(content) => respond({ action: 'accept', content })}
        onSkip={() => respond({ action: 'decline' })}
      />
    )
  }
  return <ElicitationForm message={prompt.message} schema={prompt.schema} onRespond={respond} />
}

function Answered({ item }: { item: ElicitationItem }) {
  const { t } = useTranslation()
  const questions =
    item.prompt.mode === 'form' ? questionsOf(item.prompt.schema, item.prompt.message) : undefined
  if (questions) {
    const content = item.content ?? {}
    return (
      <div className="questions-answered" data-testid="elicitation-answer">
        {questions.map((q) => {
          const text = item.state === 'accept' ? describeAnswer(q, content) : undefined
          return (
            <div key={q.key} className="qa-row">
              <span className="qa-question">{q.text}</span>
              <span className={`qa-answer${text ? '' : ' skipped'}`}>
                {text ??
                  (item.state === 'cancel'
                    ? t('elicitation.answer.cancelled')
                    : item.state === 'accept'
                      ? t('elicitation.answer.empty')
                      : t('elicitation.answer.skipped'))}
              </span>
            </div>
          )
        })}
      </div>
    )
  }
  const url = item.prompt.mode === 'url'
  const [icon, text, cls] =
    item.state === 'accept'
      ? [
          <Check size={14} key="i" />,
          url ? t('elicitation.result.opened') : t('elicitation.result.sent'),
          'allowed'
        ]
      : item.state === 'decline'
        ? [<X size={14} key="i" />, t('elicitation.result.declined'), 'rejected']
        : [<Ban size={13} key="i" />, t('elicitation.result.cancelled'), '']
  return (
    <div className="elicitation-answered" data-testid="elicitation-answer">
      <div className="elicitation-question elicitation-message">{item.prompt.message}</div>
      <div className={`permission-answer ${cls}`}>
        {icon} {text}
      </div>
    </div>
  )
}

type Values = Record<string, unknown>

function initialValues(schema: ElicitationSchema): Values {
  const values: Values = {}
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const fallback = (property as { default?: unknown }).default
    if (fallback !== undefined && fallback !== null) values[key] = fallback
  }
  return values
}

function ElicitationForm({
  message,
  schema,
  onRespond
}: {
  message: string
  schema: ElicitationSchema
  onRespond: (answer: ElicitationAnswer) => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<Values>(() => initialValues(schema))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const required = new Set(schema.required ?? [])
  const set = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }))
    // L'erreur d'un champ disparaît dès qu'on le corrige.
    setErrors(({ [key]: _fixed, ...rest }) => rest)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateElicitationContent(schema, values)
    if (!result.ok) return setErrors(result.errors)
    setErrors({})
    onRespond({ action: 'accept', content: result.content })
  }

  return (
    <form className="permission-card elicitation-form" onSubmit={submit} data-testid="elicitation">
      <div className="pc-head">
        <ClipboardList size={18} className="pc-icon" />
        <div>
          <div className="pc-title elicitation-message">{message}</div>
          <div className="pc-sub">{t('elicitation.form.hint')}</div>
        </div>
      </div>
      <div className="form-fields">
        {Object.entries(schema.properties ?? {}).map(([key, property]) => {
          const p = property as Record<string, unknown>
          const label = typeof p['title'] === 'string' ? p['title'] : key
          return (
            <div key={key} className={`form-field${errors[key] ? ' invalid' : ''}`}>
              {p['type'] !== 'boolean' && (
                <label className="field-label" htmlFor={`f-${key}`}>
                  {label}
                  {required.has(key) && <span className="required">*</span>}
                </label>
              )}
              <Field
                id={`f-${key}`}
                label={label}
                property={p}
                value={values[key]}
                onChange={(v) => set(key, v)}
              />
              {typeof p['description'] === 'string' && (
                <div className="field-help">{p['description']}</div>
              )}
              {errors[key] && <div className="field-error">{errors[key]}</div>}
            </div>
          )
        })}
      </div>
      <div className="pc-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={() => onRespond({ action: 'decline' })}
        >
          {t('elicitation.decline')}
        </button>
        <button type="submit" className="btn primary" data-testid="elicitation-submit">
          {t('elicitation.form.send')}
        </button>
      </div>
    </form>
  )
}

function Field({
  id,
  label,
  property,
  value,
  onChange
}: {
  id: string
  label: string
  property: Record<string, unknown>
  value: unknown
  onChange: (value: unknown) => void
}) {
  const { t } = useTranslation()
  const choices = choicesOf(property as never)
  switch (property['type']) {
    case 'boolean':
      return (
        <label className="field-check">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          {label}
        </label>
      )
    case 'array':
      return (
        <div className="field-choices">
          {(choices ?? []).map((choice) => {
            const list = Array.isArray(value) ? (value as string[]) : []
            return (
              <label key={choice.value} className="field-check">
                <input
                  type="checkbox"
                  checked={list.includes(choice.value)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...list, choice.value]
                        : list.filter((v) => v !== choice.value)
                    )
                  }
                />
                {choice.label}
              </label>
            )
          })}
        </div>
      )
    case 'number':
    case 'integer':
      return (
        <input
          id={id}
          className="field-input"
          type="number"
          step={property['type'] === 'integer' ? 1 : 'any'}
          min={typeof property['minimum'] === 'number' ? property['minimum'] : undefined}
          max={typeof property['maximum'] === 'number' ? property['maximum'] : undefined}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )
    default:
      if (choices) {
        return (
          <select
            id={id}
            className="field-input"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">{t('elicitation.form.choose')}</option>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )
      }
      return (
        <input
          id={id}
          className="field-input"
          type={
            { email: 'email', uri: 'url', date: 'date', 'date-time': 'datetime-local' }[
              String(property['format'])
            ] ?? 'text'
          }
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
