import { ChevronLeft, Copy, GitBranch, Package, Play, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Role, RoleScope } from '@shared/roles'
import { ipcErrorText } from '../../ipc-errors'
import {
  draftDefinition,
  draftErrors,
  draftFromRole,
  errorField,
  roleFileHint,
  type DraftErrors,
  type RoleDraft
} from '../../roles/role-draft'
import { invokeRole, openRoleWizard, rolesChanged } from '../../roles/roles-store'
import { ConfirmRow } from '../settings/ConfirmRow'
import { RoleAvatar } from './RoleAvatar'
import {
  AgentFields,
  AppearanceFields,
  DescriptionField,
  NameFields,
  PromptField,
  ReadOnlyField,
  ToolsField,
  type DraftChange
} from './RoleFields'
import type { RolesSettingsProps } from './RolesSettings'

type Status = { kind: 'saved' } | { kind: 'failed'; text: string } | null

/**
 * Modifier un rôle (fiche 223, maquettes B3 et 04-2) : un seul écran, les mêmes champs que
 * l'assistant. Un rôle fourni ne s'écrit pas : l'enregistrer crée un rôle personnel du même nom,
 * qui le remplace (ADR-0045). Un rôle du projet est partagé par git : c'est rappelé.
 */
export function RoleEditPage(
  props: RolesSettingsProps & {
    scope: RoleScope
    name: string
    onBack: () => void
    /** Rôle enregistré sous un autre nom ou une autre portée : la page le suit. */
    onMoved: (role: { scope: RoleScope; name: string }) => void
  }
) {
  const { t } = useTranslation()
  const [role, setRole] = useState<Role | null | undefined>(undefined)
  const [draft, setDraft] = useState<RoleDraft | null>(null)
  useEffect(() => {
    let alive = true
    window.api.roles.read(props.scope, props.name, props.conversationId).then(
      (found) => {
        if (!alive) return
        setRole(found)
        setDraft(found ? draftFromRole(found) : null)
      },
      () => alive && setRole(null)
    )
    return () => {
      alive = false
    }
  }, [props.scope, props.name, props.conversationId])
  const back = (
    <button
      className="settings-crumb role-edit-back"
      onClick={props.onBack}
      data-testid="role-edit-back"
    >
      <ChevronLeft size={15} aria-hidden />
      {t('settings.section.roles')}
    </button>
  )
  if (role === undefined) return back
  if (!role || !draft) {
    return (
      <>
        {back}
        <p className="field-error" role="alert" data-testid="role-edit-missing">
          {t('rolesSettings.edit.missing')}
        </p>
      </>
    )
  }
  return (
    <>
      {back}
      <RoleEditForm
        {...props}
        role={role}
        draft={draft}
        onDraft={setDraft}
        onSaved={(saved) => {
          setRole(saved)
          setDraft(draftFromRole(saved))
          if (saved.scope !== props.scope || saved.name !== props.name) props.onMoved(saved)
        }}
      />
    </>
  )
}

function RoleEditForm(
  props: RolesSettingsProps & {
    role: Role
    draft: RoleDraft
    onDraft: (draft: RoleDraft) => void
    onSaved: (role: Role) => void
    onBack: () => void
  }
) {
  const { t } = useTranslation()
  const { role, draft } = props
  const [errors, setErrors] = useState<DraftErrors>({})
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const builtin = role.scope === 'builtin'
  const target = builtin ? 'user' : role.scope === 'project' ? 'project' : 'user'
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromRole(role))
  const options = props.conversationId ? { conversationId: props.conversationId } : {}

  const change: DraftChange = (next) => {
    props.onDraft(next)
    if (Object.keys(errors).length) setErrors(draftErrors(next, 'all'))
    setStatus(null)
  }
  const save = async () => {
    const found = draftErrors(draft, 'all')
    setErrors(found)
    const checked = draftDefinition(draft)
    if (Object.keys(found).length || !checked.ok || busy) return
    setBusy(true)
    try {
      const result = await window.api.roles.save(target, checked.role, {
        ...options,
        ...(builtin ? {} : { previousName: role.name })
      })
      if (!result.ok) return setErrors({ [errorField(result.error)]: result.error })
      rolesChanged()
      setStatus({ kind: 'saved' })
      props.onSaved({ ...checked.role, scope: target })
    } catch (e) {
      setStatus({ kind: 'failed', text: ipcErrorText(e) })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (builtin) return
    try {
      await window.api.roles.remove(target, role.name, props.conversationId)
      rolesChanged()
      props.onBack()
    } catch (e) {
      setConfirmDelete(false)
      setStatus({ kind: 'failed', text: ipcErrorText(e) })
    }
  }
  const duplicate = () =>
    openRoleWizard({
      ...draft,
      label: t('rolesSettings.edit.copyLabel', { label: draft.label }).slice(0, 40),
      name: '',
      nameEdited: false,
      scope: target
    })

  return (
    <div
      className="role-edit"
      data-testid="role-edit"
      data-role={role.name}
      data-scope={role.scope}
    >
      <div className="role-edit-head">
        <RoleAvatar role={draft} size={44} />
        <div className="role-edit-title">
          <h3>{draft.label || role.label}</h3>
          <span className="role-edit-where">
            {t(`rolesSettings.scope.${role.scope}`)}
            {!builtin && (
              <>
                {' '}
                · <code>{roleFileHint({ name: role.name, scope: target })}</code>
              </>
            )}
          </span>
        </div>
        <div className="role-edit-actions">
          {props.conversationId && (
            <button
              className="btn small"
              onClick={() => {
                // Le jeton du rôle dans la saisie ; les Réglages se ferment pour l'y montrer.
                invokeRole(role.name)
                props.onClose?.()
              }}
              disabled={dirty}
              title={dirty ? t('rolesSettings.edit.saveFirst') : undefined}
              data-testid="role-edit-try"
            >
              <Play size={13} aria-hidden />
              {t('rolesSettings.edit.try')}
            </button>
          )}
          <button className="btn small" onClick={duplicate} data-testid="role-edit-duplicate">
            <Copy size={13} aria-hidden />
            {t('rolesSettings.edit.duplicate')}
          </button>
          {!builtin && (
            <button
              className="btn small danger"
              onClick={() => setConfirmDelete(true)}
              data-testid="role-edit-delete"
            >
              <Trash2 size={13} aria-hidden />
              {t('rolesSettings.edit.delete')}
            </button>
          )}
        </div>
      </div>
      {confirmDelete && (
        <ConfirmRow
          message={t('rolesSettings.edit.deleteConfirm', { label: role.label })}
          action={t('rolesSettings.edit.delete')}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {role.scope === 'project' && (
        <p className="role-banner" data-testid="role-edit-git">
          <GitBranch size={14} aria-hidden />
          {t('rolesSettings.edit.projectBanner')}
        </p>
      )}
      {builtin && (
        <p className="role-banner" data-testid="role-edit-builtin">
          <Package size={14} aria-hidden />
          {t('rolesSettings.edit.builtinBanner')}
        </p>
      )}
      <div className="settings-card role-edit-card">
        <NameFields draft={draft} onChange={change} errors={errors} />
        <AppearanceFields draft={draft} onChange={change} />
        <DescriptionField draft={draft} onChange={change} errors={errors} />
        <PromptField draft={draft} onChange={change} errors={errors} rows={12} />
        <AgentFields draft={draft} onChange={change} errors={errors} profiles={props.profiles} />
        <ReadOnlyField
          draft={draft}
          onChange={change}
          profiles={props.profiles}
          conversationProfileId={props.conversationProfileId}
        />
        <ToolsField draft={draft} onChange={change} />
      </div>
      <div className="role-edit-foot">
        {status?.kind === 'saved' && !dirty && (
          <span className="role-edit-saved" role="status" data-testid="role-edit-saved">
            {t('rolesSettings.edit.saved')}
          </span>
        )}
        {status?.kind === 'failed' && (
          <span className="field-error" role="alert" data-testid="role-edit-error">
            {status.text}
          </span>
        )}
        <span className="role-wizard-spacer" />
        <button
          className="btn ghost"
          disabled={!dirty || busy}
          onClick={() => {
            props.onDraft(draftFromRole(role))
            setErrors({})
          }}
          data-testid="role-edit-reset"
        >
          {t('rolesSettings.edit.reset')}
        </button>
        <button
          className="btn primary"
          disabled={!dirty || busy}
          onClick={() => void save()}
          data-testid="role-edit-save"
        >
          {builtin ? t('rolesSettings.edit.saveAsUser') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
