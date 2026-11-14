import {
  ChevronRight,
  Eye,
  FileWarning,
  FolderGit2,
  Package,
  Plus,
  User,
  Users
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileSummary } from '@shared/agent'
import type { RoleProblem, RoleScope, RoleView } from '@shared/roles'
import { ipcErrorText } from '../../ipc-errors'
import { openRoleWizard, rolesChanged, useRolesListing } from '../../roles/roles-store'
import { problemPath, shownDescription } from '../../roles/role-text'
import { roleErrorText } from './RoleFields'
import { RoleAvatar } from './RoleAvatar'
import { RoleEditPage } from './RoleEditPage'

export interface RolesSettingsProps {
  /** Conversation active : son projet (rôles de `.bobine/roles/`). */
  conversationId?: string | undefined
  conversationProfileId?: string | undefined
  /** Nom du dossier de la conversation active. */
  project?: string | undefined
  profiles: readonly ProfileSummary[]
}

/**
 * Réglages › Rôles (fiche 223, maquettes 04-1 à 04-3) : les rôles du projet, les personnels, puis
 * les fournis, chacun activable ; un clic ouvre son écran d'édition. Un rôle de projet qui en
 * remplace un autre du même nom le dit ; un fichier écarté est montré avec sa raison.
 */
export function RolesSettings(props: RolesSettingsProps) {
  const [editing, setEditing] = useState<{ scope: RoleScope; name: string } | null>(null)
  if (editing) {
    return (
      <RoleEditPage
        {...props}
        scope={editing.scope}
        name={editing.name}
        onBack={() => setEditing(null)}
        onMoved={setEditing}
      />
    )
  }
  return <RolesList {...props} onOpen={(role) => setEditing(role)} />
}

function RolesList(props: RolesSettingsProps & { onOpen: (role: RoleView) => void }) {
  const { t } = useTranslation()
  const { listing, error } = useRolesListing(props.conversationId)
  const [toggleError, setToggleError] = useState<string | null>(null)
  if (!listing) {
    return error ? (
      <p className="field-error" role="alert">
        {ipcErrorText(error)}
      </p>
    ) : null
  }
  const of = (scope: RoleScope) => listing.roles.filter((r) => r.scope === scope)
  const own = [...of('project'), ...of('user')]
  const builtin = of('builtin')
  const toggle = (role: RoleView, enabled: boolean) => {
    setToggleError(null)
    window.api.roles
      .setEnabled(role.name, enabled)
      .then(rolesChanged, (e: unknown) => setToggleError(ipcErrorText(e)))
  }
  const group = (scope: RoleScope, roles: RoleView[], icon: ReactNode, aside: string) =>
    roles.length > 0 && (
      <RoleGroup
        scope={scope}
        roles={roles}
        icon={icon}
        aside={aside}
        project={props.project}
        profiles={props.profiles}
        onOpen={props.onOpen}
        onToggle={toggle}
      />
    )
  return (
    <section className="roles-settings" data-testid="roles-settings">
      <p className="settings-intro">{t('rolesSettings.intro')}</p>
      <div className="roles-actions">
        <button className="btn primary" onClick={() => openRoleWizard()} data-testid="roles-new">
          <Plus size={14} aria-hidden />
          {t('rolesSettings.new')}
        </button>
      </div>
      {toggleError && (
        <p className="field-error" role="alert">
          {toggleError}
        </p>
      )}
      {own.length === 0 && <RolesEmpty builtin={builtin} />}
      {group('project', of('project'), <FolderGit2 size={15} aria-hidden />, '.bobine/roles/')}
      {group('user', of('user'), <User size={15} aria-hidden />, t('rolesSettings.userAside'))}
      {group(
        'builtin',
        builtin,
        <Package size={15} aria-hidden />,
        t('rolesSettings.builtinAside', {
          active: builtin.filter((r) => r.enabled).length,
          total: builtin.length
        })
      )}
      {listing.problems.length > 0 && <RoleProblems problems={listing.problems} />}
    </section>
  )
}

function RoleGroup({
  scope,
  roles,
  icon,
  aside,
  project,
  profiles,
  onOpen,
  onToggle
}: {
  scope: RoleScope
  project?: string | undefined
  roles: RoleView[]
  icon: ReactNode
  aside: string
  profiles: readonly ProfileSummary[]
  onOpen: (role: RoleView) => void
  onToggle: (role: RoleView, enabled: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="roles-group" data-testid={`roles-group-${scope}`}>
      <h3 className="roles-group-head">
        {icon}
        <span>
          {scope === 'project' && project
            ? t('roleForm.scope.project', { project })
            : t(`rolesSettings.group.${scope}`)}
        </span>
        <span className="roles-group-aside">{aside}</span>
      </h3>
      <ul className="settings-list roles-list">
        {roles.map((role) => (
          <RoleRow
            key={role.name}
            role={role}
            profiles={profiles}
            onOpen={() => onOpen(role)}
            onToggle={(enabled) => onToggle(role, enabled)}
          />
        ))}
      </ul>
    </div>
  )
}

function RoleRow({
  role,
  profiles,
  onOpen,
  onToggle
}: {
  role: RoleView
  profiles: readonly ProfileSummary[]
  onOpen: () => void
  onToggle: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const agent = role.agent ? profiles.find((p) => p.id === role.agent) : undefined
  return (
    <li
      className={`role-row${role.enabled ? '' : ' off'}`}
      data-testid="role-row"
      data-role={role.name}
      data-scope={role.scope}
      data-enabled={role.enabled}
    >
      <button className="role-row-open" onClick={onOpen} data-testid="role-row-open">
        <RoleAvatar role={role} size={32} />
        <span className="role-row-text">
          <span className="role-row-label">{role.label}</span>
          <span className="role-row-desc">{shownDescription(role)}</span>
        </span>
        <span className="role-row-tags">
          {role.hides?.length ? (
            <span className="role-tag warn" data-testid="role-hides">
              {t('rolesSettings.hides', {
                scopes: role.hides.map((s) => t(`rolesSettings.scope.${s}`)).join(', ')
              })}
            </span>
          ) : null}
          {role.agent && (
            <span className={`role-tag${agent?.available ? '' : ' warn'}`}>
              {agent?.available
                ? agent.label
                : t('rolesSettings.agentMissing', { agent: agent?.label ?? role.agent })}
            </span>
          )}
          {role.readOnly && (
            <span className="role-tag">
              <Eye size={12} aria-hidden />
              {t('rolesSettings.readOnly')}
            </span>
          )}
        </span>
        <ChevronRight size={15} aria-hidden className="role-row-chevron" />
      </button>
      <label className="switch" title={t('rolesSettings.enabled', { label: role.label })}>
        <input
          type="checkbox"
          checked={role.enabled}
          aria-label={t('rolesSettings.enabled', { label: role.label })}
          onChange={(e) => onToggle(e.target.checked)}
          data-testid="role-row-enabled"
        />
        <span />
      </label>
    </li>
  )
}

/** Aucun rôle à soi (maquette 04-3) : ce qu'apporte une équipe, et de quoi commencer. */
function RolesEmpty({ builtin }: { builtin: RoleView[] }) {
  const { t } = useTranslation()
  return (
    <div className="roles-empty" data-testid="roles-empty">
      <div className="roles-empty-avatars" aria-hidden>
        {builtin.slice(0, 3).map((role, i) => (
          <RoleAvatar key={role.name} role={role} size={44} className={i === 1 ? 'center' : ''} />
        ))}
        {builtin.length === 0 && <Users size={26} />}
      </div>
      <h3 className="roles-empty-title">{t('rolesSettings.empty.title')}</h3>
      <p className="roles-empty-text">{t('rolesSettings.empty.text')}</p>
      <button className="btn" onClick={() => openRoleWizard()} data-testid="roles-empty-new">
        {t('rolesSettings.empty.action')}
      </button>
    </div>
  )
}

function RoleProblems({ problems }: { problems: RoleProblem[] }) {
  const { t } = useTranslation()
  return (
    <div className="roles-group" data-testid="roles-problems">
      <h3 className="roles-group-head">
        <FileWarning size={15} aria-hidden />
        <span>{t('rolesSettings.problems.title')}</span>
      </h3>
      <ul className="settings-list roles-list">
        {problems.map((problem) => (
          <li key={problem.file} className="role-problem" data-testid="role-problem">
            <span className="role-problem-file" title={problem.file}>
              {problemPath(problem)}
            </span>
            <span className="role-problem-reason">{roleErrorText(problem.error)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
