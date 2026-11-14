import { ChevronRight, Eye, EyeOff, FolderGit2, Pencil, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { ChildState } from '@shared/children'
import type { RoleBadge, RoleScope, RoleSnapshot } from '@shared/roles'
import { Tip } from '../common/Menus'
import { RoleAvatar, roleAvatarState, useRoleTint } from './RoleAvatar'
import { readOnlyShown } from './role-view'

/**
 * Rôles au travail (fiche 223, maquettes 03-1 à 03-5) : la fille d'un rôle dans le fil de sa
 * mère, sa ligne dans « Sous-tâches », la proposition de l'agent et l'en-tête de la fille. Une
 * seule identité partout : l'avatar du rôle, son nom, et son état.
 */

/**
 * Ce que fait chaque fille en ce moment : le dernier outil annoncé par son agent, effacé à la fin
 * de son tour. Seulement ce qui arrive pendant que la carte est affichée (rien n'est relu).
 */
export function useChildActivity(ids: readonly string[]): ReadonlyMap<string, string> {
  const [activity, setActivity] = useState<ReadonlyMap<string, string>>(new Map())
  const key = ids.join('\n')
  useEffect(() => {
    const watched = new Set(key ? key.split('\n') : [])
    if (watched.size === 0) return
    return window.api.agent.onEvent(({ conversationId, event }) => {
      if (!watched.has(conversationId)) return
      const ended = event.type === 'turn-end' || event.type === 'turn-error'
      const update = event.type === 'update' ? event.update : undefined
      const title =
        update &&
        (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update')
          ? update.title
          : undefined
      if (!ended && !title) return
      setActivity((current) => {
        const next = new Map(current)
        if (ended) next.delete(conversationId)
        else if (title) next.set(conversationId, title)
        return next
      })
    })
  }, [key])
  return activity
}

/** « au travail », « attend votre accord », « a rendu son compte rendu »… */
export function RoleStateText({ state }: { state: ChildState }) {
  const { t } = useTranslation()
  return (
    <span className="role-state" data-state={state} data-testid="role-state">
      {t(`roleWork.state.${state}`)}
    </span>
  )
}

/**
 * Lecture seule d'une fille : garantie (« lecture seule »), seulement demandée (l'agent écrit
 * sans demander : « lecture seule demandée », expliqué en infobulle), ou un rôle qui écrit.
 */
export function RoleReadOnlyTag({
  level,
  writes = false
}: {
  level: 'enforced' | 'requested' | undefined
  /** Rôle qui écrit du code : dit aussi (carte de proposition). */
  writes?: boolean
}) {
  const { t } = useTranslation()
  if (!level) {
    if (!writes) return null
    return (
      <span className="role-tag" data-testid="role-writes">
        <Pencil size={12} />
        {t('roleWork.writes')}
      </span>
    )
  }
  const requested = level === 'requested'
  const tag = (
    <span
      className={`role-tag read-only${requested ? ' requested' : ''}`}
      data-testid="role-read-only"
      data-level={level}
      tabIndex={requested ? 0 : undefined}
    >
      {requested ? <EyeOff size={12} /> : <Eye size={12} />}
      {t(requested ? 'roleWork.readOnlyRequested' : 'roleWork.readOnly')}
    </span>
  )
  return requested ? <Tip label={t('roleWork.readOnlyRequestedHint')}>{tag}</Tip> : tag
}

/** Lecture seule d'une fille déjà lancée, d'après son agent. */
export function childReadOnly(
  child: Pick<ConversationSummary, 'role' | 'profileId'> | undefined,
  profiles: readonly Pick<ProfileSummary, 'id' | 'writesWithoutAsking'>[]
) {
  return readOnlyShown(
    child?.role?.readOnly,
    profiles.find((p) => p.id === child?.profileId)
  )
}

/**
 * La fille d'un rôle dans le fil de sa mère (maquette 03-1), à la place de la ligne « Conversation
 * fille lancée » : avatar à son état, nom du rôle, ce qu'il fait, lecture seule ; la consigne se
 * déplie.
 */
export function RoleLaunch({
  role,
  title,
  prompt,
  byAgent,
  child,
  state,
  activity,
  profiles,
  onOpen
}: {
  role: RoleBadge
  title: string
  prompt: string
  byAgent: boolean
  child: ConversationSummary | undefined
  state: ChildState | undefined
  activity: string | undefined
  profiles: readonly Pick<ProfileSummary, 'id' | 'writesWithoutAsking'>[]
  onOpen: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const style = useRoleTint(role.color)
  const level = child ? childReadOnly(child, profiles) : role.readOnly ? 'enforced' : undefined
  return (
    <div
      className="role-launch"
      style={style}
      data-testid="role-launch"
      data-role={role.name}
      data-state={state ?? 'gone'}
    >
      <RoleAvatar role={role} state={state ? roleAvatarState(state) : 'idle'} />
      <div className="role-launch-body">
        <div className="role-launch-head">
          <strong>{role.label}</strong>
          {state && <RoleStateText state={state} />}
          <span className="grow" />
          {onOpen && (
            <button className="btn small" onClick={onOpen} data-testid="role-launch-open">
              {t('children.open')}
            </button>
          )}
        </div>
        <div className="role-launch-title">
          {state === 'running' && activity ? activity : title}
        </div>
        <div className="role-launch-meta">
          <RoleReadOnlyTag level={level} />
          {byAgent && <span>{t('roleWork.byAgent')}</span>}
          <button
            type="button"
            className="link-button role-launch-toggle"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            data-testid="role-launch-prompt-toggle"
          >
            {t('roleWork.prompt')}
            <ChevronRight size={12} className="chevron" />
          </button>
        </div>
        {open && (
          <div className="child-instruction-text" data-testid="child-instruction-text">
            {prompt}
          </div>
        )}
      </div>
    </div>
  )
}

/** Titre d'une ligne de « Sous-tâches » pour la fille d'un rôle (maquette 03-2). */
export function RoleSubtaskHead({
  role,
  state,
  title,
  activity
}: {
  role: RoleBadge
  state: ChildState
  title: string
  activity: string | undefined
}) {
  return (
    <>
      <span className="role-subtask-head">
        <RoleAvatar role={role} size="sm" state={roleAvatarState(state)} />
        <strong>{role.label}</strong>
        <RoleStateText state={state} />
      </span>
      <span className="role-subtask-doing" data-testid="role-subtask-doing">
        {state === 'running' && activity ? activity : title}
      </span>
    </>
  )
}

const HIDDEN_SCOPES: readonly RoleScope[] = ['user', 'builtin']

/**
 * Le rôle d'une proposition de l'agent (maquette 03-3), figé à la carte : ce qu'il pourra faire
 * (lecture seule garantie ou demandée, ou il écrit du code), son mode, et un rôle du projet qui en
 * remplace un autre du même nom.
 */
export function ProposalRoleMeta({
  role,
  profile,
  agentLabel
}: {
  role: RoleSnapshot
  profile: Pick<ProfileSummary, 'writesWithoutAsking'> | undefined
  agentLabel: string | undefined
}) {
  const { t } = useTranslation()
  const hidden = HIDDEN_SCOPES.filter((s) => role.hides?.includes(s))
  return (
    <div className="proposal-role" data-testid="proposal-role" data-role={role.name}>
      <RoleReadOnlyTag level={readOnlyShown(role.readOnly, profile)} writes />
      {role.mode && (
        <span className="role-tag" data-testid="proposal-role-mode">
          {t('roleWork.mode', { mode: role.mode })}
        </span>
      )}
      {agentLabel && <span className="role-tag plain">{agentLabel}</span>}
      {role.scope === 'project' && (
        <span className="role-tag" data-testid="proposal-role-project">
          <FolderGit2 size={12} />
          {t('roleWork.menu.project')}
        </span>
      )}
      {hidden.length > 0 && (
        <span className="role-tag warn" role="note" data-testid="proposal-role-hides">
          <TriangleAlert size={12} />
          {t('roleWork.hides', {
            scopes: hidden.map((s) => t(`roleWork.scope.${s}`)).join(', ')
          })}
        </span>
      )}
    </div>
  )
}

/** Le rôle d'une fille dans son propre en-tête : avatar, nom, lecture seule. */
export function RoleTitleBadge({
  child,
  profiles
}: {
  child: ConversationSummary
  profiles: readonly Pick<ProfileSummary, 'id' | 'writesWithoutAsking'>[]
}) {
  const { t } = useTranslation()
  if (!child.role) return null
  return (
    <span
      className="role-title-badge no-drag"
      aria-label={t('roleWork.titleBadge', { label: child.role.label })}
      data-testid="role-title-badge"
    >
      <RoleAvatar role={child.role} size="sm" />
      <span className="role-title-label">{child.role.label}</span>
      <RoleReadOnlyTag level={childReadOnly(child, profiles)} />
    </span>
  )
}
