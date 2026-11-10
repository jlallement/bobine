/**
 * Contenu de `@git-changes` (fiche 057) : l'état git du dossier et son diff depuis le dernier
 * commit, en texte, joint au message. Jamais d'erreur : sans dépôt ou sans git, le texte le dit.
 * Fiche 155 : les fichiers que l'agent exclut (`.bobignore`…) sont sautés, et le texte le dit.
 */
import { join, posix } from 'node:path'
import type { Exclusions } from '../agent-config/exclusions'
import type { Run } from '../simulator/run'

/** Au-delà, le diff est coupé (un message n'a pas à porter un dépôt entier). */
export const MAX_CONTEXT_DIFF_BYTES = 100 * 1024

const text = (buffer: Buffer) => buffer.toString('utf8').trimEnd()

/**
 * Fichiers modifiés du dossier que l'agent exclut, relatifs à la racine du dépôt (`git status
 * --porcelain` : chemins depuis la racine, anciens noms des renommages compris).
 */
async function excludedChanges(
  run: Run,
  workspace: string,
  git: string,
  exclusions: Exclusions
): Promise<string[]> {
  // Le dossier dans le dépôt (`sous/dossier/`) : la racine du dépôt peut s'écrire autrement que le
  // dossier (lien symbolique, `/private/var` sur macOS).
  const prefix = text((await run(git, ['rev-parse', '--show-prefix'], { cwd: workspace })).stdout)
  const status = await run(
    git,
    [
      '-c',
      'core.quotePath=false',
      'status',
      '--porcelain',
      '-z',
      '--untracked-files=all',
      '--',
      '.'
    ],
    { cwd: workspace, timeoutMs: 30_000 }
  )
  if (status.code !== 0) return []
  const paths: string[] = []
  const fields = status.stdout.toString('utf8').split('\0')
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i] as string
    if (entry.length < 4) continue
    paths.push(entry.slice(3))
    // Renommage ou copie : l'ancien nom suit.
    if (/^[RC]|^.[RC]/.test(entry) && fields[i + 1]) paths.push(fields[++i] as string)
  }
  const excluded: string[] = []
  for (const path of paths) {
    const inside = posix.relative(prefix || '.', path)
    if (await exclusions.isExcluded(join(workspace, inside))) excluded.push(path)
  }
  return excluded
}

export async function gitChangesText(
  run: Run,
  workspace: string,
  git = 'git',
  /** Fichiers d'exclusion de l'agent (fiche 155) ; absents, rien n'est sauté. */
  exclusions?: Exclusions
): Promise<string> {
  const top = await run(git, ['rev-parse', '--show-toplevel'], {
    cwd: workspace,
    timeoutMs: 10_000
  })
  if (top.code !== 0) return 'Le dossier de la conversation n’est pas un dépôt git.'
  const skipped = exclusions ? await excludedChanges(run, workspace, git, exclusions) : []
  // Chemins sautés : écartés de l'état et du diff par des chemins d'exclusion git.
  const pathspec = ['.', ...skipped.map((path) => `:(exclude,top,literal)${path}`)]
  const status = await run(
    git,
    [
      'status',
      '--short',
      '--branch',
      ...(skipped.length > 0 ? ['--untracked-files=all'] : []),
      '--',
      ...pathspec
    ],
    { cwd: workspace, timeoutMs: 30_000 }
  )
  const hasHead =
    (await run(git, ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: workspace })).code === 0
  // Modifications suivies, indexées ou non, depuis le dernier commit (rien avant le premier).
  const diff = hasHead
    ? await run(git, ['diff', 'HEAD', '-M', '--no-color', '--', ...pathspec], {
        cwd: workspace,
        timeoutMs: 30_000
      })
    : undefined
  const lines = [`État git (\`git status --short\`) :`, '```', text(status.stdout), '```']
  const patch = diff ? diff.stdout : Buffer.alloc(0)
  if (patch.length === 0) {
    lines.push(
      hasHead
        ? 'Aucune modification des fichiers suivis depuis le dernier commit.'
        : 'Pas encore de commit.'
    )
  } else {
    const cut = patch.length > MAX_CONTEXT_DIFF_BYTES
    lines.push(
      `Diff depuis le dernier commit (\`git diff HEAD\`)${cut ? ', coupé à 100 Ko' : ''} :`,
      '```diff',
      text(cut ? patch.subarray(0, MAX_CONTEXT_DIFF_BYTES) : patch),
      '```'
    )
  }
  if (skipped.length > 0 && exclusions) {
    lines.push(
      `Fichiers sautés, exclus pour l’agent par ${exclusions.files.join(', ')} : ${skipped.join(', ')}.`
    )
  }
  return lines.join('\n')
}
