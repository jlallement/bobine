/**
 * Dossier existant ; un lien vers un dossier compte. Sans alias (`@shared`) ni import de valeur hors
 * de Node : les sondes (`pnpm opencode-probe`, `pnpm bob-probe`) chargent les modules qui s'en
 * servent sous Node, sans bundler (`agent-config/rules.ts`).
 */
import { statSync } from 'node:fs'

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
