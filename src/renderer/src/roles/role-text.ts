/**
 * Textes affichés d'un rôle (fiche 223, phase 3A, relecture) : le chemin d'un fichier écarté se lit
 * relatif à sa portée, le chemin complet restant en infobulle. (La description d'un rôle fourni
 * arrive du main déjà dans la langue de l'interface : ADR-0046.)
 */
import type { RoleProblem } from '@shared/roles'

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
