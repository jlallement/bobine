import { Check, MessageCircleQuestion } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  answerContent,
  emptyAnswer,
  isAnswered,
  type Question,
  type QuestionAnswer
} from '@shared/questions'
import { useTranslation } from 'react-i18next'

interface Props {
  message: string
  questions: Question[]
  onSubmit: (content: Record<string, string | string[]>) => void
  onSkip: () => void
}

/**
 * Questions à choix posées par l'agent, présentées comme dans Claude Code : options numérotées,
 * clavier (1–9, ↑/↓, Entrée), « Autre… » en texte libre, un onglet par question.
 */
export function QuestionCard({ message, questions, onSubmit, onSkip }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({})
  const [focus, setFocus] = useState(0)
  const card = useRef<HTMLDivElement>(null)
  const other = useRef<HTMLInputElement>(null)
  const question = questions[step] as Question
  const answer = answers[question.key] ?? emptyAnswer()
  const rows = question.options.length + (question.customKey ? 1 : 0)
  const last = step === questions.length - 1

  // La carte prend le focus à l'apparition et à chaque question : on répond sans la souris.
  useEffect(() => {
    card.current?.focus({ preventScroll: true })
  }, [step])

  const update = (key: string, next: QuestionAnswer) => setAnswers((a) => ({ ...a, [key]: next }))

  const complete = (current: Record<string, QuestionAnswer>) =>
    questions.every((q) => !q.required || isAnswered(q, current[q.key]))

  /** Envoi, si les questions obligatoires ont une réponse. */
  const submit = (current: Record<string, QuestionAnswer>) => {
    if (complete(current)) onSubmit(answerContent(questions, current))
  }

  /** Question suivante sans réponse, sinon envoi. */
  const advance = (current: Record<string, QuestionAnswer>) => {
    const next = questions.findIndex((q, i) => i !== step && !isAnswered(q, current[q.key]))
    if (next === -1) submit(current)
    else {
      setStep(next)
      setFocus(0)
    }
  }

  const pick = (value: string) => {
    if (question.multi) {
      const picks = answer.picks.includes(value)
        ? answer.picks.filter((p) => p !== value)
        : [...answer.picks, value]
      update(question.key, { ...answer, picks })
      return
    }
    const next = { ...answers, [question.key]: { ...answer, picks: [value] } }
    setAnswers(next)
    advance(next)
  }

  const activate = (index: number) => {
    setFocus(index)
    const option = question.options[index]
    if (option) pick(option.value)
    else other.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return
    const digit = Number(event.key)
    if (Number.isInteger(digit) && digit >= 1 && digit <= rows) {
      event.preventDefault()
      activate(digit - 1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFocus((f) => (f + (event.key === 'ArrowDown' ? 1 : rows - 1)) % rows)
    } else if (event.key === ' ') {
      event.preventDefault()
      activate(focus)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // Choix multiple : Entrée valide la question ; choix unique : choisit l'option en surbrillance.
      if (question.multi) advance(answers)
      else activate(focus)
    } else if (event.key === 'ArrowRight' && step < questions.length - 1) {
      setStep(step + 1)
      setFocus(0)
    } else if (event.key === 'ArrowLeft' && step > 0) {
      setStep(step - 1)
      setFocus(0)
    }
  }

  const onOtherKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      // Choix unique : le texte remplace l'option (« Autre »).
      const next = {
        ...answers,
        [question.key]: question.multi ? answer : { ...answer, picks: [] }
      }
      setAnswers(next)
      advance(next)
    } else if (event.key === 'Escape') {
      card.current?.focus()
    }
  }

  return (
    <div
      className="permission-card question-card"
      ref={card}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="questions"
    >
      {questions.length > 1 && (
        <div className="question-tabs" role="tablist">
          {questions.map((q, i) => (
            <button
              key={q.key}
              role="tab"
              aria-selected={i === step}
              className={`question-tab${i === step ? ' active' : ''}`}
              onClick={() => {
                setStep(i)
                setFocus(0)
              }}
            >
              {isAnswered(q, answers[q.key]) ? <Check size={13} /> : <span className="dot" />}
              {q.header ?? t('question.tab', { number: i + 1 })}
            </button>
          ))}
        </div>
      )}
      <div className="pc-head">
        <MessageCircleQuestion size={18} className="pc-icon" />
        <div>
          {questions.length === 1 && question.header && (
            <div className="question-header">{question.header}</div>
          )}
          <div className="pc-title" data-testid="question-text">
            {question.text || message}
          </div>
          {question.multi && <div className="pc-sub">{t('question.multi')}</div>}
        </div>
      </div>
      <div className="question-body">
        <div className="choices" role={question.multi ? 'group' : 'radiogroup'}>
          {question.options.map((option, i) => {
            const selected = answer.picks.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role={question.multi ? 'checkbox' : 'radio'}
                aria-checked={selected}
                className={`choice${selected ? ' selected' : ''}${focus === i ? ' focused' : ''}`}
                onClick={() => activate(i)}
                onMouseEnter={() => setFocus(i)}
                data-testid="choice"
              >
                <span className={`choice-key${question.multi ? ' box' : ''}`}>
                  {question.multi && selected ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className="choice-text">
                  <span className="choice-label">{option.label}</span>
                  {option.description && (
                    <span className="choice-description">{option.description}</span>
                  )}
                </span>
              </button>
            )
          })}
          {question.customKey && (
            <label
              className={`choice other${focus === question.options.length ? ' focused' : ''}${
                answer.custom.trim() ? ' selected' : ''
              }`}
              onMouseEnter={() => setFocus(question.options.length)}
            >
              <span className="choice-key">{question.options.length + 1}</span>
              <input
                ref={other}
                className="choice-input"
                placeholder={
                  question.multi ? t('question.other.multi') : t('question.other.single')
                }
                value={answer.custom}
                onChange={(e) => update(question.key, { ...answer, custom: e.target.value })}
                onFocus={() => setFocus(question.options.length)}
                onKeyDown={onOtherKey}
                data-testid="choice-other"
              />
            </label>
          )}
        </div>
      </div>
      <div className="pc-actions">
        <span className="question-hint">
          {question.multi ? t('question.hint.multi') : t('question.hint.single')}
        </span>
        <span className="grow" />
        <button className="btn ghost" onClick={onSkip} data-testid="questions-skip">
          {t('question.skip')}
        </button>
        <button
          className="btn primary"
          onClick={() => (last ? submit(answers) : advance(answers))}
          disabled={last && !complete(answers)}
          data-testid="questions-next"
        >
          {last || questions.every((q, i) => i === step || isAnswered(q, answers[q.key]))
            ? t('question.send')
            : t('question.next')}
        </button>
      </div>
    </div>
  )
}
