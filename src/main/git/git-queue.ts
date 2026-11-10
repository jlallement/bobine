/**
 * File git par dépôt (fiche 138) : plusieurs conversations, la relecture de l'état git et une fusion
 * lancent git dans le même dépôt ; sans ordre, l'une échoue sur `index.lock`. Les commandes qui
 * écrivent passent une à une ; les lectures passent ensemble, jamais pendant une écriture. Premier
 * arrivé, premier servi : une lecture arrivée derrière une écriture en attente attend son tour (la
 * relecture périodique ne peut pas affamer une fusion). Un verrou laissé par un autre processus
 * (l'agent qui committe, l'utilisateur dans son terminal) vaut une relance, une seule.
 * N'importe pas `electron`.
 */
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { t } from 'i18next'
import { delay } from '../delay'
import { runCommand, type Run, type RunResult } from '../simulator/run'

export type GitKind = 'read' | 'write'

/** Verrou lecteurs / rédacteur, dans l'ordre d'arrivée. */
export class GitQueue {
  private readers = 0
  private writing = false
  private readonly waiting: Array<{ kind: GitKind; start: () => void }> = []

  run<T>(kind: GitKind, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        kind,
        start: () => {
          void Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => this.done(kind))
        }
      })
      this.pump()
    })
  }

  private done(kind: GitKind): void {
    if (kind === 'write') this.writing = false
    else this.readers--
    this.pump()
  }

  private pump(): void {
    while (!this.writing) {
      const next = this.waiting[0]
      if (!next || (next.kind === 'write' && this.readers > 0)) return
      this.waiting.shift()
      if (next.kind === 'write') this.writing = true
      else this.readers++
      next.start()
    }
  }
}

/** Sous-commandes qui ne font que lire (le reste compte comme une écriture, par prudence). */
const READ_COMMANDS = new Set([
  'status',
  'diff',
  'show',
  'log',
  'rev-parse',
  'rev-list',
  'ls-files',
  'ls-tree',
  'merge-base',
  'cat-file',
  'for-each-ref',
  'show-ref',
  'describe',
  'name-rev',
  'check-ignore',
  'blame',
  'grep',
  'var',
  'version'
])

/** Options globales de git suivies d'une valeur (`git -C dossier status`). */
const VALUED_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])

/** Écriture ou lecture, et dossier où git travaille (`cwd`, déplacé par `-C`). */
export function gitCall(args: string[], cwd: string): { kind: GitKind; dir: string } {
  let dir = cwd
  let i = 0
  for (; i < args.length; i++) {
    const arg = args[i] ?? ''
    if (VALUED_OPTIONS.has(arg)) {
      if (arg === '-C' && args[i + 1] !== undefined) dir = resolve(dir, args[i + 1] ?? '')
      i++
    } else if (!arg.startsWith('-')) break
  }
  const command = args[i] ?? ''
  const rest = args.slice(i + 1)
  return { kind: readOnly(command, rest) ? 'read' : 'write', dir }
}

function readOnly(command: string, rest: string[]): boolean {
  if (READ_COMMANDS.has(command)) return true
  const [sub] = rest
  switch (command) {
    case 'worktree':
      return sub === 'list'
    case 'stash':
      return sub === 'list' || sub === 'show'
    case 'config':
      return rest.some((a) => ['--get', '--get-all', '--get-regexp', '--list', '-l'].includes(a))
    case 'remote':
      return sub === undefined || sub === '-v' || sub === 'get-url' || sub === 'show'
    case 'branch':
      return rest.length === 0 || rest.includes('--show-current') || rest.includes('--list')
    case 'symbolic-ref':
      // `symbolic-ref HEAD` lit ; `symbolic-ref HEAD refs/heads/x` ou `--delete` écrit.
      return (
        !rest.some((a) => a === '-d' || a === '--delete') &&
        rest.filter((a) => !a.startsWith('-')).length <= 1
      )
    default:
      return false
  }
}

/**
 * Clé de la file d'un dossier : le dossier git commun du dépôt. Un worktree (`.git` est un fichier
 * `gitdir: …`, qui mène à `commondir`) partage ainsi la file de son dépôt principal : les fusions
 * (ADR-0022) touchent les deux. Hors dépôt : le dossier lui-même.
 */
export function repoKeyOf(dir: string): string {
  const start = resolve(dir)
  for (let current = start; ; current = dirname(current)) {
    const dotGit = join(current, '.git')
    try {
      const info = statSync(dotGit)
      if (info.isDirectory()) return realpathSync(dotGit)
      const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1]?.trim()
      if (pointer) {
        const gitDir = isAbsolute(pointer) ? pointer : resolve(current, pointer)
        let common = gitDir
        try {
          common = resolve(gitDir, readFileSync(join(gitDir, 'commondir'), 'utf8').trim())
        } catch {
          // Pas un worktree (sous-module) : son propre dossier git.
        }
        return realpathSync(common)
      }
    } catch {
      // Pas de `.git` ici : on remonte.
    }
    if (dirname(current) === current) return start
  }
}

/**
 * Messages de git en anglais (fiche 145) : l'app lit sa sortie (« not a git repository », verrou,
 * « Aborting »), traduite sous Linux selon la langue de l'utilisateur. `LANGUAGE` passe avant
 * `LC_ALL` et `LANG` pour les seuls messages (gettext), sans changer le jeu de caractères des
 * hooks du dépôt ; `C` : pas de traduction. Sans effet sur le git d'Apple, jamais traduit.
 */
export function gitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // `GIT_TERMINAL_PROMPT=0` (fiche 195) : sans terminal, git échoue vite au lieu d'attendre un nom
  // d'utilisateur ou un mot de passe que personne ne tapera.
  return { ...env, LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0' }
}

/**
 * git absent (fiche 195) : `spawn git ENOENT`, ou le git d'Apple sans ses outils de ligne de
 * commande (« invalid active developer path »). Message clair à la place, pour l'utilisateur.
 */
const GIT_MISSING = /spawn \S*git ENOENT|xcrun: error: invalid active developer path/

export function explainMissingGit(result: RunResult): RunResult {
  if (result.code === 0 || !GIT_MISSING.test(result.stderr)) return result
  return { ...result, stderr: t('git.missing') }
}

/** `Run` dont les commandes git parlent anglais (`gitEnv`) ; les autres passent tout droit. */
export function withGitLanguage(
  run: Run,
  env: () => NodeJS.ProcessEnv = () => process.env,
  isGit: (file: string) => boolean = (file) => basename(file) === 'git'
): Run {
  return (file, args, options = {}) =>
    isGit(file)
      ? run(file, args, { ...options, env: gitEnv(options.env ?? env()) }).then(explainMissingGit)
      : run(file, args, options)
}

/** Verrou de git pris par un autre processus (`index.lock`, verrou d'une référence…). */
export const LOCKED = /Unable to create '[^']+\.lock': File exists/

export interface QueuedGitOptions {
  /** Commandes concernées (par défaut : le programme `git`). */
  isGit?: (file: string) => boolean
  /** Attente avant de relancer une commande refusée par un verrou. */
  retryDelayMs?: number
  keyOf?: (dir: string) => string
}

/**
 * `Run` qui fait passer les commandes git par la file de leur dépôt ; les autres (`gh`…) passent
 * tout droit. Une commande refusée par un verrou est relancée une fois ; si elle échoue encore, son
 * erreur est rendue telle quelle (montrée en entier par `gitError`, fiche 123).
 */
export function queuedGit(run: Run, options: QueuedGitOptions = {}): Run {
  const isGit = options.isGit ?? ((file: string) => basename(file) === 'git')
  const retryDelayMs = options.retryDelayMs ?? 400
  const keyOf = options.keyOf ?? repoKeyOf
  // Une file par dépôt rencontré, gardée : il y en a peu.
  const queues = new Map<string, GitQueue>()
  return (file, args, runOptions = {}) => {
    if (!isGit(file)) return run(file, args, runOptions)
    const { kind, dir } = gitCall(args, runOptions.cwd ?? process.cwd())
    const key = keyOf(dir)
    let queue = queues.get(key)
    if (!queue) queues.set(key, (queue = new GitQueue()))
    // Une lecture ne prend jamais `index.lock` au passage (rafraîchissement de l'index) : elle ne
    // fait pas échouer le commit de l'agent ou de l'utilisateur lancé au même moment.
    const command =
      kind === 'read' && !args.includes('--no-optional-locks')
        ? ['--no-optional-locks', ...args]
        : args
    return queue.run(kind, async (): Promise<RunResult> => {
      const first = await run(file, command, runOptions)
      if (first.code === 0 || !LOCKED.test(first.stderr)) return first
      await delay(retryDelayMs, { unref: true })
      return run(file, command, runOptions)
    })
  }
}

/** git sans file d'attente, messages en anglais : ce que les essais sur un vrai dépôt lancent. */
export const gitCommand: Run = withGitLanguage(runCommand)

/** Les commandes git du main, toutes par la même file (`index.ts`), messages en anglais. */
export const gitRun: Run = queuedGit(gitCommand)
