/**
 * Empreinte d'un dossier git (sortie de `children-review.ts`, fiche 177 ; reprise par les rôles en
 * lecture seule, fiche 223) : HEAD, état, diff des fichiers suivis, taille et date des fichiers
 * nouveaux (leur contenu n'est pas dans le diff). Deux empreintes différentes : le dossier a changé.
 */
import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Run } from '../simulator/run'

const lines = (output: string) => output.split('\n').filter(Boolean)

/** Lève si `git status` échoue (dossier hors d'un dépôt…). */
export async function folderFingerprint(run: Run, workspace: string): Promise<string> {
  const git = (args: string[]) => run('git', args, { cwd: workspace, timeoutMs: 30_000 })
  const hash = createHash('sha256')
  const head = await git(['rev-parse', 'HEAD'])
  hash.update(head.stdout)
  const status = await git(['status', '--porcelain=v1', '-z', '-uall', '--', '.'])
  if (status.code !== 0) throw new Error(status.stderr)
  hash.update(status.stdout)
  hash.update((await git(['diff', 'HEAD', '--binary', '--', '.'])).stdout)
  const untracked = lines(
    (await git(['ls-files', '--others', '--exclude-standard'])).stdout.toString('utf8')
  )
  for (const file of untracked) {
    const info = await stat(join(workspace, file)).catch(() => null)
    hash.update(`${file}\0${info?.size ?? -1}\0${info?.mtimeMs ?? -1}\0`)
  }
  return hash.digest('hex')
}
