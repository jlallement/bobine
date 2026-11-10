import {
  ArrowLeftRight,
  FileDiff,
  FileText,
  Gauge,
  Globe,
  ListChecks,
  SquareTerminal,
  type LucideProps
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { PanelTab } from '@shared/panel'

type IconProps = Pick<LucideProps, 'size' | 'className'>

/** Contour d'une pomme, au trait des icônes Lucide (qui n'ont pas d'icônes de marque). */
function AppleIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 7.5c-1.6-1.1-4.6-1.2-6.1 1.2-1.7 2.7-.6 7.4 2 10.3 1 1.1 2 1.5 3 1 .7-.3 1.5-.3 2.2 0 1 .5 2-.1 3-1 1.2-1.4 2.1-3.1 2.5-4.6-1.6-.7-2.6-2.3-2.4-4.1.2-1.2.8-2.1 1.7-2.7-1.6-1.4-4.2-1.1-5.9.1Z" />
      <path d="M12 7.5c-.1-2 1.1-3.8 3-4.5" />
    </svg>
  )
}

/** Tête du robot Android, au même trait. */
function AndroidIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 18a8 8 0 0 1 16 0Z" />
      <path d="m7.5 10.5-2-3" />
      <path d="m16.5 10.5 2-3" />
      <circle cx="9" cy="14.5" r="0.6" fill="currentColor" />
      <circle cx="15" cy="14.5" r="0.6" fill="currentColor" />
    </svg>
  )
}

/** Icône de chaque onglet du panneau latéral (le libellé est dans l'info-bulle). */
export const PANEL_ICONS: Record<PanelTab, ComponentType<IconProps>> = {
  session: Gauge,
  browser: Globe,
  simulator: AppleIcon,
  android: AndroidIcon,
  terminal: SquareTerminal,
  tasks: ListChecks,
  acp: ArrowLeftRight,
  changes: FileDiff,
  document: FileText
}
