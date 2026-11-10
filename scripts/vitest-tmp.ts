/**
 * Dossier temporaire propre à chaque passage de `vitest` (fiche 041) : les tests créent beaucoup de
 * dossiers jetables (`mkdtempSync(join(tmpdir(), …))`) ; ils vont tous ici et disparaissent à la
 * fin, au lieu de s'accumuler par milliers dans le dossier temporaire du système.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'bobine-vitest-'))
  process.env['TMPDIR'] = dir
  return () => rmSync(dir, { recursive: true, force: true })
}
