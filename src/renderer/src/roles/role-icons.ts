/**
 * Icônes de rôle (fiche 223) : noms Lucide d'un en-tête de rôle (`icon: shield-check`) et leur
 * composant, pris dans `lucide-react` déjà livré (aucune dépendance). Un nom inconnu de cette
 * liste (rôle écrit à la main) s'affiche avec l'icône par défaut.
 */
import {
  Accessibility,
  BookOpen,
  Bot,
  Brain,
  Bug,
  Code,
  Compass,
  Database,
  FlaskConical,
  Gauge,
  Globe,
  LayoutDashboard,
  Lock,
  Palette,
  PenTool,
  Rocket,
  ScanSearch,
  Server,
  ShieldCheck,
  Smartphone,
  Wrench,
  type LucideIcon
} from 'lucide-react'

/** Icônes proposées par l'assistant, dans l'ordre de la grille (maquette A1). */
export const ROLE_ICONS: Readonly<Record<string, LucideIcon>> = {
  'shield-check': ShieldCheck,
  'scan-search': ScanSearch,
  compass: Compass,
  palette: Palette,
  smartphone: Smartphone,
  'layout-dashboard': LayoutDashboard,
  server: Server,
  'book-open': BookOpen,
  'flask-conical': FlaskConical,
  bug: Bug,
  lock: Lock,
  gauge: Gauge,
  database: Database,
  globe: Globe,
  accessibility: Accessibility,
  rocket: Rocket,
  'pen-tool': PenTool,
  brain: Brain,
  code: Code,
  wrench: Wrench,
  bot: Bot
}

export const ROLE_ICON_NAMES = Object.keys(ROLE_ICONS)

/** Composant de l'icône d'un rôle ; icône par défaut pour un nom inconnu. */
export const roleIcon = (name: string): LucideIcon => ROLE_ICONS[name] ?? Bot
