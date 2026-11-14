import {
  Accessibility,
  BookOpen,
  Bot,
  Brain,
  Bug,
  Cloud,
  Code,
  Compass,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Layers,
  LayoutDashboard,
  Lock,
  Palette,
  PenTool,
  Rocket,
  ScanSearch,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Terminal,
  TestTube,
  Users,
  Wrench,
  Zap,
  type LucideIcon
} from 'lucide-react'

/**
 * Icônes de rôle (fiche 223) : le nom Lucide de l'en-tête (`shield-check`) vers son composant. Une
 * liste choisie, pas tout Lucide (le paquet entier pèserait sur la fenêtre) ; un nom inconnu prend
 * l'icône par défaut, le rôle reste utilisable.
 */
export const ROLE_ICONS: Readonly<Record<string, LucideIcon>> = {
  accessibility: Accessibility,
  'book-open': BookOpen,
  bot: Bot,
  brain: Brain,
  bug: Bug,
  cloud: Cloud,
  code: Code,
  compass: Compass,
  database: Database,
  eye: Eye,
  'file-text': FileText,
  'flask-conical': FlaskConical,
  gauge: Gauge,
  'git-branch': GitBranch,
  layers: Layers,
  'layout-dashboard': LayoutDashboard,
  lock: Lock,
  palette: Palette,
  'pen-tool': PenTool,
  rocket: Rocket,
  'scan-search': ScanSearch,
  search: Search,
  server: Server,
  'shield-check': ShieldCheck,
  smartphone: Smartphone,
  terminal: Terminal,
  'test-tube': TestTube,
  users: Users,
  wrench: Wrench,
  zap: Zap
}

export const roleIcon = (name: string): LucideIcon => ROLE_ICONS[name] ?? Bot
