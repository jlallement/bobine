import { ChevronRight, Eye, EyeOff, Pencil, TriangleAlert } from 'lucide-react'
import { forwardRef, Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { ChildState } from '@shared/children'
import type { LeftBehind } from '@shared/launch-folder'
import type { RoleBadge, RoleScope, RoleSnapshot } from '@shared/roles'
import { Tip } from '../common/Menus'
import { RoleAvatar, roleAvatarState, useRoleStyle } from './RoleAvatar'
import { readOnlyShown } from './role-view'
import { useCompactBadge } from './useCompactBadge'

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
export const RoleReadOnlyTag = forwardRef<
  HTMLSpanElement,
  {
    level: 'enforced' | 'requested' | undefined
    /** Rôle qui écrit du code : dit aussi (carte de proposition). */
    writes?: boolean
    /** En-tête étroit : l'icône seule, le texte en infobulle et pour le lecteur d'écran. */
    compact?: boolean
  }
>(function RoleReadOnlyTag({ level, writes = false, compact = false }, ref) {
  const { t } = useTranslation()
  if (!level) {
    if (!writes) return null
    return (
      <span className="role-tag" data-testid="role-writes" ref={ref}>
        <Pencil size={12} />
        {t('roleWork.writes')}
      </span>
    )
  }
  const requested = level === 'requested'
  const text = t(requested ? 'roleWork.readOnlyRequested' : 'roleWork.readOnly')
  const tag = (
    <span
      ref={ref}
      className={`role-tag read-only${requested ? ' requested' : ''}${compact ? ' compact' : ''}`}
      data-testid="role-read-only"
      data-level={level}
      tabIndex={requested || compact ? 0 : undefined}
    >
      {requested ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
      {compact ? <span className="sr-only">{text}</span> : text}
    </span>
  )
  const hint = requested ? t('roleWork.readOnlyRequestedHint') : undefined
  const tip = compact ? (hint ? `${text} — ${hint}` : text) : hint
  return tip ? <Tip label={tip}>{tag}</Tip> : tag
})

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
  onOpen,
  leftBehind,
  anchor
}: {
  role: RoleBadge
  title: string
  prompt: string
  byAgent: boolean
  /** Partie sans le non commité de la mère (fiche 240). */
  leftBehind?: LeftBehind | undefined
  child: ConversationSummary | undefined
  state: ChildState | undefined
  activity: string | undefined
  profiles: readonly Pick<ProfileSummary, 'id' | 'writesWithoutAsking'>[]
  onOpen: (() => void) | undefined
  /** Carte d'un travail pour le repère du bas du fil (fiche 261) : l'id de l'élément du fil. */
  anchor?: number
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const style = useRoleStyle(role.color)
  const level = child ? childReadOnly(child, profiles) : role.readOnly ? 'enforced' : undefined
  return (
    <div
      className="role-launch"
      style={style}
      data-testid="role-launch"
      data-work-anchor={anchor}
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
          {leftBehind && (
            <span
              className="role-tag warn"
              title={t('children.leftBehind.tagHint', { ...leftBehind })}
              data-testid="role-launch-left-behind"
            >
              <TriangleAlert size={12} aria-hidden />
              {t('children.leftBehind.tag', { count: leftBehind.count })}
            </span>
          )}
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
        <RoleAvatar role={role} size={22} state={roleAvatarState(state)} />
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
 * Méta d'une proposition de l'agent (maquette 03-3, fiche 264, revue UX) : une seule ligne de texte
 * gris séparée par « · » — son rôle, ce qu'il pourra faire (lecture seule garantie ou demandée,
 * écrit dans sa branche ou dans ce dossier), son mode, un rôle du projet, l'agent — et, à part, un
 * rôle du projet qui en remplace un autre du même nom. Sans rôle : la même ligne, sans lui.
 */
export function ProposalRoleMeta({
  role,
  profile,
  agentLabel,
  inFolder = false
}: {
  role: RoleSnapshot | undefined
  profile: Pick<ProfileSummary, 'writesWithoutAsking'> | undefined
  agentLabel: string | undefined
  /** Dépôt sans commit (fiche 262) : un travail qui écrit travaille aussi dans ce dossier. */
  inFolder?: boolean
}) {
  const { t } = useTranslation()
  const hidden = HIDDEN_SCOPES.filter((s) => role?.hides?.includes(s))
  const level = readOnlyShown(role?.readOnly, profile)
  const parts: ReactNode[] = [
    ...(role ? [<span key="role">{role.label}</span>] : []),
    <span
      key="place"
      data-testid={level ? 'role-read-only' : 'proposal-place'}
      {...(level ? { 'data-level': level } : {})}
    >
      {t(
        level === 'requested'
          ? 'workGroup.place.readOnlyRequested'
          : level
            ? 'workGroup.place.readOnly'
            : inFolder
              ? 'workGroup.place.folder'
              : 'workGroup.place.branch'
      )}
    </span>,
    ...(role?.mode
      ? [
          <span key="mode" data-testid="proposal-role-mode">
            {t('workGroup.place.mode', { mode: role.mode })}
          </span>
        ]
      : []),
    ...(role?.scope === 'project'
      ? [
          <span key="project" data-testid="proposal-role-project">
            {t('workGroup.place.project')}
          </span>
        ]
      : []),
    ...(agentLabel ? [<span key="agent">{agentLabel}</span>] : [])
  ]
  return (
    <div className="proposal-role proposal-meta" data-testid="proposal-role" data-role={role?.name}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {part}
        </Fragment>
      ))}
      {hidden.length > 0 && (
        <span className="proposal-meta-warn" role="note" data-testid="proposal-role-hides">
          <TriangleAlert size={12} aria-hidden />
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
  const badge = useRef<HTMLSpanElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const level = childReadOnly(child, profiles)
  // Fenêtre étroite : le titre cède d'abord, puis la pastille se réduit à son icône.
  const compact = useCompactBadge(badge, pill, `${level ?? ''}:${t('roleWork.readOnly')}`)
  if (!child.role) return null
  return (
    <span
      ref={badge}
      className={`role-title-badge no-drag${compact ? ' compact' : ''}`}
      aria-label={t('roleWork.titleBadge', { label: child.role.label })}
      data-testid="role-title-badge"
      data-compact={compact || undefined}
    >
      <RoleAvatar role={child.role} size={22} />
      <span className="role-title-label">{child.role.label}</span>
      <RoleReadOnlyTag ref={pill} level={level} compact={compact} />
    </span>
  )
}

/**
 * Premier message d'une fille avec un rôle, dans son fil (fiche 223) : la demande, et la consigne du
 * rôle repliée sous « Consigne du rôle », comme sur la carte de la mère — le bloc `<bobine_role>`
 * est un contexte de l'app, pas du texte de l'utilisateur.
 */
export function RoleBriefFold({ brief }: { brief: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="role-brief" data-testid="role-brief">
      <button
        type="button"
        className="link-button role-launch-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="role-brief-toggle"
      >
        {t('roleWork.brief')}
        <ChevronRight size={12} className="chevron" />
      </button>
      {open && (
        <div className="child-instruction-text" data-testid="role-brief-text">
          {brief}
        </div>
      )}
    </div>
  )
}
