/**
 * Textes affichés d'un rôle (fiche 223, phase 3A, relecture) : la description d'un rôle fourni
 * part à l'agent en anglais (ADR-0014), mais l'interface la montre dans sa langue ; le chemin d'un
 * fichier écarté se lit relatif à sa portée, le chemin complet restant en infobulle.
 */
import i18next from 'i18next'
import type { RoleProblem, RoleScope } from '@shared/roles'

/** Description traduite de chaque rôle fourni, par son nom (`main/roles/builtin.ts`). */
const BUILTIN_DESCRIPTIONS = {
  'ux-ui-expert': () => i18next.t('rolesSettings.builtinDescription.uxUiExpert'),
  'flutter-expert': () => i18next.t('rolesSettings.builtinDescription.flutterExpert'),
  'front-architect': () => i18next.t('rolesSettings.builtinDescription.frontArchitect'),
  'back-architect': () => i18next.t('rolesSettings.builtinDescription.backArchitect'),
  'security-expert': () => i18next.t('rolesSettings.builtinDescription.securityExpert'),
  'tech-lead': () => i18next.t('rolesSettings.builtinDescription.techLead'),
  'code-reviewer': () => i18next.t('rolesSettings.builtinDescription.codeReviewer')
} as const satisfies Record<string, () => string>

/**
 * Description à afficher : traduite pour un rôle fourni, telle quelle sinon (un rôle personnel ou
 * du projet est écrit par l'utilisateur, dans sa langue).
 */
export function shownDescription(role: {
  name: string
  scope?: RoleScope
  description: string
}): string {
  if (role.scope !== 'builtin') return role.description
  const translated = BUILTIN_DESCRIPTIONS[role.name as keyof typeof BUILTIN_DESCRIPTIONS]
  return translated ? translated() : role.description
}

/**
 * Chemin d'un fichier écarté, relatif à sa portée : `.bobine/roles/x.md` dans le projet,
 * `roles/x.md` dans les données de Bobine (le dossier lui-même pour `tooMany` ou `link`).
 */
export function problemPath(problem: RoleProblem): string {
  const file = problem.file.replace(/\\/g, '/')
  const marker = problem.scope === 'project' ? '/.bobine/' : '/roles'
  const at = file.lastIndexOf(marker)
  return at >= 0 ? file.slice(at + 1) : (file.split('/').pop() ?? file)
}
