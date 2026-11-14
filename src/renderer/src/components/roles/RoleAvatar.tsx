import { createElement, useSyncExternalStore, type CSSProperties } from 'react'
import type { ChildState } from '@shared/children'
import { ACCENT_COLORS, type AccentColor } from '@shared/preferences'
import type { RoleBadge } from '@shared/roles'
import { TINTS } from '@shared/themes'
import { currentPalette, subscribeTheme, themeKey } from '../../theme'
import { roleIcon } from '../../roles/role-icons'

/**
 * Côté de l'avatar en pixels, une valeur par usage des maquettes : 18 (jetons, barre latérale,
 * piles), 22 (menu `@`, lignes de « Sous-tâches », comptes rendus), 24 (champs de l'assistant), 30
 * (carte d'une fille au travail), 32 (Réglages › Rôles, section Équipe), 44 (en-têtes).
 */
export type RoleAvatarSize = 18 | 22 | 24 | 30 | 32 | 44

const ICON_SIZE: Record<RoleAvatarSize, number> = { 18: 11, 22: 13, 24: 14, 30: 16, 32: 16, 44: 22 }

/**
 * États d'un avatar de rôle (fiche 223, maquette 03-5), un seul langage partout : au repos, au
 * travail (anneau de sa couleur qui pulse), attend votre accord (pastille ambre), a rendu
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
 * Teinte d'une couleur de rôle dans la palette affichée (clair, sombre, sépia…) : une des couleurs
 * d'accent de l'app (décision 8), suivie au changement de thème ; graphite pour une valeur inconnue.
 */
export function useRoleTint(color: string): string {
  useSyncExternalStore(subscribeTheme, themeKey)
  const accent: AccentColor = ACCENT_COLORS.includes(color as AccentColor)
    ? (color as AccentColor)
    : 'graphite'
  return TINTS[currentPalette()].accents[accent].accent
}

/** La teinte posée en `--role` : le CSS en tire le fond doux, le liseré et l'icône. */
export function useRoleStyle(color: string): CSSProperties {
  return { '--role': useRoleTint(color) } as CSSProperties
}

/**
 * Avatar d'un rôle (fiche 223) : son icône Lucide sur un fond pâle de sa couleur, avec l'état de
 * la fille quand il y en a une. Décoratif : le nom du rôle est dit à côté, ou par `label` quand
 * l'avatar est seul.
 */
export function RoleAvatar({
  role,
  size = 30,
  state = 'idle',
  label,
  className,
  testId = 'role-avatar'
}: {
  role: { icon: string; color: string }
  size?: RoleAvatarSize
  state?: RoleAvatarState
  /** Nom à dire aux lecteurs d'écran quand rien d'autre ne le dit. */
  label?: string
  className?: string
  testId?: string
}) {
  const style = useRoleStyle(role.color)
  return (
    <span
      className={`role-avatar s${size}${className ? ` ${className}` : ''}`}
      style={style}
      data-state={state}
      data-color={role.color}
      data-icon={role.icon}
      data-testid={testId}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {createElement(roleIcon(role.icon), {
        size: ICON_SIZE[size],
        strokeWidth: 2,
        'aria-hidden': true
      })}
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
          <RoleAvatar key={role.name} role={role} size={18} />
        ))}
    </span>
  )
}
