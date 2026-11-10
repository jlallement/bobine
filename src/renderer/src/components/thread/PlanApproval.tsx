import { Ban, Check, ChevronRight, ClipboardList, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { TranscriptItem } from '@shared/transcript'
import { Markdown } from './Markdown'
import type { RespondPermission } from './ToolCall'
import { useTranslation } from 'react-i18next'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

/** Texte du plan (Markdown) : contenu texte de l'appel d'outil, sinon `rawInput.plan` (Codex). */
function planText(item: ToolItem): string {
  const content = item.content
    .flatMap((c) => (c.type === 'content' && c.content.type === 'text' ? [c.content.text] : []))
    .join('\n\n')
    .trim()
  return content || (item.plan ?? '').trim()
}

/**
 * Sortie du mode plan (autorisation de genre `switch_mode`) : le plan en clair et les choix de
 * l'agent en liste numérotée, comme dans Claude Code.
 */
export function PlanApproval({
  item,
  onRespond
}: {
  item: ToolItem
  onRespond: RespondPermission
}) {
  const { t } = useTranslation()
  const permission = item.permission
  const plan = planText(item)
  const [focus, setFocus] = useState(0)
  const card = useRef<HTMLDivElement>(null)
  const pending = permission?.state === 'pending'

  useEffect(() => {
    if (pending) card.current?.focus({ preventScroll: true })
  }, [pending])

  if (!permission) return null
  const { state } = permission

  if (state !== 'pending') {
    const allowed = state !== 'cancelled' && state.kind.startsWith('allow')
    return (
      <div className="plan-answered" data-testid="plan-answered">
        {plan && (
          <details className="tool">
            <summary className="tool-row">
              <ClipboardList size={15} className="tool-icon" />
              <span className="tool-title">{t('planApproval.proposed')}</span>
              <ChevronRight size={14} className="chevron tool-icon" />
            </summary>
            <div className="plan-doc compact">
              <Markdown text={plan} />
            </div>
          </details>
        )}
        <div
          className={`permission-answer ${state === 'cancelled' ? '' : allowed ? 'allowed' : 'rejected'}`}
          data-testid="permission-answer"
        >
          {state === 'cancelled' ? (
            <>
              <Ban size={13} /> {t('planApproval.cancelled')}
            </>
          ) : (
            <>
              {allowed ? <Check size={14} /> : <X size={14} />} {state.name}
            </>
          )}
        </div>
      </div>
    )
  }

  const options = permission.options
  const choose = (index: number) => {
    const option = options[index]
    if (option) onRespond(permission.requestId, option.optionId)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const digit = Number(event.key)
    if (Number.isInteger(digit) && digit >= 1 && digit <= options.length) {
      event.preventDefault()
      choose(digit - 1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : options.length - 1
      setFocus((f) => (f + step) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(focus)
    }
  }

  return (
    <div
      className="permission-card plan-card"
      ref={card}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="plan-approval"
    >
      <div className="pc-head">
        <ClipboardList size={18} className="pc-icon" />
        <div>
          <div className="pc-title">{t('planApproval.title')}</div>
          <div className="pc-sub">{t('planApproval.hint')}</div>
        </div>
      </div>
      {plan && (
        <div className="plan-doc" data-testid="plan-doc">
          <Markdown text={plan} />
        </div>
      )}
      <div className="choices plan-choices" role="radiogroup">
        {options.map((option, i) => (
          <button
            key={option.optionId}
            type="button"
            role="radio"
            aria-checked={false}
            className={`choice${focus === i ? ' focused' : ''}${
              option.kind.startsWith('reject') ? ' reject' : ''
            }`}
            onClick={() => choose(i)}
            onMouseEnter={() => setFocus(i)}
            data-kind={option.kind}
            data-testid="plan-choice"
          >
            <span className="choice-key">{i + 1}</span>
            <span className="choice-text">
              <span className="choice-label">{option.name}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="pc-actions">
        <span className="question-hint">{t('planApproval.keys')}</span>
      </div>
    </div>
  )
}
