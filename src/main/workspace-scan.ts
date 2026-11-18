/**
 * Recherche d'un projet dans un dossier sans bloquer le main (fiche 241) : lectures asynchrones,
 * arrêt au premier trouvé. Sert à voir, à la fin d'un tour, si un projet Xcode ou Android est
 * apparu ; même parcours que `findXcodeProjects` / `findAndroidProjects` (profondeur 3, dossiers
 * cachés et `skip` ignorés).
 */
import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface ScanRule {
  /** Dossiers à ne pas parcourir (`node_modules`…). */
  skip: ReadonlySet<string>
  /** Le dossier lu contient-il le projet ? `names` : ses entrées, cachées et `skip` exclues. */
  match: (dir: string, names: readonly string[]) => boolean
}

/** Profondeur des recherches de projet (le dossier lui-même compte pour 1). */
export const SCAN_DEPTH = 3

export async function workspaceHas(root: string, rule: ScanRule): Promise<boolean> {
  const walk = async (dir: string, depth: number): Promise<boolean> => {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return false
    }
    const kept = entries.filter((e) => !e.name.startsWith('.') && !rule.skip.has(e.name))
    if (
      rule.match(
        dir,
        kept.map((e) => e.name)
      )
    )
      return true
    if (depth >= SCAN_DEPTH) return false
    for (const entry of kept) {
      const path = join(dir, entry.name)
      if (!(await isDirectory(entry, path))) continue
      if (await walk(path, depth + 1)) return true
    }
    return false
  }
  return walk(root, 1)
}

async function isDirectory(entry: Dirent, path: string): Promise<boolean> {
  if (entry.isDirectory()) return true
  if (!entry.isSymbolicLink()) return false
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false // Lien cassé…
  }
}
