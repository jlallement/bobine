/**
 * Cycle complet d'un worktree (fiche 110, ADR-0022) : commit des fichiers cochés, PR par la forge
 * du dépôt distant (`gh` ou `glab`, détectés, jamais requis : fiche 189, ADR-0041), fusion dans la base (la base entre d'abord dans le worktree, puis
 * avance en fast-forward), nettoyage et worktrees orphelins. Tout passe par `git` en ligne de
 * commande, ici dans le main process, et chaque commande va dans `agents.log` (fiche 080).
 *
 * Fiche 123 : la fusion lit d'abord l'arbre du dossier principal quand la base y est extraite ;
 * sale, elle ne part pas (`main-dirty`), sauf à le mettre de côté (`git stash -u`) le temps de la
 * fusion. Le commit sert aussi au dossier principal et aux conversations hors worktree.
 */
import { lstatSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import {
  hasConflictMarkers,
  shortHash,
  type CommitOutcome,
  type MainDirty,
  type MergeOutcome,
  type OrphanWorktree,
  prBlockerKey,
  type PrAvailability,
  type PrOutcome,
  type StashOutcome,
  type WorktreeCycleView
} from '@shared/worktree-cycle'
import type { Run, RunResult } from '../simulator/run'
import { forgeFailure, redact } from './forge'
import {
  ForgeResolver,
  type ForgeResolverOptions,
  type RemoteInfo,
  type ResolvedForge
} from './forge-resolver'
import { insideWorkspace, parseStatus, statusOf } from './git'
import { gitError, gitErrorLine } from './git-errors'
import { WORKTREES_DIR, type WorktreeInfo } from './worktrees'

/** Ce que le cycle sait d'une conversation en worktree. */
export interface CycleTarget {
  id: string
  /** Titre de la conversation : base du message de commit et de la PR proposés. */
  title: string
  workspace: string
  worktree: WorktreeInfo
}

/**
 * Où committer : le dossier de git (`cwd`), celui de la conversation (`workspace`, auquel les
 * chemins cochés sont relatifs). Worktree, dossier principal, ou conversation ordinaire (fiche 123).
 */
export interface CommitPlace {
  id?: string
  workspace: string
  cwd: string
}

/** Modifications du dossier principal mises de côté (`git stash -u`), à remettre après la fusion. */
export interface StashHandle {
  id?: string
  root: string
  /** Hash de l'entrée : elle est retrouvée par lui, jamais par sa place dans la pile. */
  hash: string
  count: number
}

/** État d'une branche de fille, lu avant une fusion enchaînée (fiche 120). */
export interface BranchState {
  base: string
  dirty: number
  ahead: number
  /** Commits de la branche depuis son départ (0 : rien n'a été commité). */
  sinceBase: number
  files: string[]
  /** Fusion arrêtée sur des conflits : fichiers encore en conflit. */
  conflicts?: string[]
}

/**
 * `gh`, `glab`, leurs caches et la lecture de leurs configurations : voir `ForgeResolver`
 * (fiche 189, ADR-0041).
 */
export interface WorktreeCycleOptions extends ForgeResolverOptions {
  git?: string
  /** Une ligne du journal des commandes (`agents.log`). */
  log?: (conversationId: string | undefined, line: string) => void
  /**
   * Attente au plus de la forge dans `info()` (250 ms par défaut) : au-delà, la vue part avec « en
   * cours de vérification », et `onForgeSettled` dit quand relire.
   */
  forgeBudgetMs?: number
  /** La vérification de la forge d'une conversation, partie trop longue pour `info()`, est finie. */
  onForgeSettled?: (conversationId: string) => void
}

/** Sans demande ouverte connue, relue au plus toutes les minutes (pour « Pousser vers la MR »). */
const OPEN_TTL_MS = 60_000
const FORGE_BUDGET_MS = 250

const text = (buffer: Buffer) => buffer.toString('utf8').trim()
const lines = (buffer: Buffer) => text(buffer).split('\n').filter(Boolean)

export class WorktreeCycle {
  private readonly run: Run
  private readonly git: string
  private readonly options: WorktreeCycleOptions
  private readonly forges: ForgeResolver
  /** Demande ouverte d'une branche, pour une forge sans suivi (GitLab). */
  private readonly opened = new Map<
    string,
    { at: number; open?: { url: string; title?: string } }
  >()
  /** Dernier état de « Ouvrir une PR / MR » par worktree et dépôt distant (voir `budgeted`). */
  private readonly lastPr = new Map<string, PrAvailability>()
  private readonly openInflight = new Map<
    string,
    Promise<{ url: string; title?: string } | undefined>
  >()

  constructor(run: Run, options: WorktreeCycleOptions = {}) {
    this.run = run
    this.git = options.git ?? 'git'
    this.options = options
    this.forges = new ForgeResolver(run, options)
  }

  /** Lance git, journalise, et rend le résultat tel quel. */
  private async gitRun(
    cwd: string,
    args: string[],
    conversationId?: string,
    timeoutMs = 30_000
  ): Promise<RunResult> {
    const result = await this.run(this.git, args, { cwd, timeoutMs })
    this.options.log?.(
      conversationId,
      `git ${args.join(' ')} (${cwd}) → ${result.code}${
        result.code !== 0 && result.stderr.trim() ? ` : ${redact(gitErrorLine(result.stderr))}` : ''
      }`
    )
    return result
  }

  /** Lance git et lève ses lignes d'erreur s'il échoue (fiche 123 : en entier). */
  private async exec(
    cwd: string,
    args: string[],
    conversationId?: string,
    timeoutMs = 30_000
  ): Promise<string> {
    const result = await this.gitRun(cwd, args, conversationId, timeoutMs)
    if (result.code !== 0) {
      throw new Error(
        gitError(result.stderr) || t('worktrees.gitFailed', { command: args[0] ?? '' })
      )
    }
    return text(result.stdout)
  }

  /** Branche de base : celle relevée à la création, sinon celle du dépôt principal, sinon `main`. */
  async baseBranch(target: CycleTarget): Promise<string> {
    if (target.worktree.baseBranch) return target.worktree.baseBranch
    const head = await this.gitRun(target.worktree.root, [
      'symbolic-ref',
      '--quiet',
      '--short',
      'HEAD'
    ])
    return head.code === 0 ? text(head.stdout) : 'main'
  }

  private async count(cwd: string, range: string): Promise<number> {
    const result = await this.gitRun(cwd, ['rev-list', '--count', range])
    const n = Number(text(result.stdout))
    return result.code === 0 && Number.isFinite(n) ? n : 0
  }

  private async unmerged(cwd: string, id?: string): Promise<string[]> {
    const result = await this.gitRun(cwd, ['diff', '--name-only', '--diff-filter=U'], id)
    return result.code === 0 ? lines(result.stdout) : []
  }

  private async isMerging(cwd: string): Promise<boolean> {
    return (await this.gitRun(cwd, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])).code === 0
  }

  /** État du worktree pour la barre de la vue « Git ». */
  async info(target: CycleTarget, options: { fresh?: boolean } = {}): Promise<WorktreeCycleView> {
    const { worktree } = target
    const base = await this.baseBranch(target)
    const porcelain = await this.gitRun(
      worktree.path,
      ['status', '--porcelain', '-uall'],
      target.id
    )
    if (porcelain.code !== 0) throw new Error(gitError(porcelain.stderr) || t('git.statusFailed'))
    const dirty = lines(porcelain.stdout).length
    const ahead = await this.count(worktree.path, `${base}..${worktree.branch}`)
    const behind = await this.count(worktree.path, `${worktree.branch}..${base}`)
    const log = await this.gitRun(worktree.path, [
      'log',
      '--format=%s',
      '--max-count=50',
      `${base}..${worktree.branch}`
    ])
    const sinceBase = await this.count(worktree.path, `${worktree.base}..${worktree.branch}`)
    const pushed = await this.gitRun(worktree.path, [
      'rev-list',
      '--count',
      `${worktree.branch}@{u}..${worktree.branch}`
    ])
    const unpushed = pushed.code === 0 ? Number(text(pushed.stdout)) : NaN
    // Une seule lecture du dépôt distant par relève (seconde relecture, point 6).
    const remote = await this.remoteInfo(target, base)
    const merging = (await this.isMerging(worktree.path))
      ? { files: await this.unmerged(worktree.path, target.id) }
      : undefined
    return {
      title: target.title,
      branch: worktree.branch,
      path: worktree.path,
      root: worktree.root,
      base: worktree.base,
      baseShort: shortHash(worktree.base),
      baseBranch: base,
      ...(worktree.baseDate ? { baseDate: worktree.baseDate } : {}),
      ...(worktree.baseSubject ? { baseSubject: worktree.baseSubject } : {}),
      ...(worktree.dirtyAtStart !== undefined ? { dirtyAtStart: worktree.dirtyAtStart } : {}),
      dirty,
      ahead,
      behind,
      commits: log.code === 0 ? lines(log.stdout) : [],
      ...(Number.isFinite(unpushed) ? { unpushed } : {}),
      merged: sinceBase > 0 && ahead === 0,
      ...(merging ? { merging } : {}),
      pr: await this.budgeted(
        target,
        remote,
        this.forgeStatus(target, remote, Number.isFinite(unpushed), options.fresh)
      ),
      ...(remote ? {} : { noRemote: true as const })
    }
  }

  /**
   * État d'une branche pour fusionner plusieurs filles à la suite (fiche 120), sans `gh` :
   * modifications non commitées, commits que la base n'a pas, fusion arrêtée sur des conflits, et
   * fichiers modifiés depuis le point de départ commun (`git diff --name-only <base>...<branche>`).
   */
  async branchState(target: CycleTarget): Promise<BranchState> {
    const { worktree } = target
    const cwd = worktree.path
    const base = await this.baseBranch(target)
    // Lecture seule, à chaque changement d'une fille : sans le verrou optionnel de l'index, qui
    // ferait échouer un `git add` lancé au même moment par l'utilisateur ou par l'agent.
    const porcelain = await this.gitRun(
      cwd,
      ['--no-optional-locks', 'status', '--porcelain', '-uall'],
      target.id
    )
    if (porcelain.code !== 0) throw new Error(gitError(porcelain.stderr) || t('git.statusFailed'))
    const conflicts = (await this.isMerging(cwd)) ? await this.unmerged(cwd, target.id) : undefined
    const diff = await this.gitRun(
      cwd,
      ['diff', '--name-only', `${base}...${worktree.branch}`],
      target.id
    )
    return {
      base,
      dirty: lines(porcelain.stdout).length,
      ahead: await this.count(cwd, `${base}..${worktree.branch}`),
      sinceBase: await this.count(cwd, `${worktree.base}..${worktree.branch}`),
      files: diff.code === 0 ? lines(diff.stdout) : [],
      ...(conflicts ? { conflicts } : {})
    }
  }

  /**
   * Dossier d'un autre worktree où la base est extraite : la base ne peut pas y avancer
   * (ADR-0022), la fusion est refusée d'avance ; `undefined` sinon.
   */
  async baseElsewhere(target: CycleTarget): Promise<string | undefined> {
    const { worktree } = target
    const base = await this.baseBranch(target)
    const head = await this.gitRun(worktree.root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
    if (head.code === 0 && text(head.stdout) === base) return undefined
    return (await this.worktreeList(worktree.root)).find(
      (w) => w.branch === base && resolve(w.path) !== resolve(worktree.path)
    )?.path
  }

  private place(target: CycleTarget): CommitPlace {
    return { id: target.id, workspace: target.workspace, cwd: target.worktree.path }
  }

  /** Committe les fichiers cochés, et rien d'autre, dans le worktree. */
  commit(
    target: CycleTarget,
    request: { message: string; files: string[] }
  ): Promise<CommitOutcome> {
    return this.commitIn(this.place(target), request)
  }

  /** « Committer d'abord » (fiche 123) : ces fichiers, dans le dossier principal du dépôt. */
  commitMain(
    target: CycleTarget,
    request: { message: string; files: string[] }
  ): Promise<CommitOutcome> {
    const { root } = target.worktree
    return this.commitIn({ id: target.id, workspace: root, cwd: root }, request)
  }

  /** Committe les fichiers cochés (relatifs au dossier), et rien d'autre. */
  async commitIn(
    place: CommitPlace,
    request: { message: string; files: string[] }
  ): Promise<CommitOutcome> {
    const message = request.message.trim()
    if (!message) throw new Error(t('worktreeCycle.error.emptyMessage'))
    if (request.files.length === 0) throw new Error(t('worktreeCycle.error.noFile'))
    const chosen = request.files.map((file) => insideWorkspace(place.workspace, file))
    const { cwd, id } = place
    // Renommage (`git mv`) : l'ancien chemin part avec le nouveau, sinon le commit n'en prend que
    // la moitié et laisse la suppression indexée (0.9.1).
    const paths = [...new Set([...chosen, ...(await this.renamedFrom(cwd, chosen, id))])]
    // Suppression déjà indexée (`git rm`) : ni sur le disque ni dans l'index, `git add` la refuse
    // (« pathspec did not match »), mais `commit --only` la prend (0.9.1, D22).
    const missing = paths.filter((path) => !onDisk(path))
    // Encore dans l'index (suppression pas encore indexée) : `git add` la prend. Chemins rendus
    // relatifs au dossier où git est lancé.
    const indexed = missing.length
      ? (await this.gitRun(cwd, [...LITERAL, 'ls-files', '-z', '--', ...missing], id)).stdout
          .toString('utf8')
          .split('\0')
          .filter(Boolean)
      : []
    const staged = new Set(missing.filter((path) => !indexed.includes(relative(cwd, path))))
    const toAdd = paths.filter((path) => !staged.has(path))
    if (toAdd.length) await this.exec(cwd, [...LITERAL, 'add', '-A', '--', ...toAdd], id)
    await this.exec(
      cwd,
      [...LITERAL, 'commit', '-q', '--only', '-m', message, '--', ...paths],
      id,
      60_000
    )
    const hash = await this.exec(cwd, ['rev-parse', 'HEAD'], id)
    return { hash, short: shortHash(hash) }
  }

  /** Anciens chemins des renommages dont le nouveau chemin est choisi (`git status`). */
  private async renamedFrom(cwd: string, chosen: string[], id?: string): Promise<string[]> {
    const status = await this.gitRun(cwd, ['status', '--porcelain=v1', '-z', '-uall'], id)
    if (status.code !== 0) return []
    // `git status` donne des chemins depuis la racine du dépôt ; `prefix` : où est `cwd` dedans.
    const prefix = (await this.exec(cwd, ['rev-parse', '--show-prefix'], id)).replace(/\/$/, '')
    const fromRoot = new Set(chosen.map((path) => posix.join(prefix, relative(cwd, path))))
    return parseStatus(status.stdout.toString('utf8'))
      .filter((entry) => entry.from && fromRoot.has(entry.path))
      .map((entry) => resolve(cwd, posix.relative(prefix, entry.from ?? '')))
  }

  /** Défait le dernier commit du worktree en gardant ses modifications, s'il n'est pas dans la base. */
  async undoCommit(target: CycleTarget, hash: string): Promise<void> {
    const base = await this.baseBranch(target)
    await this.undoCommitIn(this.place(target), hash, {
      ref: base,
      error: t('worktreeCycle.error.alreadyMerged')
    })
  }

  /**
   * Défait le dernier commit en gardant ses modifications (« Défaire »), s'il est encore le
   * dernier et pas dans `keep` : la base d'un worktree, sinon la branche suivie (déjà poussé).
   */
  async undoCommitIn(
    place: CommitPlace,
    hash: string,
    keep?: { ref: string; error: string }
  ): Promise<void> {
    const { cwd, id } = place
    const head = await this.exec(cwd, ['rev-parse', 'HEAD'], id)
    if (head !== hash) throw new Error(t('worktreeCycle.error.notLast'))
    const guard = keep ?? (await this.upstream(cwd, id))
    if (guard) {
      const kept = await this.gitRun(cwd, ['merge-base', '--is-ancestor', hash, guard.ref], id)
      if (kept.code === 0) throw new Error(guard.error)
    }
    await this.exec(cwd, ['reset', '-q', '--soft', 'HEAD~1'], id)
  }

  /** Branche suivie de la branche courante (`@{u}`), si elle en a une. */
  private async upstream(
    cwd: string,
    id?: string
  ): Promise<{ ref: string; error: string } | undefined> {
    const found = await this.gitRun(
      cwd,
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
      id
    )
    const ref = text(found.stdout)
    return found.code === 0 && ref ? { ref, error: t('worktreeCycle.error.pushed') } : undefined
  }

  /* ----- Dossier principal (fiche 123) ----- */

  /** La base est la branche extraite dans le dossier principal du dépôt. */
  private async baseInRoot(target: CycleTarget, base: string): Promise<boolean> {
    const head = await this.gitRun(target.worktree.root, [
      'symbolic-ref',
      '--quiet',
      '--short',
      'HEAD'
    ])
    return head.code === 0 && text(head.stdout) === base
  }

  /**
   * Modifications non commitées du dossier principal (suivies ou non, pas les ignorées), quand la
   * base y est extraite : la fusion les toucherait. `undefined` : rien, ou base pas extraite là.
   */
  async mainDirty(target: CycleTarget): Promise<MainDirty | undefined> {
    const { root } = target.worktree
    const base = await this.baseBranch(target)
    if (!(await this.baseInRoot(target, base))) return undefined
    const status = await this.gitRun(
      root,
      ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '-uall'],
      target.id
    )
    if (status.code !== 0) throw new Error(gitError(status.stderr) || t('git.statusFailed'))
    const files = parseStatus(status.stdout.toString('utf8')).map((entry) => ({
      path: entry.path,
      status: statusOf(entry)
    }))
    return files.length > 0 ? { root, base, files } : undefined
  }

  /** « Mettre de côté » : `git stash -u` du dossier principal ; `undefined` s'il est propre. */
  async stashMain(target: CycleTarget): Promise<StashHandle | undefined> {
    const dirty = await this.mainDirty(target)
    if (!dirty) return undefined
    const { root, branch } = target.worktree
    const message = `bobine: before merging ${branch}`
    await this.exec(
      root,
      ['stash', 'push', '--include-untracked', '-m', message],
      target.id,
      60_000
    )
    const hash = await this.exec(root, ['rev-parse', '--verify', 'refs/stash'], target.id)
    return { id: target.id, root, hash, count: dirty.files.length }
  }

  /**
   * Remet ce qui a été mis de côté, puis retire cette entrée de la pile ; si la remise échoue
   * (conflit avec ce que la fusion a apporté), l'entrée reste dans `git stash`.
   */
  async restoreMain(handle: StashHandle): Promise<StashOutcome> {
    const { root, hash, count, id } = handle
    let applied = await this.gitRun(root, ['stash', 'apply', '--index', hash], id, 60_000)
    // L'index ne revient pas tel quel, mais rien n'a bougé : sans l'index.
    if (
      applied.code !== 0 &&
      lines((await this.gitRun(root, ['status', '--porcelain'])).stdout).length === 0
    ) {
      applied = await this.gitRun(root, ['stash', 'apply', hash], id, 60_000)
    }
    if (applied.code !== 0) {
      return {
        restored: false,
        count,
        ref: shortHash(hash),
        conflicts: await this.unmerged(root, id)
      }
    }
    const stack = lines((await this.gitRun(root, ['stash', 'list', '--format=%H'])).stdout)
    const index = stack.indexOf(hash)
    if (index >= 0) await this.gitRun(root, ['stash', 'drop', '-q', `stash@{${index}}`], id)
    return { restored: true, count }
  }

  /** L'action de fusion, entre une mise de côté du dossier principal et sa remise. */
  private async stashed(
    target: CycleTarget,
    stash: boolean,
    action: () => Promise<MergeOutcome>
  ): Promise<MergeOutcome> {
    const handle = stash ? await this.stashMain(target) : undefined
    if (!handle) return action()
    let outcome: MergeOutcome
    try {
      outcome = await action()
    } catch (error) {
      const restored = await this.restoreMain(handle)
      if (restored.restored) throw error
      throw new Error(
        `${messageOf(error)}\n${t('worktreeCycle.mainDirty.stashKept', { ref: restored.ref })}`
      )
    }
    const restored = await this.restoreMain(handle)
    return outcome.status === 'merged' || outcome.status === 'conflicts'
      ? { ...outcome, stash: restored }
      : outcome
  }

  /**
   * Fusionne dans la base (ADR-0022) : la base entre dans le worktree (`git merge`), puis la base
   * avance en fast-forward. Les conflits restent dans le worktree.
   */
  async merge(target: CycleTarget, options: { stash?: boolean } = {}): Promise<MergeOutcome> {
    const { worktree } = target
    const cwd = worktree.path
    const base = await this.baseBranch(target)
    if (await this.isMerging(cwd)) return this.mergeContinue(target, options)
    const dirty = (await this.exec(cwd, ['status', '--porcelain', '-uall'], target.id))
      .split('\n')
      .filter(Boolean).length
    if (dirty > 0) return { status: 'dirty', count: dirty }
    if ((await this.count(cwd, `${base}..${worktree.branch}`)) === 0) {
      return { status: 'nothing', base }
    }
    // Fiche 123 : rien ne part tant que le dossier principal a des modifications.
    const main = await this.mainDirty(target)
    if (main && !options.stash) return { status: 'main-dirty', ...main }
    return this.stashed(target, !!main, async () => {
      const behind = await this.count(cwd, `${worktree.branch}..${base}`)
      if (behind > 0) {
        const merged = await this.gitRun(cwd, ['merge', '--no-edit', base], target.id, 120_000)
        if (merged.code !== 0) {
          const files = await this.unmerged(cwd, target.id)
          if (files.length > 0) return { status: 'conflicts', files }
          throw new Error(gitError(merged.stderr) || t('worktrees.gitFailed', { command: 'merge' }))
        }
      }
      await this.advanceBase(target, base)
      return { status: 'merged', kind: behind > 0 ? 'merge' : 'fast-forward', base }
    })
  }

  /**
   * Reprend une fusion arrêtée sur des conflits : les fichiers sans marqueur sont ajoutés, la
   * fusion est commitée, puis la base avance. Rend les fichiers où il reste des marqueurs.
   */
  async mergeContinue(
    target: CycleTarget,
    options: { stash?: boolean } = {}
  ): Promise<MergeOutcome> {
    const cwd = target.worktree.path
    const base = await this.baseBranch(target)
    const merging = await this.isMerging(cwd)
    const files = merging ? await this.unmerged(cwd, target.id) : []
    const left: string[] = []
    for (const file of files) {
      const content = await readFile(join(cwd, file), 'utf8').catch(() => null)
      if (content === null || hasConflictMarkers(content)) left.push(file)
    }
    if (left.length > 0) return { status: 'conflicts', files: left }
    const main = await this.mainDirty(target)
    if (main && !options.stash) return { status: 'main-dirty', ...main }
    return this.stashed(target, !!main, async () => {
      if (merging) {
        if (files.length > 0) {
          await this.exec(cwd, [...LITERAL, 'add', '--', ...files], target.id)
        }
        await this.exec(cwd, ['commit', '-q', '--no-edit'], target.id, 60_000)
      }
      await this.advanceBase(target, base)
      return { status: 'merged', kind: 'merge', base }
    })
  }

  /** Abandonne une fusion arrêtée sur des conflits. */
  async mergeAbort(target: CycleTarget): Promise<void> {
    await this.exec(target.worktree.path, ['merge', '--abort'], target.id)
  }

  /**
   * La base avance jusqu'à la branche : dans le dépôt principal si elle y est extraite (le dossier
   * de l'utilisateur reçoit le travail ; git refuse si ses modifications chevauchent), sinon la
   * référence seule ; refusé si la base est extraite dans un autre worktree.
   */
  private async advanceBase(target: CycleTarget, base: string): Promise<void> {
    const { worktree } = target
    if (await this.baseInRoot(target, base)) {
      const result = await this.gitRun(
        worktree.root,
        ['merge', '--ff-only', worktree.branch],
        target.id,
        120_000
      )
      if (result.code !== 0) {
        throw new Error(t('worktreeCycle.error.mainDirty', { detail: gitError(result.stderr) }))
      }
      return
    }
    const elsewhere = (await this.worktreeList(worktree.root)).find(
      (w) => w.branch === base && resolve(w.path) !== resolve(worktree.path)
    )
    if (elsewhere) throw new Error(t('worktreeCycle.error.baseElsewhere', { path: elsewhere.path }))
    await this.exec(worktree.root, ['branch', '-f', base, worktree.branch], target.id)
  }

  /* ----- PR ----- */

  /**
   * Forge du dépôt distant de la base (ADR-0041). `fresh` : « Actualiser », un hôte que rien ne
   * déclare est alors dit inconnu.
   */
  private async resolveForge(
    target: CycleTarget,
    base: string,
    fresh = false
  ): Promise<ResolvedForge> {
    return this.forges.resolve(await this.remoteInfo(target, base), fresh)
  }

  /** Dépôt distant de la base et son URL (git seulement, jamais la forge). */
  private async remoteInfo(target: CycleTarget, base: string): Promise<RemoteInfo | undefined> {
    const remote = await this.remoteOf(target, base)
    if (!remote) return undefined
    const url = await this.gitRun(target.worktree.path, ['remote', 'get-url', remote], target.id)
    return { name: remote, ...(url.code === 0 ? { url: text(url.stdout) } : {}) }
  }

  /**
   * La forge attendue au plus `forgeBudgetMs` : la vue git ne reste jamais bloquée par un hôte
   * qui ne répond pas ; « en cours de vérification » d'ici là, puis `onForgeSettled`.
   */
  private async budgeted(
    target: CycleTarget,
    remote: RemoteInfo | undefined,
    pr: Promise<PrAvailability>
  ): Promise<PrAvailability> {
    // Dernier état connu de ce worktree et de ce dépôt distant : gardé pendant une nouvelle
    // vérification (gh lent toutes les 5 min), pour que ni le bouton ni la MR ne sautent.
    const key = JSON.stringify([
      target.id,
      target.worktree.path,
      target.worktree.branch,
      remote?.name,
      remote?.url
    ])
    const remember = (value: PrAvailability) => {
      if (value.ok || value.reason !== 'checking') this.lastPr.set(key, value)
      return value
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<'late'>((resolve) => {
      timer = setTimeout(() => resolve('late'), this.options.forgeBudgetMs ?? FORGE_BUDGET_MS)
    })
    const first = await Promise.race([pr, late])
    clearTimeout(timer)
    if (first !== 'late') return remember(first)
    void pr.then(
      (value) => {
        remember(value)
        this.options.onForgeSettled?.(target.id)
      },
      () => this.options.onForgeSettled?.(target.id)
    )
    // « Vérification en cours » seulement au tout premier chargement.
    return this.lastPr.get(key) ?? { ok: false, reason: 'checking' }
  }

  /**
   * Date (ms) d'un commit du worktree, par le même git que le reste du cycle ; `undefined` si le
   * commit n'est pas connu ici (suivi de la PR, 0.9.1).
   */
  async commitDate(target: CycleTarget, commit: string): Promise<number | undefined> {
    if (!/^[0-9a-f]{7,64}$/.test(commit)) return undefined
    const shown = await this.gitRun(
      target.worktree.path,
      ['show', '-s', '--format=%ct', commit],
      target.id,
      10_000
    )
    const seconds = Number(text(shown.stdout))
    return shown.code === 0 && seconds > 0 ? seconds * 1000 : undefined
  }

  /** « Actualiser » : l'état des outils (`gh`, `glab`) et des MR ouvertes est relu ensuite. */
  forgetGh(): void {
    this.forges.forget()
    this.opened.clear()
    // « Actualiser » : plus d'ancien état gardé (« vérification » plutôt qu'un vieux refus).
    this.lastPr.clear()
  }

  /**
   * Supprime la branche du worktree sur le dépôt distant après la fusion de sa PR (0.9.1, D19),
   * seulement si elle porte encore `head`, le dernier commit de la PR fusionnée : une branche qui
   * a reçu des commits depuis est gardée (`moved`). Le bail (`--force-with-lease`) refuse aussi une
   * poussée arrivée entre la lecture et la suppression. Déjà supprimée (GitHub le fait à la fusion
   * si le dépôt le demande) : `gone`. Lève l'erreur de git sinon.
   */
  async deleteRemoteBranch(
    target: CycleTarget,
    head: string
  ): Promise<'deleted' | 'gone' | 'moved'> {
    // Le commit est passé tel quel au bail : un vrai identifiant, rien d'autre (remarque 5).
    if (!/^[0-9a-f]{40,64}$/.test(head)) throw new Error(`invalid commit: ${head}`)
    const remote = await this.remoteOf(target, await this.baseBranch(target))
    if (!remote) throw new Error(t('worktreeCycle.pr.noRemote'))
    if (remote === '.' || remote.startsWith('-')) throw new Error(`invalid remote: ${remote}`)
    const ref = `refs/heads/${target.worktree.branch}`
    const cwd = target.worktree.root
    const listed = await this.gitRun(cwd, ['ls-remote', remote, ref], target.id, 60_000)
    if (listed.code !== 0) {
      throw new Error(gitError(listed.stderr) || t('worktrees.gitFailed', { command: 'ls-remote' }))
    }
    const current = text(listed.stdout).split(/\s/)[0]
    if (!current) return 'gone'
    if (current !== head) return 'moved'
    const result = await this.gitRun(
      cwd,
      ['push', `--force-with-lease=${ref}:${head}`, remote, '--delete', ref],
      target.id,
      60_000
    )
    if (result.code === 0) return 'deleted'
    if (/remote ref does not exist/i.test(result.stderr)) return 'gone'
    // Seul le bail refusé dit que la branche a bougé ; tout autre refus (branche protégée,
    // ruleset, droits) est une erreur, avec son message (remarque 4).
    if (/\(stale info\)/i.test(result.stderr)) return 'moved'
    // Le refus du dépôt est dans ses lignes `remote:` et `[remote rejected]`, avant `error:`.
    const refused = result.stderr
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^remote: \S|\[remote rejected\]/.test(line))
      .map((line) => line.replace(/^remote: /, ''))
    const message = [...refused, gitError(result.stderr)].filter(Boolean).join('\n')
    throw new Error(message || t('worktrees.gitFailed', { command: 'push' }))
  }

  /** Dépôt distant de la base, sinon `origin`, sinon le seul qu'il y a. */
  private async remoteOf(target: CycleTarget, base: string): Promise<string | undefined> {
    const cwd = target.worktree.path
    const configured = await this.gitRun(cwd, ['config', '--get', `branch.${base}.remote`])
    if (configured.code === 0 && text(configured.stdout)) return text(configured.stdout)
    const remotes = lines((await this.gitRun(cwd, ['remote'])).stdout)
    return remotes.includes('origin') ? 'origin' : remotes[0]
  }

  private async forgeStatus(
    target: CycleTarget,
    remote: RemoteInfo | undefined,
    pushed: boolean,
    fresh?: boolean
  ): Promise<PrAvailability> {
    const forge = await this.forges.resolve(remote, fresh)
    if (!forge.ok) return forge
    const noun = forge.adapter.noun === 'mr' ? { noun: 'mr' as const } : {}
    // Forge sans suivi (GitLab) : la MR ouverte de la branche, si elle a été poussée.
    const open = !forge.adapter.tracks && pushed ? await this.openRequest(target, forge) : undefined
    return { ok: true, remote: forge.remote, ...noun, ...(open ? { open } : {}) }
  }

  /** Demande ouverte de la branche, gardée une minute (une relève par minute au plus). */
  private async openRequest(
    target: CycleTarget,
    forge: Extract<ResolvedForge, { ok: true }>
  ): Promise<{ url: string; title?: string } | undefined> {
    const key = `${target.worktree.path}|${target.worktree.branch}`
    const known = this.opened.get(key)
    if (known && Date.now() - known.at < OPEN_TTL_MS) return known.open
    const running = this.openInflight.get(key)
    if (running) return running
    const lookup = forge.adapter
      .findOpen(this.run, forge.path, {
        cwd: target.worktree.path,
        branch: target.worktree.branch,
        ...(forge.repo ? { repo: forge.repo } : {})
      })
      .then((open) => {
        this.options.log?.(target.id, `${forge.adapter.tool} mr list (open) → ${open ? 1 : 0}`)
        this.opened.set(key, { at: Date.now(), ...(open ? { open } : {}) })
        return open
      })
      .finally(() => this.openInflight.delete(key))
    this.openInflight.set(key, lookup)
    return lookup
  }

  /**
   * Chemin de `gh` pour suivre la PR de ce worktree (fiche 176) : forge GitHub (seule à avoir le
   * suivi, ADR-0041), `gh` installé, connecté, et un dépôt distant ; sinon `undefined`, et le
   * suivi ne lance rien.
   */
  async ghFor(target: CycleTarget): Promise<string | undefined> {
    const forge = await this.resolveForge(target, await this.baseBranch(target))
    return forge.ok && forge.adapter.tracks ? forge.path : undefined
  }

  /**
   * Pousse la branche et ouvre la demande de fusion vers la base par l'outil de la forge (PR par
   * `gh`, MR par `glab`) ; rend celle qui existe déjà.
   */
  async pullRequest(
    target: CycleTarget,
    request: { title: string; body: string }
  ): Promise<PrOutcome> {
    const base = await this.baseBranch(target)
    const forge = await this.resolveForge(target, base)
    if (!forge.ok) {
      throw new Error(
        t(`worktreeCycle.pr.${prBlockerKey(forge.reason)}`, {
          ...(forge.noun ? { context: forge.noun } : {}),
          host: forge.host ?? ''
        })
      )
    }
    const { adapter } = forge
    const noun = adapter.noun === 'mr' ? { noun: 'mr' as const } : {}
    const title = request.title.trim()
    if (!title)
      throw new Error(t('worktreeCycle.error.emptyTitle', noun.noun ? { context: 'mr' } : {}))
    const cwd = target.worktree.path
    const branch = target.worktree.branch
    const pushArgs = ['push', '-u', forge.remote, branch]
    if (adapter.kind === 'github') await this.exec(cwd, pushArgs, target.id, 180_000)
    else {
      const pushed = await this.gitRun(cwd, pushArgs, target.id, 180_000)
      if (pushed.code !== 0) throw new Error(this.forgeError(forge, pushed.stderr, 'push', branch))
    }
    const repo = forge.repo ? { repo: forge.repo } : {}
    const created = await adapter.create(this.run, forge.path, {
      cwd,
      ...repo,
      base,
      branch,
      title,
      body: request.body
    })
    const verb = adapter.noun === 'mr' ? 'mr' : 'pr'
    this.options.log?.(
      target.id,
      `${adapter.tool} ${verb} create → ${'url' in created ? 0 : created.code}`
    )
    if ('url' in created) {
      this.opened.set(`${cwd}|${branch}`, { at: Date.now(), open: { url: created.url, title } })
      return { url: created.url, existed: false, ...noun }
    }
    const existing = await adapter.findOpen(this.run, forge.path, { cwd, branch, ...repo })
    this.options.log?.(
      target.id,
      `${adapter.tool} ${adapter.kind === 'github' ? 'pr view' : 'mr list'} → ${existing ? 0 : 1}`
    )
    if (existing) {
      this.opened.set(`${cwd}|${branch}`, { at: Date.now(), open: existing })
      return { url: existing.url, existed: true, ...noun }
    }
    if (adapter.kind === 'github') {
      throw new Error(gitError(created.stderr) || t('worktreeCycle.pr.failed'))
    }
    throw new Error(
      this.forgeError(forge, created.timedOut ? 'i/o timeout' : created.stderr, 'create', branch)
    )
  }

  /**
   * Message d'un échec sur GitLab (fiche 189) : ce qu'il faut faire quand la cause est connue
   * (non connecté, hôte injoignable, certificat, droits, branche protégée), sinon la ligne utile
   * de l'erreur ; jamais de jeton.
   */
  private forgeError(
    forge: Extract<ResolvedForge, { ok: true }>,
    stderr: string,
    step: 'push' | 'create',
    branch: string
  ): string {
    const failure = forgeFailure(stderr)
    const host = forge.host ?? ''
    if (failure) return t(`worktreeCycle.mr.error.${failure}`, { host, branch })
    const detail = redact(step === 'push' ? gitError(stderr) : toolError(stderr))
    return detail || t('worktreeCycle.pr.failed', { context: 'mr' })
  }

  /* ----- Nettoyage ----- */

  /** `git worktree list` du dépôt : dossier et branche de chacun. */
  private async worktreeList(root: string): Promise<{ path: string; branch?: string }[]> {
    const result = await this.gitRun(root, ['worktree', 'list', '--porcelain'])
    if (result.code !== 0) return []
    const entries: { path: string; branch?: string }[] = []
    for (const line of text(result.stdout).split('\n')) {
      if (line.startsWith('worktree ')) entries.push({ path: line.slice('worktree '.length) })
      else if (line.startsWith('branch ')) {
        const current = entries.at(-1)
        if (current) current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
      }
    }
    return entries
  }

  /**
   * Worktrees de Bobine (`<dépôt>/.worktrees/`) sans conversation, dans ces dépôts. `known` :
   * dossiers des worktrees que des conversations tiennent encore.
   */
  async orphans(roots: readonly string[], known: ReadonlySet<string>): Promise<OrphanWorktree[]> {
    const found: OrphanWorktree[] = []
    const seen = new Set<string>()
    for (const root of roots) {
      const top = await this.gitRun(root, ['rev-parse', '--show-toplevel'])
      if (top.code !== 0) continue
      const repo = text(top.stdout)
      if (seen.has(repo)) continue
      seen.add(repo)
      for (const entry of await this.worktreeList(repo)) {
        if (!isInside(join(repo, WORKTREES_DIR), entry.path)) continue
        if ([...known].some((path) => resolve(path) === resolve(entry.path))) continue
        const branch = entry.branch ?? ''
        const porcelain = await this.gitRun(entry.path, ['status', '--porcelain', '-uall'])
        found.push({
          root: repo,
          path: entry.path,
          branch,
          dirty: porcelain.code === 0 ? lines(porcelain.stdout).length : 0,
          ahead: branch ? await this.count(repo, `HEAD..${branch}`) : 0
        })
      }
    }
    return found
  }

  /** Supprime un worktree orphelin et sa branche, quoi qu'il contienne (l'utilisateur l'a demandé). */
  async removeOrphan(orphan: Pick<OrphanWorktree, 'root' | 'path' | 'branch'>): Promise<void> {
    if (!isInside(join(orphan.root, WORKTREES_DIR), orphan.path)) {
      throw new Error(t('worktrees.outside', { root: WORKTREES_DIR, path: orphan.path }))
    }
    const removed = await this.gitRun(orphan.root, ['worktree', 'remove', '--force', orphan.path])
    if (removed.code !== 0) await this.exec(orphan.root, ['worktree', 'prune'])
    if (orphan.branch) await this.gitRun(orphan.root, ['branch', '-D', orphan.branch])
  }
}

/** Le chemin existe sur le disque (un lien vers rien compte). */
function onDisk(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

/**
 * Chemins choisis par l'utilisateur : pris tels quels, jamais comme motifs (`a[1].txt` ne doit pas
 * prendre `a1.txt`, ni `*.txt` tous les fichiers).
 */
const LITERAL = ['--literal-pathspecs']

/**
 * Ligne utile d'une erreur de `glab` : ce qui suit son cadre « ERROR », sans la phrase du fichier
 * de reprise (`--recover`), espaces des colonnes ramenés à un.
 */
export function toolError(stderr: string): string {
  const flat = stderr.replace(/\s+/g, ' ').trim()
  const afterError = /\bERROR\b(.*)$/.exec(flat)?.[1]?.trim()
  const message = (afterError || flat)
    .replace(/Failed to create merge request\. Created recovery file: \S+/i, '')
    .replace(/Run the command again with the '--recover' option to retry\./i, '')
    .replace(/^x\s+/, '')
    .trim()
  return message
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel) && !rel.includes(`..${sep}`)
}
