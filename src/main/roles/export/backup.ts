/**
 * Copies de sauvegarde avant d'écrire dans un fichier d'un agent (fiche 223, phase 4, ADR-0047) :
 * dans les données de Bobine (jamais à côté du fichier, où l'agent pourrait la lire comme un mode
 * ou un agent de plus), datées, en nombre borné (les plus anciennes partent).
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { writeFileAtomic } from '../../storage'

/** Copies gardées au plus. */
export const MAX_BACKUPS = 30

/** `2026-11-14T18-03-07-123Z` : triable, sans `:` (noms de fichiers). */
const stamp = (now: Date) => now.toISOString().replace(/[:.]/g, '-')

/**
 * Copie `text` (le contenu qu'on va remplacer de `source`) dans `dir`, sous
 * `<date>-<format>-<nom>`, puis retire les plus anciennes au-delà de `keep`. Rend le chemin écrit.
 */
export function backupFile(
  dir: string,
  source: string,
  format: string,
  text: string,
  { now = new Date(), keep = MAX_BACKUPS }: { now?: Date; keep?: number } = {}
): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const base = `${stamp(now)}-${format}-${basename(source)}`
  const taken = new Set(readdirSync(dir))
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base}.${n}`
  const file = join(dir, name)
  writeFileAtomic(file, text, { mode: 0o600 })
  const copies = readdirSync(dir)
    .filter((f) => !f.endsWith('.tmp'))
    .sort()
  for (const old of copies.slice(0, Math.max(0, copies.length - keep))) {
    rmSync(join(dir, old), { force: true })
  }
  return file
}
