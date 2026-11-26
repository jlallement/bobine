/**
 * Fichiers commités depuis un message (fiche 286) : avant de « Repartir de ce message », remettre
 * un fichier commité depuis dans son état d'alors défait de fait ce commit (en modifications non
 * commitées). Le dialogue décoche alors la remise en état par défaut.
 *
 * Jamais d'erreur : hors dépôt ou dépôt sans commit, rien n'a pu être commité ; heure du message
 * inconnue ou git en échec, tout est tenu pour commité (le défaut le plus prudent : rien remis
 * sans que l'utilisateur coche).
 */
import { relative, resolve, sep } from 'node:path'
import type { Run, RunResult } from '../simulator/run'

const GIT_TIMEOUT_MS = 15_000

/** `rev-parse --verify --quiet HEAD` sans commit : code 1, et git n'a rien dit. */
const unborn = (result: RunResult) =>
  result.code === 1 && !result.timedOut && !/\b(fatal|error|warning):/i.test(result.stderr)

/**
 * Parmi `paths` (absolus, dans `workspace`), ceux qu'un commit a touchés depuis `since` (ms) dans le
 * dépôt du dossier : modifiés, supprimés ou renommés (l'ancien nom compte). Le dossier peut être un
 * worktree (celui d'une tâche fille) : c'est son historique qui est lu.
 */
export async function committedSince(
  run: Run,
  workspace: string,
  paths: readonly string[],
  since: number | undefined,
  git = 'git'
): Promise<Set<string>> {
  if (paths.length === 0) return new Set()
  const all = () => new Set(paths)
  try {
    const inside = await run(git, ['rev-parse', '--is-inside-work-tree'], {
      cwd: workspace,
      timeoutMs: GIT_TIMEOUT_MS
    })
    if (inside.code !== 0) {
      // Hors dépôt : rien n'a pu y être commité. Toute autre erreur (git absent…) : doute.
      return /not a git repository/i.test(inside.stderr) ? new Set() : all()
    }
    if (inside.stdout.toString('utf8').trim() !== 'true') return all()
    const head = await run(git, ['rev-parse', '--verify', '--quiet', 'HEAD'], {
      cwd: workspace,
      timeoutMs: GIT_TIMEOUT_MS
    })
    // Dépôt sans commit : rien de commité (`--quiet` : code 1, sans message de git — `runCommand`
    // ne rend alors que « Command failed »). Autre échec (message de git, délai dépassé) : doute.
    if (head.code !== 0) return unborn(head) ? new Set() : all()
    if (since === undefined || !Number.isFinite(since)) return all()

    const byRelative = new Map<string, string>()
    for (const path of paths) {
      const rel = relative(resolve(workspace), resolve(path)).split(sep).join('/')
      if (!rel || rel.startsWith('..')) return all()
      byRelative.set(rel, path)
    }
    // git date les commits à la seconde : un commit de la même seconde que le message compte.
    const seconds = Math.floor(since / 1000)
    const log = await run(
      git,
      [
        '-c',
        'core.quotePath=false',
        'log',
        `--since=@${seconds}`,
        '--no-renames',
        '--name-only',
        '--relative',
        '-z',
        '--format=',
        '--',
        ...[...byRelative.keys()].map((rel) => `:(literal)${rel}`)
      ],
      { cwd: workspace, timeoutMs: GIT_TIMEOUT_MS }
    )
    if (log.code !== 0) return all()
    const touched = new Set<string>()
    for (const name of log.stdout.toString('utf8').split('\0')) {
      // Entre deux commits, git peut laisser un saut de ligne devant le premier nom.
      const path = byRelative.get(name.replace(/^\n+/, ''))
      if (path) touched.add(path)
    }
    return touched
  } catch {
    return all()
  }
}
