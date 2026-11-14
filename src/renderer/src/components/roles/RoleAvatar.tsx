import { createElement, useSyncExternalStore, type CSSProperties } from 'react'
import { ACCENT_COLORS, type AccentColor } from '@shared/preferences'
import { TINTS } from '@shared/themes'
import { currentPalette, subscribeTheme, themeKey } from '../../theme'
import { roleIcon } from '../../roles/role-icons'
import '../../roles.css'

export type RoleAvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const ICON_SIZE: Record<RoleAvatarSize, number> = { xs: 11, sm: 14, md: 16, lg: 22 }

/** Teinte d'une couleur de rôle dans la palette affichée (clair, sombre, sépia…). */
export function useRoleTint(color: string): string {
  useSyncExternalStore(subscribeTheme, themeKey)
  const accent: AccentColor = ACCENT_COLORS.includes(color as AccentColor)
    ? (color as AccentColor)
    : 'graphite'
  return TINTS[currentPalette()].accents[accent].accent
}

/**
 * Avatar d'un rôle (fiche 223) : son icône Lucide sur un fond pâle de sa couleur, une des
 * couleurs d'accent de l'app (décision 8). Décoratif : le nom du rôle est dit à côté, ou par
 * `label` quand l'avatar est seul.
 */
export function RoleAvatar({
  role,
  size = 'sm',
  label,
  className,
  testId
}: {
  role: { icon: string; color: string }
  size?: RoleAvatarSize
  /** Nom à dire aux lecteurs d'écran quand rien d'autre ne le dit. */
  label?: string
  className?: string
  testId?: string
}) {
  const tint = useRoleTint(role.color)
  return (
    <span
      className={`role-avatar ${size}${className ? ` ${className}` : ''}`}
      style={{ '--role': tint } as CSSProperties}
      data-color={role.color}
      data-icon={role.icon}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      {createElement(roleIcon(role.icon), {
        size: ICON_SIZE[size],
        strokeWidth: 2,
        'aria-hidden': true
      })}
    </span>
  )
}
