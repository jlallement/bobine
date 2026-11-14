import { Check, FileText } from 'lucide-react'
import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import type { ProfileSummary } from '@shared/agent'
import { ACCENT_COLORS } from '@shared/preferences'
import { ROLE_LIMITS, ROLE_TOOL_FAMILIES, type Role, type RoleError } from '@shared/roles'
import { ROLE_ICON_NAMES } from '../../roles/role-icons'
import { withLabel, type DraftErrors, type RoleDraft } from '../../roles/role-draft'
import { RoleAvatar, useRoleTint } from './RoleAvatar'

/**
 * Champs d'un rôle (fiche 223, phase 3A), communs à l'assistant de création (étapes Qui, Comment,
 * Avec quoi) et à l'écran d'édition de Réglages › Rôles : un seul formulaire à maintenir.
 */

export type DraftChange = (next: RoleDraft) => void

/** Message d'une erreur de rôle (`roles.error.*`), libellé vide dit à part. */
export function roleErrorText(error: RoleError, draft?: Pick<RoleDraft, 'label'>): string {
  if (error.code === 'label' && draft && !draft.label.trim()) {
    return i18next.t('roleForm.label.missing')
  }
  return i18next.t(`roles.error.${error.code}`, {
    field: error.field ?? '',
    line: error.line ?? 0
  })
}

function FieldError({ error, draft, id }: { error?: RoleError; draft: RoleDraft; id: string }) {
  if (!error) return null
  return (
    <p className="field-error" id={id} role="alert" data-testid="role-field-error">
      {roleErrorText(error, draft)}
    </p>
  )
}

/** Libellé, champ, aide et erreur d'un champ ; `id` relie le libellé et l'erreur au champ. */
function Field({
  label,
  hint,
  error,
  draft,
  children,
  aside
}: {
  label: string
  hint?: ReactNode
  error?: RoleError
  draft: RoleDraft
  children: (ids: { input: string; error?: string }) => ReactNode
  aside?: ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={`role-field${error ? ' invalid' : ''}`}>
      <div className="role-field-head">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {aside}
      </div>
      {children({ input: id, ...(error ? { error: errorId } : {}) })}
      {hint && <div className="field-help">{hint}</div>}
      <FieldError error={error} draft={draft} id={errorId} />
    </div>
  )
}

const described = (ids: { error?: string }) =>
  ids.error ? { 'aria-invalid': true, 'aria-describedby': ids.error } : {}

/** Nom affiché, identifiant après `@`, et rôle déjà connu sous ce nom ailleurs. */
export function NameFields({
  draft,
  onChange,
  errors,
  replaces,
  onEnter,
  autoFocus
}: {
  draft: RoleDraft
  onChange: DraftChange
  errors: DraftErrors
  /** Rôle d'une autre portée que celui-ci remplacera (même nom). */
  replaces?: Pick<Role, 'label' | 'scope'>
  onEnter?: () => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const enter = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.metaKey && onEnter) {
      event.preventDefault()
      onEnter()
    }
  }
  return (
    <div className="role-name-fields">
      <Field label={t('roleForm.label.label')} error={errors.label} draft={draft}>
        {(ids) => (
          <div className="role-name-input">
            <RoleAvatar role={draft} size={24} />
            <input
              id={ids.input}
              className="field-input"
              value={draft.label}
              maxLength={ROLE_LIMITS.label}
              placeholder={t('roleForm.label.placeholder')}
              autoFocus={autoFocus}
              onChange={(e) => onChange(withLabel(draft, e.target.value))}
              onKeyDown={enter}
              data-testid="role-label"
              {...described(ids)}
            />
          </div>
        )}
      </Field>
      <Field
        label={t('roleForm.name.label')}
        error={errors.name}
        draft={draft}
        hint={
          replaces
            ? t('roleForm.name.replaces', {
                label: replaces.label,
                scope: t(`rolesSettings.scope.${replaces.scope}`)
              })
            : t('roleForm.name.hint')
        }
      >
        {(ids) => (
          <div className="role-at-input">
            <span aria-hidden>@</span>
            <input
              id={ids.input}
              className="field-input mono"
              value={draft.name}
              maxLength={40}
              spellCheck={false}
              onChange={(e) =>
                onChange({ ...draft, name: e.target.value.toLowerCase(), nameEdited: true })
              }
              onKeyDown={enter}
              data-testid="role-name"
              {...described(ids)}
            />
          </div>
        )}
      </Field>
    </div>
  )
}

/** Grille d'icônes et pastilles de couleur (maquette A1) : groupes de boutons radio. */
export function AppearanceFields({ draft, onChange }: { draft: RoleDraft; onChange: DraftChange }) {
  const { t } = useTranslation()
  const choose = (change: Partial<RoleDraft>) =>
    onChange({ ...draft, ...change, appearanceChosen: true })
  return (
    <div className="role-appearance">
      <div className="role-field">
        <span className="field-label" id="role-icon-label">
          {t('roleForm.icon')}
        </span>
        <div
          className="role-icon-grid"
          role="radiogroup"
          aria-labelledby="role-icon-label"
          data-testid="role-icons"
        >
          {ROLE_ICON_NAMES.map((icon) => (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={draft.icon === icon}
              aria-label={icon}
              title={icon}
              className={`role-icon-choice${draft.icon === icon ? ' selected' : ''}`}
              onClick={() => choose({ icon })}
              data-testid={`role-icon-${icon}`}
            >
              <RoleAvatar role={{ icon, color: draft.color }} size={24} />
            </button>
          ))}
        </div>
        {!draft.appearanceChosen && draft.label.trim() && (
          <div className="field-help">{t('roleForm.suggested')}</div>
        )}
      </div>
      <div className="role-field">
        <span className="field-label" id="role-color-label">
          {t('roleForm.color')}
        </span>
        <div
          className="role-colors"
          role="radiogroup"
          aria-labelledby="role-color-label"
          data-testid="role-colors"
        >
          {ACCENT_COLORS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              selected={draft.color === color}
              onPick={() => choose({ color })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorSwatch({
  color,
  selected,
  onPick
}: {
  color: string
  selected: boolean
  onPick: () => void
}) {
  const { t } = useTranslation()
  const tint = useRoleTint(color)
  const name = t(`settings.appearance.accent.${color as 'orange'}`)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={name}
      title={name}
      className={`role-color${selected ? ' selected' : ''}`}
      style={{ background: tint }}
      onClick={onPick}
      data-testid={`role-color-${color}`}
    >
      {selected && <Check size={13} strokeWidth={3} aria-hidden />}
    </button>
  )
}

/** « Quand faire appel à lui ? » : la description que lit l'agent principal pour déléguer. */
export function DescriptionField({
  draft,
  onChange,
  errors,
  examples
}: {
  draft: RoleDraft
  onChange: DraftChange
  errors: DraftErrors
  /** Bon et mauvais exemples (assistant, maquette A1). */
  examples?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <Field
        label={t('roleForm.description.label')}
        error={errors.description}
        draft={draft}
        hint={
          <span className="role-counter-line">
            <span>{t('roleForm.description.hint')}</span>
            <span className="role-counter" data-testid="role-description-count">
              {draft.description.trim().length} / {ROLE_LIMITS.description}
            </span>
          </span>
        }
      >
        {(ids) => (
          <textarea
            id={ids.input}
            className="field-input role-textarea"
            rows={3}
            value={draft.description}
            maxLength={ROLE_LIMITS.description}
            placeholder={t('roleForm.description.placeholder')}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value.replace(/[\r\n]+/g, ' ') })
            }
            data-testid="role-description"
            {...described(ids)}
          />
        )}
      </Field>
      {examples && (
        <div className="role-examples" aria-hidden>
          <div className="role-example good">
            <strong>{t('roleForm.description.goodTitle')}</strong>
            <span>{t('roleForm.description.goodText')}</span>
          </div>
          <div className="role-example vague">
            <strong>{t('roleForm.description.vagueTitle')}</strong>
            <span>{t('roleForm.description.vagueText')}</span>
          </div>
        </div>
      )}
    </>
  )
}

/** Consigne du rôle (Markdown), reçue au début de chaque conversation fille. */
export function PromptField({
  draft,
  onChange,
  errors,
  rows = 10
}: {
  draft: RoleDraft
  onChange: DraftChange
  errors: DraftErrors
  rows?: number
}) {
  const { t } = useTranslation()
  return (
    <Field
      label={t('roleForm.prompt.label')}
      error={errors.prompt}
      draft={draft}
      hint={t('roleForm.prompt.hint')}
    >
      {(ids) => (
        <textarea
          id={ids.input}
          className="field-input role-textarea role-prompt"
          rows={rows}
          value={draft.prompt}
          maxLength={ROLE_LIMITS.prompt}
          placeholder={t('roleForm.prompt.placeholder')}
          onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          data-testid="role-prompt"
          {...described(ids)}
        />
      )}
    </Field>
  )
}

/** Tuiles « Partir d'un modèle » (maquette A2) : les rôles fournis, puis « Page blanche ». */
export function TemplateTiles({
  templates,
  selected,
  onPick
}: {
  templates: readonly Role[]
  selected: string | undefined
  onPick: (template: Role | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="role-field">
      <span className="field-label" id="role-templates-label">
        {t('roleWizard.templates')}
      </span>
      <div
        className="role-templates"
        role="radiogroup"
        aria-labelledby="role-templates-label"
        data-testid="role-templates"
      >
        {templates.map((template) => (
          <button
            key={template.name}
            type="button"
            role="radio"
            aria-checked={selected === template.name}
            className={`role-template${selected === template.name ? ' selected' : ''}`}
            onClick={() => onPick(template)}
            data-testid={`role-template-${template.name}`}
          >
            <RoleAvatar role={template} size={32} />
            <span className="role-template-text">
              <span className="role-template-label">{template.label}</span>
              {template.readOnly && (
                <span className="role-template-sub">{t('rolesSettings.readOnly')}</span>
              )}
            </span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={selected === ''}
          className={`role-template blank${selected === '' ? ' selected' : ''}`}
          onClick={() => onPick(null)}
          data-testid="role-template-blank"
        >
          <span className="role-avatar s32 blank" aria-hidden>
            <FileText size={16} />
          </span>
          <span className="role-template-text">
            <span className="role-template-label">{t('roleWizard.blank')}</span>
            <span className="role-template-sub">{t('roleWizard.blankHint')}</span>
          </span>
        </button>
      </div>
    </div>
  )
}

/** Familles d'outils de Bobine données au rôle (`mcp`) : toutes, ou celles cochées. */
export function ToolsField({ draft, onChange }: { draft: RoleDraft; onChange: DraftChange }) {
  const { t } = useTranslation()
  const all = draft.mcp === null
  const toggle = (family: string, on: boolean) => {
    const current = draft.mcp ?? []
    const next = on ? [...current, family] : current.filter((f) => f !== family)
    onChange({ ...draft, mcp: ROLE_TOOL_FAMILIES.filter((f) => next.includes(f)) })
  }
  return (
    <fieldset className="role-field role-tools" data-testid="role-tools">
      <legend className="field-label">{t('roleForm.tools.label')}</legend>
      <label className="field-check">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => onChange({ ...draft, mcp: e.target.checked ? null : [] })}
          data-testid="role-tools-all"
        />
        {t('roleForm.tools.all')}
      </label>
      {!all && (
        <div className="field-choices">
          {ROLE_TOOL_FAMILIES.map((family) => (
            <label key={family} className="field-check">
              <input
                type="checkbox"
                checked={draft.mcp?.includes(family) ?? false}
                onChange={(e) => toggle(family, e.target.checked)}
                data-testid={`role-tool-${family}`}
              />
              {t(`appToolFamilies.${family}.title`)}
            </label>
          ))}
        </div>
      )}
      <div className="field-help">{t('roleForm.tools.hint')}</div>
    </fieldset>
  )
}

/** Agents proposés : ceux qu'on peut lancer, plus celui du rôle s'il manque (« indisponible »). */
function agentOptions(profiles: readonly ProfileSummary[], current: string) {
  const listed = profiles.filter((p) => p.available || !!p.custom)
  const options = listed.map((p) => ({ id: p.id, label: p.label }))
  if (current && !options.some((o) => o.id === current)) {
    const known = profiles.find((p) => p.id === current)
    options.push({
      id: current,
      label: i18next.t('roleForm.agent.missing', { agent: known?.label ?? current })
    })
  }
  return options
}

/** Agent, mode et modèle du rôle ; vides : ceux de la conversation et de l'agent. */
export function AgentFields({
  draft,
  onChange,
  errors,
  profiles
}: {
  draft: RoleDraft
  onChange: DraftChange
  errors: DraftErrors
  profiles: readonly ProfileSummary[]
}) {
  const { t } = useTranslation()
  return (
    <div className="role-agent-fields">
      <Field label={t('roleForm.agent.label')} error={errors.agent} draft={draft}>
        {(ids) => (
          <select
            id={ids.input}
            className="field-input"
            value={draft.agent}
            onChange={(e) => onChange({ ...draft, agent: e.target.value })}
            data-testid="role-agent"
          >
            <option value="">{t('roleForm.agent.conversation')}</option>
            {agentOptions(profiles, draft.agent).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('roleForm.mode.label')} error={errors.mode} draft={draft}>
        {(ids) => (
          <input
            id={ids.input}
            className="field-input"
            value={draft.mode}
            maxLength={ROLE_LIMITS.value}
            placeholder={t('roleForm.agentDefault')}
            onChange={(e) => onChange({ ...draft, mode: e.target.value })}
            data-testid="role-mode"
            {...described(ids)}
          />
        )}
      </Field>
      <Field label={t('roleForm.model.label')} error={errors.model} draft={draft}>
        {(ids) => (
          <input
            id={ids.input}
            className="field-input"
            value={draft.model}
            maxLength={ROLE_LIMITS.value}
            placeholder={t('roleForm.agentDefault')}
            onChange={(e) => onChange({ ...draft, model: e.target.value })}
            data-testid="role-model"
            {...described(ids)}
          />
        )}
      </Field>
      <p className="field-help role-agent-hint">{t('roleForm.agent.hint')}</p>
    </div>
  )
}

/**
 * Lecture seule ; avec un agent qui écrit sans demander (`writesWithoutAsking` du profil choisi,
 * ou de celui de la conversation), elle n'est que demandée, et c'est dit (fiche 223).
 */
export function ReadOnlyField({
  draft,
  onChange,
  profiles,
  conversationProfileId
}: {
  draft: RoleDraft
  onChange: DraftChange
  profiles: readonly ProfileSummary[]
  conversationProfileId?: string | undefined
}) {
  const { t } = useTranslation()
  const target = profiles.find((p) => p.id === (draft.agent || conversationProfileId))
  const requestedOnly = draft.readOnly && target?.writesWithoutAsking
  return (
    <div className="role-field role-switch-field">
      <label className="role-switch-line">
        <span className="switch">
          <input
            type="checkbox"
            checked={draft.readOnly}
            onChange={(e) => onChange({ ...draft, readOnly: e.target.checked })}
            data-testid="role-read-only"
          />
          <span />
        </span>
        <span className="role-switch-text">
          <span className="field-label">{t('roleForm.readOnly.label')}</span>
          <span className="field-help">{t('roleForm.readOnly.hint')}</span>
        </span>
      </label>
      {requestedOnly && target && (
        <p className="role-note" role="note" data-testid="role-read-only-requested">
          {t('roleForm.readOnly.requested', { agent: target.label })}
        </p>
      )}
    </div>
  )
}

/** Portée : personnel (tous les projets) ou ce projet (`.bobine/roles/`, partagé par git). */
export function ScopeField({
  draft,
  onChange,
  project
}: {
  draft: RoleDraft
  onChange: DraftChange
  /** Nom du dossier de la conversation ; absent : pas de projet, seul « Personnel » est possible. */
  project?: string | undefined
}) {
  const { t } = useTranslation()
  const option = (scope: RoleDraft['scope'], title: string, text: string, disabled = false) => (
    <label
      className={`role-scope${draft.scope === scope ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
    >
      <input
        type="radio"
        name="role-scope"
        checked={draft.scope === scope}
        disabled={disabled}
        onChange={() => onChange({ ...draft, scope })}
        data-testid={`role-scope-${scope}`}
      />
      <span>
        <span className="role-scope-title">{title}</span>
        <span className="field-help">{text}</span>
      </span>
    </label>
  )
  return (
    <fieldset className="role-field">
      <legend className="field-label">{t('roleForm.scope.label')}</legend>
      <div className="role-scopes">
        {option('user', t('roleForm.scope.user'), t('roleForm.scope.userHint'))}
        {option(
          'project',
          project ? t('roleForm.scope.project', { project }) : t('roleForm.scope.projectNone'),
          project ? t('roleForm.scope.projectHint') : t('roleForm.scope.projectMissing'),
          !project
        )}
      </div>
    </fieldset>
  )
}
