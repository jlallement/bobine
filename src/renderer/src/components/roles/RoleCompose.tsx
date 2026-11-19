import { Reply, Split, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { RoleView } from '@shared/roles'
import { RoleAvatar, RoleStack, useRoleStyle } from './RoleAvatar'

/**
 * Saisie d'un message pour des rôles (fiche 223, maquettes 02-3 et 02-4) : les jetons des rôles
 * choisis, en tête de la saisie, et la ligne « Partira à… » sous elle, qui dit où ira le message.
 */

/** Jetons des rôles choisis ; chacun se retire (×, ou retour arrière en tête de la saisie). */
export function RoleTokens({
  roles,
  onRemove,
  replying
}: {
  roles: readonly RoleView[]
  onRemove: (name: string) => void
  /** Jeton d'un rôle dont on poursuit le travail (« Répondre à … », fiche 263). */
  replying?: string | undefined
}) {
  if (roles.length === 0) return null
  return (
    <div className="role-tokens" data-testid="role-tokens">
      {roles.map((role) => (
        <RoleToken
          key={role.name}
          role={role}
          reply={role.name === replying}
          onRemove={() => onRemove(role.name)}
        />
      ))}
    </div>
  )
}

function RoleToken({
  role,
  reply,
  onRemove
}: {
  role: RoleView
  reply: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const style = useRoleStyle(role.color)
  return (
    <span
      className="role-token"
      style={style}
      title={role.description}
      data-testid="role-token"
      data-role={role.name}
      data-reply={reply || undefined}
    >
      <RoleAvatar role={role} size={18} />
      <span>{role.label}</span>
      {reply && (
        <span className="role-token-reply">
          <Reply size={11} aria-hidden />
          {t('roleWork.destination.replyToken')}
        </span>
      )}
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
  empty = false,
  sending = false,
  opinion,
  launch,
  reply = false
}: {
  roles: readonly RoleView[]
  /** Agent de la fille (un seul rôle). */
  agentLabel: string | undefined
  /** Lecture seule de l'unique rôle. */
  readOnly: ReadOnlyShown
  /** Rien à demander une fois les `@rôle` retirés : l'envoi est désactivé, la ligne dit pourquoi. */
  empty?: boolean
  /** Filles en cours de lancement : un second envoi attend. */
  sending?: boolean
  /**
   * « Juste un avis » (fiche 262) : dans le dossier de la mère, en lecture seule, non commité vu ;
   * « Changer… » (dans `launch`) revient au travail dans un worktree.
   */
  opinion?: { sees: number }
  /** Où partira un rôle qui écrit (fiche 262) : le segment de la ligne (`LaunchLine`). */
  launch?: { node: ReactNode }
  /** Suite d'un travail déjà lancé (« Répondre à … », fiche 263) : il va à ce travail. */
  reply?: boolean
}) {
  const { t } = useTranslation()
  const single = roles.length === 1 ? roles[0] : undefined
  const style = useRoleStyle(single?.color ?? 'graphite')
  if (roles.length === 0) return null
  const details = reply
    ? []
    : opinion
      ? [
          single ? agentLabel : undefined,
          t('roleWork.destination.sameFolder'),
          readOnly === 'requested' ? t('roleWork.readOnlyRequested') : t('roleWork.readOnly'),
          opinion.sees > 0
            ? t(
                single
                  ? 'roleWork.destination.opinionSeesOne'
                  : 'roleWork.destination.opinionSeesMany',
                { count: opinion.sees }
              )
            : undefined
        ].filter(Boolean)
      : single
        ? [
            agentLabel,
            readOnly === 'requested'
              ? t('roleWork.readOnlyRequested')
              : readOnly
                ? t('roleWork.readOnly')
                : undefined,
            // Rôle qui écrit : le segment `launch` dit d'où il partira (fiche 262, revue UX).
            single.readOnly
              ? t('roleWork.destination.sameFolder')
              : launch
                ? undefined
                : t('roleWork.destination.worktree')
          ].filter(Boolean)
        : []
  return (
    <div
      className={`role-destination${single ? ' single' : ''}`}
      style={single ? style : undefined}
      aria-live="polite"
      data-testid="role-destination"
      data-opinion={opinion ? '' : undefined}
      data-reply={reply || undefined}
    >
      {single ? <Split size={13} /> : <RoleStack roles={roles} />}
      <span className="role-destination-lead">
        {reply && single ? (
          <Trans
            i18nKey="roleWork.destination.reply"
            values={{ label: single.label }}
            components={{ strong: <strong /> }}
          />
        ) : opinion ? (
          <Trans
            i18nKey={
              single ? 'roleWork.destination.opinionOne' : 'roleWork.destination.opinionMany'
            }
            values={single ? { label: single.label } : { count: roles.length }}
            components={{ strong: <strong /> }}
          />
        ) : single ? (
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
        // « · » accroché au segment d'avant (espace insécable) : jamais en tête de ligne.
        <span className="role-destination-detail">
          {'\u00a0· '}
          {details.join('\u00a0· ')}
        </span>
      )}
      {launch && !sending && launch.node}
      {empty && !sending && (
        <span className="role-destination-warn" data-testid="role-destination-empty">
          {t('roleWork.destination.empty')}
        </span>
      )}
      {sending && (
        <span className="role-destination-detail" data-testid="role-destination-sending">
          {'\u00a0· '}
          {t('roleWork.destination.sending')}
        </span>
      )}
    </div>
  )
}
