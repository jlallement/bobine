/**
 * Dépôt git du dossier d'une conversation : branche, avance / retard, fichiers modifiés (puce de
 * branche de la zone de saisie, fiches 037 et 049). `Run` injecté pour les tests.
 */
import type { GitStatus } from '@shared/git'
import type { Run } from '../simulator/run'
import { gitError } from '../changes/git-errors'
import { t } from 'i18next'

const text = (b: Buffer) => b.toString('utf8')

/** `rev-parse` a échoué : hors dépôt (`null`), ou une erreur à montrer (git absent, dépôt refusé). */
export function notARepoOrError(stderr: string): null {
  if (/not a git repository/i.test(stderr)) return null
  if (/ENOENT/.test(stderr)) {
    throw new Error(t('git.missing'))
  }
  throw new Error(stderr.trim().split('\n').at(-1) || t('git.failed'))
}

/** En-têtes de `git status --porcelain=v2 --branch` et nombre d'entrées (fichiers). */
export function parseStatusV2(output: string): {
  branch?: string
  upstream?: string
  ahead: number
  behind: number
  dirty: number
} {
  const result = { ahead: 0, behind: 0, dirty: 0 } as ReturnType<typeof parseStatusV2>
  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length).trim()
      if (head && head !== '(detached)') result.branch = head
    } else if (line.startsWith('# branch.upstream ')) {
      result.upstream = line.slice('# branch.upstream '.length).trim()
    } else if (line.startsWith('# branch.ab ')) {
      const ab = /\+(\d+) -(\d+)/.exec(line)
      if (ab) {
        result.ahead = Number(ab[1])
        result.behind = Number(ab[2])
      }
    } else if (/^[12u?] /.test(line)) {
      result.dirty++
    }
  }
  return result
}

export class GitRepo {
  private readonly run: Run
  private readonly git: string

  constructor(run: Run, git = 'git') {
    this.run = run
    this.git = git
  }

  /** État du dépôt qui contient le dossier ; `null` hors d'un dépôt git. */
  async status(workspace: string): Promise<GitStatus | null> {
    const top = await this.run(this.git, ['rev-parse', '--show-toplevel'], {
      cwd: workspace,
      timeoutMs: 20_000
    })
    if (top.code !== 0) return notARepoOrError(top.stderr)
    const status = await this.run(
      this.git,
      ['status', '--porcelain=v2', '--branch', '--untracked-files=all'],
      { cwd: workspace, timeoutMs: 30_000 }
    )
    if (status.code !== 0) {
      throw new Error(gitError(status.stderr) || t('git.statusFailed'))
    }
    const parsed = parseStatusV2(text(status.stdout))
    return {
      root: text(top.stdout).trim(),
      ...(parsed.branch ? { branch: parsed.branch } : {}),
      ...(parsed.upstream ? { upstream: parsed.upstream } : {}),
      ahead: parsed.ahead,
      behind: parsed.behind,
      dirty: parsed.dirty
    }
  }
}
