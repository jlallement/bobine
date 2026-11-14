import { Split, X } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import type { RoleView } from '@shared/roles'
import { RoleAvatar, RoleStack, useRoleTint } from './RoleAvatar'
import { roleDescription } from './role-view'

/**
 * Saisie d'un message pour des rôles (fiche 223, maquettes 02-3 et 02-4) : les jetons des rôles
 * choisis, en tête de la saisie, et la ligne « Partira à… » sous elle, qui dit où ira le message.
 */

/** Jetons des rôles choisis ; chacun se retire (×, ou retour arrière en tête de la saisie). */
export function RoleTokens({
  roles,
  onRemove
}: {
  roles: readonly RoleView[]
  onRemove: (name: string) => void
}) {
  if (roles.length === 0) return null
  return (
    <div className="role-tokens" data-testid="role-tokens">
      {roles.map((role) => (
        <RoleToken key={role.name} role={role} onRemove={() => onRemove(role.name)} />
      ))}
    </div>
  )
}

function RoleToken({ role, onRemove }: { role: RoleView; onRemove: () => void }) {
  const { t } = useTranslation()
  const style = useRoleTint(role.color)
  return (
    <span
      className="role-token"
      style={style}
      title={roleDescription(role)}
      data-testid="role-token"
      data-role={role.name}
    >
      <RoleAvatar role={role} size="xs" />
      <span>{role.label}</span>
      <button
        type="button"
        className="role-token-remove"
        aria-label={t('roleWork.token.remove', { label: role.label })}
        onClick={onRemove}
      >
        <X size={11} strokeWidth={3} />
      </button>
    </span>
  )
}

/** Lecture seule d'un rôle telle qu'elle sera : garantie, seulement demandée, ou aucune. */
export type ReadOnlyShown = 'enforced' | 'requested' | undefined

/**
 * « Partira à Expert sécu, dans une conversation fille · Factice · lecture seule · dans ce
 * dossier » ; plusieurs rôles : un résumé. Annoncé aux lecteurs d'écran (`aria-live`).
 */
export function RoleDestination({
  roles,
  agentLabel,
  readOnly,
  draft
}: {
  roles: readonly RoleView[]
  /** Agent de la fille (un seul rôle). */
  agentLabel: string | undefined
  /** Lecture seule de l'unique rôle. */
  readOnly: ReadOnlyShown
  /** Conversation encore vide : les filles se rattachent à une conversation de l'historique. */
  draft: boolean
}) {
  const { t } = useTranslation()
  const single = roles.length === 1 ? roles[0] : undefined
  const style = useRoleTint(single?.color ?? 'graphite')
  if (roles.length === 0) return null
  const details = single
    ? [
        agentLabel,
        readOnly === 'requested'
          ? t('roleWork.readOnlyRequested')
          : readOnly
            ? t('roleWork.readOnly')
            : undefined,
        single.readOnly ? t('roleWork.destination.sameFolder') : t('roleWork.destination.worktree')
      ].filter(Boolean)
    : []
  return (
    <div
      className={`role-destination${single ? ' single' : ''}`}
      style={single ? style : undefined}
      aria-live="polite"
      data-testid="role-destination"
    >
      {single ? <Split size={13} /> : <RoleStack roles={roles} />}
      <span className="role-destination-lead">
        {single ? (
          <Trans
            i18nKey="roleWork.destination.one"
            values={{ label: single.label }}
            components={{ strong: <strong /> }}
          />
        ) : (
          <Trans
            i18nKey="roleWork.destination.many"
            values={{ count: roles.length }}
            components={{ strong: <strong /> }}
          />
        )}
      </span>
      {details.length > 0 && (
        <span className="role-destination-detail">· {details.join(' · ')}</span>
      )}
      {draft && <span className="role-destination-warn">{t('roleWork.destination.draft')}</span>}
    </div>
  )
}
