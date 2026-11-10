/**
 * Worktrees git des conversations en parallèle (fiche 036) : chaque conversation lancée « dans un
 * worktree » travaille sur sa propre branche, dans son propre dossier, sans toucher à la copie de
 * travail principale. Les worktrees vont dans `<dépôt>/.worktrees/`, exclu de git localement
 * (`.git/info/exclude`) : aucun fichier suivi n'est modifié, et le dossier hérite de la confiance
 * donnée à l'agent pour le dépôt.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { isDirectory } from '../agent/process-utils'
import type { Run } from '../simulator/run'
import { gitError } from './git-errors'
import { t } from 'i18next'

export const WORKTREES_DIR = '.worktrees'

/** Branche d'un worktree : `bobine/<date>-<heure>-<hasard>` (`bob/…` avant la fiche 096). */
export const BRANCH_PREFIX = 'bobine/'

export interface WorktreeInfo {
  /** Racine du dépôt principal. */
  root: string
  /** Dossier du worktree. */
  path: string
  branch: string
  /** Commit de départ (pour compter les commits faits dans la branche). */
  base: string
  /**
   * Départ explicite (fiche 110) : branche de base, date et sujet du commit de départ, et
   * modifications non commitées du dossier d'origine, qui ne sont pas dans le worktree. Absents
   * des enregistrements d'avant la fiche 110.
   */
  baseBranch?: string
  baseDate?: string
  baseSubject?: string
  dirtyAtStart?: number
}

export interface WorktreeStatus {
  branch: string
  path: string
  /** Fichiers modifiés ou nouveaux, pas encore commités. */
  dirty: number
  /** Commits faits dans la branche depuis le départ. */
  ahead: number
  /** Le dossier a disparu (supprimé à la main). */
  missing?: boolean
}

const text = (buffer: Buffer) => buffer.toString('utf8').trim()

/** Nom court et unique : date et heure, puis quatre caractères au hasard. */
export function worktreeName(now = new Date(), random = randomBytes(2).toString('hex')): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-${random}`
}

export class Worktrees {
  private readonly run: Run
  private readonly git: string
  /**
   * Avant la suppression d'un worktree encore sur le disque (fiche 175) : commande `archive` du
   * projet. Ne doit pas lever ; un échec n'empêche pas la suppression.
   */
  beforeRemove?: (info: WorktreeInfo) => Promise<void>

  constructor(run: Run, git = 'git') {
    this.run = run
    this.git = git
  }

  private async exec(cwd: string, args: string[], timeoutMs = 30_000): Promise<string> {
    const result = await this.run(this.git, args, { cwd, timeoutMs })
    if (result.code !== 0) {
      // En entier (fiche 123) : pour un verrou, la dernière ligne seule ne dit pas lequel.
      throw new Error(
        gitError(result.stderr) || t('worktrees.gitFailed', { command: args[0] ?? '' })
      )
    }
    return text(result.stdout)
  }

  /** Le dossier est-il dans un dépôt git qui a déjà un commit ? */
  async canCreate(workspace: string): Promise<boolean> {
    const head = await this.run(this.git, ['rev-parse', '--verify', '--quiet', 'HEAD'], {
      cwd: workspace,
      timeoutMs: 10_000
    })
    return head.code === 0
  }

  /**
   * Nouveau worktree sur une nouvelle branche, depuis le commit courant du dossier. Rend aussi le
   * dossier de travail de la conversation : le même sous-dossier, dans le worktree.
   */
  async create(workspace: string): Promise<WorktreeInfo & { workspace: string }> {
    // Dossier disparu (worktree nettoyé, 0.9.1, D21) : dit tout de suite, sans lancer git.
    if (!isDirectory(workspace)) throw new Error(t('worktrees.folderGone', { folder: workspace }))
    const root = await this.exec(workspace, ['rev-parse', '--show-toplevel']).catch(() => {
      throw new Error(t('worktrees.notRepo'))
    })
    const base = await this.exec(workspace, ['rev-parse', 'HEAD']).catch(() => {
      throw new Error(t('worktrees.noCommit'))
    })
    const prefix = await this.exec(workspace, ['rev-parse', '--show-prefix'])
    const start = await this.startOf(workspace)
    await this.exclude(root)
    const name = worktreeName()
    // Préfixe au nom de l'app (ADR-0013), quel que soit l'agent. Les branches `bob/…` des worktrees
    // créés avant restent gérées : la suppression part de la branche gardée avec la conversation.
    const branch = `${BRANCH_PREFIX}${name}`
    const path = join(root, WORKTREES_DIR, name)
    await mkdir(join(root, WORKTREES_DIR), { recursive: true })
    await this.exec(root, ['worktree', 'add', '-b', branch, path, base], 120_000)
    return {
      root,
      path,
      branch,
      base,
      ...start,
      workspace: prefix ? join(path, prefix.replace(/\/+$/, '')) : path
    }
  }

  /**
   * D'où part le worktree (fiche 110) : branche courante du dossier (absente : HEAD détachée),
   * date et sujet de son commit, et nombre de modifications non commitées du dossier.
   */
  private async startOf(
    workspace: string
  ): Promise<Pick<WorktreeInfo, 'baseBranch' | 'baseDate' | 'baseSubject' | 'dirtyAtStart'>> {
    const branch = await this.run(this.git, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: workspace,
      timeoutMs: 10_000
    })
    const shown = await this.exec(workspace, ['show', '-s', '--format=%cI%n%s', 'HEAD']).catch(
      () => ''
    )
    const [baseDate = '', ...subject] = shown.split('\n')
    const porcelain = await this.run(this.git, ['status', '--porcelain', '-uall'], {
      cwd: workspace,
      timeoutMs: 30_000
    })
    const dirtyAtStart =
      porcelain.code === 0 ? text(porcelain.stdout).split('\n').filter(Boolean).length : 0
    return {
      ...(branch.code === 0 ? { baseBranch: text(branch.stdout) } : {}),
      ...(baseDate ? { baseDate } : {}),
      ...(subject.length ? { baseSubject: subject.join('\n').trim() } : {}),
      dirtyAtStart
    }
  }

  /** Modifications non commitées et commits de la branche, avant de la supprimer. */
  async status(info: WorktreeInfo): Promise<WorktreeStatus> {
    const porcelain = await this.run(this.git, ['status', '--porcelain'], {
      cwd: info.path,
      timeoutMs: 30_000
    })
    if (porcelain.code !== 0) {
      return { branch: info.branch, path: info.path, dirty: 0, ahead: 0, missing: true }
    }
    const dirty = text(porcelain.stdout).split('\n').filter(Boolean).length
    const ahead = Number(
      await this.exec(info.root, ['rev-list', '--count', `${info.base}..${info.branch}`]).catch(
        () => '0'
      )
    )
    return {
      branch: info.branch,
      path: info.path,
      dirty,
      ahead: Number.isFinite(ahead) ? ahead : 0
    }
  }

  /**
   * Supprime le worktree et sa branche. Sans `force`, git refuse s'il reste des modifications non
   * commitées ; la branche est supprimée même si elle a des commits (l'utilisateur l'a demandé).
   */
  async remove(info: WorktreeInfo, options: { force?: boolean } = {}): Promise<void> {
    if (!isInside(join(info.root, WORKTREES_DIR), info.path)) {
      throw new Error(t('worktrees.outside', { root: WORKTREES_DIR, path: info.path }))
    }
    const status = await this.status(info)
    if (!status.missing) {
      await this.beforeRemove?.(info).catch(() => {})
      await this.exec(info.root, [
        'worktree',
        'remove',
        ...(options.force ? ['--force'] : []),
        info.path
      ])
    } else {
      await this.exec(info.root, ['worktree', 'prune']).catch(() => '')
    }
    await this.exec(info.root, ['branch', '-D', info.branch]).catch(() => '')
  }

  /**
   * Version immédiate de `remove`, sans `--force`, pour la fermeture de l'app : un worktree resté
   * intact (conversation jamais commencée) disparaît ; un worktree modifié reste.
   */
  removeIfUntouchedSync(info: WorktreeInfo): void {
    if (!isInside(join(info.root, WORKTREES_DIR), info.path)) return
    try {
      execFileSync(this.git, ['worktree', 'remove', info.path], {
        cwd: info.root,
        stdio: 'ignore',
        timeout: 10_000
      })
      execFileSync(this.git, ['branch', '-D', info.branch], {
        cwd: info.root,
        stdio: 'ignore',
        timeout: 10_000
      })
    } catch {
      // Modifié entre-temps, ou déjà parti : on n'insiste pas.
    }
  }

  /** `/.worktrees/` dans `.git/info/exclude` (local au dépôt, jamais commité). */
  private async exclude(root: string): Promise<void> {
    const common = await this.exec(root, ['rev-parse', '--git-common-dir'])
    const dir = isAbsolute(common) ? common : resolve(root, common)
    const file = join(dir, 'info', 'exclude')
    const current = await readFile(file, 'utf8').catch(() => '')
    const line = `/${WORKTREES_DIR}/`
    if (current.split('\n').some((l) => l.trim() === line)) return
    await mkdir(join(dir, 'info'), { recursive: true })
    await appendFile(
      file,
      `${current && !current.endsWith('\n') ? '\n' : ''}# Worktrees de Bobine\n${line}\n`
    )
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel) && !rel.includes(`..${sep}`)
}
