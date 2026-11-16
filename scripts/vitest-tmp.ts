/**
 * Dossier temporaire propre à chaque passage de `vitest` (fiche 041) : les tests créent beaucoup de
 * dossiers jetables (`mkdtempSync(join(tmpdir(), …))`) ; ils vont tous ici et disparaissent à la
 * fin, au lieu de s'accumuler par milliers dans le dossier temporaire du système.
 */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'bobine-vitest-'))
  if (process.platform === 'win32') {
    // Sous Windows (fiche 229) : `os.tmpdir()` lit `TEMP`/`TMP`, pas `TMPDIR`. Et le dossier
    // temporaire peut s'y écrire en noms courts 8.3 (`C:\Users\RUNNER~1\…` sur GitHub), alors que
    // git et l'app rendent les noms longs : le dossier des essais est donné en noms longs.
    const long = realpathSync.native(dir)
    process.env['TEMP'] = long
    process.env['TMP'] = long
    process.env['TMPDIR'] = long
  } else process.env['TMPDIR'] = dir
  return () => rmSync(dir, { recursive: true, force: true })
}
