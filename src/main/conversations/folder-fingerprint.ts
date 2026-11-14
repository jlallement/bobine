/**
 * Empreinte d'un dossier git (sortie de `children-review.ts`, fiche 177 ; reprise par les rôles en
 * lecture seule, fiche 223) : HEAD, état, diff des fichiers suivis, taille et date des fichiers
 * nouveaux (leur contenu n'est pas dans le diff). Deux empreintes différentes : le dossier a changé.
 */
import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Run } from '../simulator/run'

/**
 * Lève si une commande git échoue ou dépasse son délai (dossier hors d'un dépôt, dépôt sans
 * commit…) : une empreinte partielle ferait croire à un changement, ou le cacherait.
 */
export async function folderFingerprint(run: Run, workspace: string): Promise<string> {
  const git = async (args: string[]) => {
    const result = await run('git', args, { cwd: workspace, timeoutMs: 30_000 })
    if (result.code !== 0 || result.timedOut) {
      throw new Error(`git ${args[0] ?? ''} : ${result.timedOut ? 'délai dépassé' : result.stderr}`)
    }
    return result.stdout
  }
  const hash = createHash('sha256')
  hash.update(await git(['rev-parse', 'HEAD']))
  hash.update(await git(['status', '--porcelain=v1', '-z', '-uall', '--', '.']))
  hash.update(await git(['diff', 'HEAD', '--binary', '--', '.']))
  const untracked = (await git(['ls-files', '-z', '--others', '--exclude-standard']))
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
  for (const file of untracked) {
    const info = await stat(join(workspace, file)).catch(() => null)
    hash.update(`${file}\0${info?.size ?? -1}\0${info?.mtimeMs ?? -1}\0`)
  }
  return hash.digest('hex')
}
