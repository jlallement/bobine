import { createElement, useSyncExternalStore, type CSSProperties } from 'react'
import type { ChildState } from '@shared/children'
import type { AccentColor } from '@shared/preferences'
import type { RoleBadge } from '@shared/roles'
import { TINTS } from '@shared/themes'
import { currentPalette, subscribeTheme, themeKey } from '../../theme'
import { roleIcon } from './role-icons'

/**
 * États d'un avatar de rôle (fiche 223, maquette 03-5), un seul langage partout : au repos, au
 * travail (anneau de sa couleur qui tourne), attend votre accord (pastille ambre), a rendu
 * (pastille verte, jusqu'à lecture), échec ou arrêt (pastille rouge), désactivé (gris).
 */
export type RoleAvatarState = 'idle' | 'running' | 'waiting' | 'done' | 'error' | 'off'

/** État d'une fille vers l'état de l'avatar de son rôle : « lu » redevient « au repos ». */
export function roleAvatarState(state: ChildState): RoleAvatarState {
  switch (state) {
    case 'running':
      return 'running'
    case 'waiting':
      return 'waiting'
    case 'unread':
      return 'done'
    case 'error':
      return 'error'
    case 'done':
      return 'idle'
  }
}

/**
 * Couleur d'un rôle dans la palette affichée : une des couleurs d'accent de l'app (décision 8),
 * suivie au changement de thème. Posée en `--role` ; le CSS en tire le fond doux et le liseré.
 */
export function useRoleTint(color: AccentColor): CSSProperties {
  useSyncExternalStore(subscribeTheme, themeKey)
  const tint =
    TINTS[currentPalette()].accents[color]?.accent ??
    TINTS[currentPalette()].accents.graphite.accent
  return { '--role': tint } as CSSProperties
}

export function RoleAvatar({
  role,
  size = 'md',
  state = 'idle',
  className
}: {
  role: Pick<RoleBadge, 'icon' | 'color'>
  size?: 'xs' | 'sm' | 'md'
  state?: RoleAvatarState
  className?: string
}) {
  const style = useRoleTint(role.color)
  const iconSize = size === 'xs' ? 11 : size === 'sm' ? 13 : 16
  return (
    <span
      className={`role-avatar ${size}${className ? ` ${className}` : ''}`}
      data-state={state}
      style={style}
      aria-hidden="true"
      data-testid="role-avatar"
    >
      {createElement(roleIcon(role.icon), { size: iconSize })}
    </span>
  )
}

/** Avatars empilés (en-tête de « Sous-tâches », ligne « Partira à 3 rôles »). */
export function RoleStack({
  roles
}: {
  roles: readonly Pick<RoleBadge, 'name' | 'icon' | 'color'>[]
}) {
  return (
    <span className="role-stack" aria-hidden="true">
      {roles
        .filter((role, i) => roles.findIndex((r) => r.name === role.name) === i)
        .slice(0, 4)
        .map((role) => (
          <RoleAvatar key={role.name} role={role} size="xs" />
        ))}
    </span>
  )
}
