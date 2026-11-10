import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  EMPTY_DRAFT,
  draftOf,
  draftProblems,
  type CustomAgent,
  type CustomAgentDraft
} from '@shared/custom-agents'
import { translate } from '@shared/i18n/message'
import { CodeText } from '../common/CodeText'
import '../../custom-agent.css'

type HintKey = 'labelHint' | 'commandHint' | 'envHint' | 'apiKeyEnvHint' | 'compactHint'

/**
 * Déclarer un agent ACP, ou modifier sa déclaration (fiche 141) : une page de Réglages › Agents.
 * Les erreurs se vérifient en direct (`draftProblems`, les mêmes que le main) et s'affichent sous
 * leur champ une fois qu'on l'a quitté ; « Ajouter » reste grisé tant qu'il en reste.
 */
export function CustomAgentForm({
  agent,
  onSave,
  onCancel
}: {
  /** La déclaration à modifier ; absente : un nouvel agent. */
  agent?: CustomAgent
  /** Enregistre ; rejette avec la raison si le main refuse. */
  onSave: (draft: CustomAgentDraft) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<CustomAgentDraft>(agent ? draftOf(agent) : EMPTY_DRAFT)
  const [touched, setTouched] = useState<ReadonlySet<keyof CustomAgentDraft>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const problems = draftProblems(draft)
  const field = (name: keyof CustomAgentDraft) => ({
    value: draft[name],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [name]: e.target.value }),
    onBlur: () => setTouched((current) => new Set(current).add(name)),
    'aria-invalid': touched.has(name) && problems.some((p) => p.field === name),
    'data-testid': `custom-agent-${name}`
  })
  const problemOf = (name: keyof CustomAgentDraft) => {
    const problem = touched.has(name) ? problems.find((p) => p.field === name) : undefined
    return problem ? (
      <small className="custom-agent-error" role="alert" data-testid="custom-agent-problem">
        <CodeText text={translate(problem)} />
      </small>
    ) : null
  }
  const hint = (key: `customAgents.form.${HintKey}`) => (
    <small>
      <CodeText text={t(key)} />
    </small>
  )
  return (
    <section data-testid="custom-agent-form">
      <p className="settings-row-hint custom-agent-intro">{t('customAgents.form.intro')}</p>
      <form
        className="mcp-form custom-agent-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (problems.length > 0 || saving) return
          setSaving(true)
          setError(null)
          onSave(draft).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason))
            setSaving(false)
          })
        }}
      >
        {error && (
          <div className="settings-note error" role="alert" data-testid="custom-agent-error">
            {error}
          </div>
        )}
        <label>
          <span>{t('customAgents.form.label')}</span>
          <input autoFocus={!agent} {...field('label')} />
          {problemOf('label')}
          {hint('customAgents.form.labelHint')}
        </label>
        <label>
          <span>{t('customAgents.form.command')}</span>
          <input className="mono" spellCheck={false} {...field('commandLine')} />
          {problemOf('commandLine')}
          {hint('customAgents.form.commandHint')}
        </label>
        <label>
          <span>{t('customAgents.form.env')}</span>
          <textarea className="mono" rows={3} spellCheck={false} {...field('envText')} />
          {problemOf('envText')}
          {hint('customAgents.form.envHint')}
        </label>
        <div className="custom-agent-optional">{t('customAgents.form.optional')}</div>
        <label>
          <span>{t('customAgents.form.apiKeyEnv')}</span>
          <input className="mono" spellCheck={false} {...field('apiKeyEnv')} />
          {problemOf('apiKeyEnv')}
          {hint('customAgents.form.apiKeyEnvHint')}
        </label>
        <label>
          <span>{t('customAgents.form.compact')}</span>
          <input className="mono" spellCheck={false} {...field('compactCommand')} />
          {problemOf('compactCommand')}
          {hint('customAgents.form.compactHint')}
        </label>
        <div className="mcp-form-actions">
          {agent && <small className="custom-agent-next">{t('customAgents.form.nextStart')}</small>}
          <button type="button" className="btn small ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn small primary"
            disabled={problems.length > 0 || saving}
            data-testid="custom-agent-save"
          >
            {agent ? t('customAgents.form.save') : t('customAgents.form.add')}
          </button>
        </div>
      </form>
    </section>
  )
}
