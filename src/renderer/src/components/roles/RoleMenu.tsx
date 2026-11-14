import { CornerDownLeft, Ellipsis, FolderGit2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RoleView } from '@shared/roles'
import { RoleAvatar, RoleStack } from './RoleAvatar'
import { roleDescription } from './role-view'

/**
 * Rôles dans le menu `@` de la saisie (fiche 223, maquettes 02-1, 02-2, 02-7) : en tête, avant
 * les fichiers ; cinq au plus tant que rien n'est tapé (« Tous les rôles (8) » au-delà) ; un rôle
 * du projet porte une marque ; « + Nouveau rôle » seulement si l'app sait l'ouvrir.
 */

/** Entrées du menu `@` propres aux rôles. */
export type RoleMenuEntry =
  | { kind: 'role'; role: RoleView }
  | { kind: 'role-more'; count: number }
  | { kind: 'role-new'; query: string }

/** Rôles montrés tant que rien n'est tapé après `@`. */
export const ROLES_SHOWN = 5

/** Les entrées des rôles pour ce qui est tapé : rôles trouvés, « Tous… », « + Nouveau rôle… ». */
export function roleMenuEntries(
  found: readonly RoleView[],
  query: string,
  options: { all: boolean; canCreate: boolean }
): RoleMenuEntry[] {
  const capped = !query && !options.all && found.length > ROLES_SHOWN
  const shown = capped ? found.slice(0, ROLES_SHOWN) : found
  return [
    ...shown.map((role) => ({ kind: 'role' as const, role })),
    ...(capped ? [{ kind: 'role-more' as const, count: found.length }] : []),
    ...(query && options.canCreate ? [{ kind: 'role-new' as const, query }] : [])
  ]
}

/** Une entrée de rôle du menu ; `index` : sa place parmi toutes les entrées (clavier). */
export function RoleMenuRow({
  entry,
  index,
  active,
  onHover,
  onPick
}: {
  entry: RoleMenuEntry
  index: number
  active: boolean
  onHover: (index: number) => void
  onPick: () => void
}) {
  const { t } = useTranslation()
  const common = {
    type: 'button' as const,
    role: 'option',
    'aria-selected': active,
    'data-index': index,
    onMouseDown: (e: { preventDefault: () => void }) => {
      e.preventDefault()
      onPick()
    },
    onMouseMove: () => onHover(index)
  }
  if (entry.kind === 'role-more') {
    return (
      <button
        {...common}
        className={`command-item role-item role-more${active ? ' active' : ''}`}
        data-testid="role-more"
      >
        <Ellipsis size={14} className="role-more-icon" />
        <span>{t('roleWork.menu.all', { count: entry.count })}</span>
      </button>
    )
  }
  if (entry.kind === 'role-new') {
    return (
      <button
        {...common}
        className={`command-item role-item role-new${active ? ' active' : ''}`}
        data-testid="role-new"
      >
        <Plus size={14} />
        <span>{t('roleWork.menu.newNamed', { name: entry.query })}</span>
      </button>
    )
  }
  const { role } = entry
  return (
    <button
      {...common}
      className={`command-item role-item${active ? ' active' : ''}`}
      title={roleDescription(role)}
      aria-label={t('roleWork.menu.option', {
        label: role.label,
        description: roleDescription(role)
      })}
      data-testid="role-item"
      data-role={role.name}
    >
      <RoleAvatar role={role} size="sm" />
      <span className="role-item-name">{role.label}</span>
      <span className="command-description">{roleDescription(role)}</span>
      {role.scope === 'project' && (
        <span className="role-item-project" title={t('roleWork.menu.project')}>
          <FolderGit2 size={13} aria-label={t('roleWork.menu.project')} />
        </span>
      )}
      {active && <CornerDownLeft size={13} className="role-item-enter" aria-hidden="true" />}
    </button>
  )
}

/**
 * Menu `@` sans aucun rôle actif (maquette 02-7) : une invitation, pas un trou. « Créer un rôle »
 * seulement si l'app sait ouvrir l'assistant ; « Ne plus montrer » la retire pour de bon.
 */
export function RolesInvite({
  onCreate,
  onHide
}: {
  onCreate: (() => void) | undefined
  onHide: () => void
}) {
  const { t } = useTranslation()
  const sample = [
    { name: 'a', icon: 'shield-check', color: 'orange' as const },
    { name: 'b', icon: 'scan-search', color: 'blue' as const },
    { name: 'c', icon: 'palette', color: 'pink' as const }
  ]
  return (
    <div className="roles-invite" data-testid="roles-invite">
      <RoleStack roles={sample} />
      <div className="roles-invite-text">
        <strong>{t('roleWork.invite.title')}</strong>
        <span>{t('roleWork.invite.text')}</span>
        <span className="roles-invite-actions">
          {onCreate && (
            <button
              type="button"
              className="btn small primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCreate}
            >
              <Plus size={13} /> {t('roleWork.invite.create')}
            </button>
          )}
          <button
            type="button"
            className="link-button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onHide}
            data-testid="roles-invite-hide"
          >
            {t('roleWork.invite.hide')}
          </button>
        </span>
      </div>
    </div>
  )
}

/** Pied du menu : « + Nouveau rôle… » et « Gérer », chacun seulement si l'app sait l'ouvrir. */
export function RoleMenuFooterActions({
  onCreate,
  onManage
}: {
  onCreate: (() => void) | undefined
  onManage: (() => void) | undefined
}) {
  const { t } = useTranslation()
  if (!onCreate && !onManage) return null
  return (
    <span className="role-menu-actions">
      {onCreate && (
        <button
          type="button"
          className="link-button accent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCreate}
          data-testid="role-menu-new"
        >
          <Plus size={12} /> {t('roleWork.menu.new')}
        </button>
      )}
      {onManage && (
        <button
          type="button"
          className="link-button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onManage}
          data-testid="role-menu-manage"
        >
          {t('roleWork.menu.manage')}
        </button>
      )}
    </span>
  )
}
