/**
 * Icônes de rôle (fiche 223) : noms Lucide d'un en-tête de rôle (`icon: shield-check`) et leur
 * composant, pris dans `lucide-react` déjà livré (aucune dépendance). Une liste choisie, pas tout
 * Lucide (le paquet entier pèserait sur la fenêtre) ; la même pour la grille de l'assistant et pour
 * l'affichage. Un nom inconnu de cette liste (rôle écrit à la main) s'affiche avec l'icône par
 * défaut, le rôle reste utilisable.
 */
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
  Globe,
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
  bot: Bot,
  cloud: Cloud,
  eye: Eye,
  'file-text': FileText,
  'git-branch': GitBranch,
  layers: Layers,
  search: Search,
  terminal: Terminal,
  'test-tube': TestTube,
  users: Users,
  zap: Zap
}

export const ROLE_ICON_NAMES = Object.keys(ROLE_ICONS)

/**
 * Composant de l'icône d'un rôle ; icône par défaut pour un nom inconnu. `Object.hasOwn` : un nom
 * hérité de l'objet (`constructor`, `toString`, `__proto__`), valide pour l'en-tête d'un fichier,
 * ne doit pas rendre une fonction d'`Object` (écran blanc).
 */
export const roleIcon = (name: string): LucideIcon =>
  Object.hasOwn(ROLE_ICONS, name) ? (ROLE_ICONS[name] ?? Bot) : Bot
