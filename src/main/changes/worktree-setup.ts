/**
 * Préparation d'un nouveau worktree (fiche 175, ADR-0037) : copie des fichiers ignorés listés par
 * `.worktreeinclude`, puis la commande `setup` de `.bobine/worktree.json`, lancée seulement si
 * l'utilisateur l'a autorisée pour ce dépôt (accord gardé par empreinte des commandes). La commande
 * `archive` est lancée avant la suppression du worktree par l'app. La carte montre toutes les
 * commandes que l'accord couvre, et l'accord ne vaut que pour l'empreinte montrée (QA 0.9).
 *
 * Les deux fichiers sont lus dans le dossier d'origine (`root`), pas dans le worktree : un fichier
 * pas encore commité compte. `agents.log` dit la commande, le code et la durée, jamais la sortie.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  ARCHIVE_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  WORKTREE_CONFIG_FILE,
  configSignature,
  hasCommands,
  parseWorktreeConfig,
  setupContext,
  tailOutput,
  type WorktreeConfig,
  type WorktreeSetup
} from '@shared/worktree-setup'
import { stopGroup } from '../process-group'
import { trackChild } from '../process-registry'
import type { Run } from '../simulator/run'
import { copyIncluded } from './worktree-include'
import type { WorktreeInfo } from './worktrees'

/** Fin d'une commande lancée par le shell. */
export interface CommandResult {
  /** Code de sortie ; `null` si arrêtée (délai, signal) ou jamais lancée. */
  code: number | null
  timedOut: boolean
  error?: string
}

/** Lancement d'une commande du projet par le shell (remplacé en test). */
export type ShellRun = (
  command: string,
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    timeoutMs: number
    onOutput: (chunk: string) => void
    /** Pour arrêter la commande (suppression du worktree, départ de l'app). */
    signal: AbortSignal
  }
) => Promise<CommandResult>

/** Lancement réel : `sh -c` (ou `cmd.exe`), dans son propre groupe de processus. */
export const shellRun: ShellRun = (command, { cwd, env, timeoutMs, onOutput, signal }) =>
  new Promise((resolve) => {
    let timedOut = false
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    trackChild(child, [command])
    const stop = () => stopGroup(child)
    const timer = setTimeout(() => {
      timedOut = true
      stop()
    }, timeoutMs)
    signal.addEventListener('abort', stop, { once: true })
    child.stdout.on('data', (chunk: Buffer) => onOutput(chunk.toString('utf8')))
    child.stderr.on('data', (chunk: Buffer) => onOutput(chunk.toString('utf8')))
    const done = (result: CommandResult) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', stop)
      resolve(result)
    }
    child.on('error', (error) => done({ code: null, timedOut, error: error.message }))
    child.on('close', (code) => done({ code: timedOut ? null : code, timedOut }))
  })

/** Accords donnés : dépôt → empreinte des commandes (réglages). */
export interface SetupApprovals {
  approved(root: string, fingerprint: string): boolean
  /** `config` : les commandes, gardées pour être montrées dans les Réglages. */
  approve(root: string, fingerprint: string, config: WorktreeConfig): void
}

export interface PreparationOptions {
  /** git (file par dépôt, fiche 138) pour lister les fichiers à copier. */
  run: Run
  approvals: SetupApprovals
  /** Environnement des commandes (PATH du shell de connexion). */
  env: () => NodeJS.ProcessEnv
  log: {
    info: (message: string, ...details: unknown[]) => void
    warn: (message: string, ...details: unknown[]) => void
  }
  shell?: ShellRun
  git?: string
  /** Intervalle minimal entre deux mises à jour de la carte pendant la commande. */
  throttleMs?: number
  now?: () => Date
}

/** Empreinte de l'accord : les commandes du fichier, telles quelles. */
export const fingerprint = (config: WorktreeConfig): string =>
  createHash('sha256').update(configSignature(config)).digest('hex')

/** `.bobine/worktree.json` du dossier ; absent ou illisible : aucune commande. */
export async function readWorktreeConfig(root: string): Promise<WorktreeConfig> {
  try {
    return parseWorktreeConfig(JSON.parse(await readFile(join(root, WORKTREE_CONFIG_FILE), 'utf8')))
  } catch {
    return {}
  }
}

type Emit = (setup: WorktreeSetup) => void

/** Raison de l'arrêt demandé par l'utilisateur (« Arrêter »), distincte d'une suppression. */
const STOPPED_BY_USER = 'stopped-by-user'

/** Issue de « Autoriser » : lancée (ou rien à lancer), fichier changé (accord redemandé), ignorée. */
export type ApproveResult = 'approved' | 'changed' | 'ignored'

interface Pending {
  path: string
  done: Promise<WorktreeSetup | undefined>
  state?: WorktreeSetup
  abort: AbortController
  /** Carte de la conversation (état complété des messages retenus). */
  emit: Emit
  /** Copie et commande finies (réussies ou non). */
  finished?: boolean
  /** Le premier message a déjà reçu sa ligne de contexte (ou n'en avait pas besoin). */
  told?: boolean
  /** Messages retenus par le branchement, dits sur la carte. */
  held?: number
  /** « Continuer sans attendre » : la commande tourne, les messages ne l'attendent plus. */
  proceeded?: boolean
}

/** Commandes montrées sur la carte, avec l'empreinte que l'accord devra renvoyer. */
const shownCommands = (config: WorktreeConfig) => ({
  ...(config.setup ? { command: config.setup } : {}),
  ...(config.archive ? { archive: config.archive } : {})
})

export class WorktreePreparation {
  private readonly options: PreparationOptions
  private readonly shell: ShellRun
  private readonly pending = new Map<string, Pending>()

  constructor(options: PreparationOptions) {
    this.options = options
    this.shell = options.shell ?? shellRun
  }

  /**
   * Prépare le worktree d'une conversation : copie, puis commande autorisée. `emit` reçoit chaque
   * état de la carte. Ne lève jamais ; `settled` rend la promesse de fin.
   */
  start(id: string, worktree: WorktreeInfo, emit: Emit): void {
    const entry: Pending = {
      path: worktree.path,
      abort: new AbortController(),
      emit,
      done: Promise.resolve(undefined)
    }
    this.pending.set(id, entry)
    entry.done = this.track(entry, this.prepare(worktree, this.emitter(entry), entry.abort.signal))
  }

  /** Fin de la préparation en cours (copie et commande autorisée) ; rien sans préparation. */
  settled(id: string): Promise<WorktreeSetup | undefined> {
    return this.pending.get(id)?.done ?? Promise.resolve(undefined)
  }

  /**
   * Préparation pas encore dite au premier message : `finished` faux tant que la copie ou la
   * commande tourne. `undefined` sans préparation, ou une fois la ligne de contexte prise.
   */
  awaiting(
    id: string
  ): { done: Promise<unknown>; finished: boolean; setup?: WorktreeSetup } | undefined {
    const entry = this.pending.get(id)
    if (!entry || entry.told) return undefined
    return {
      done: entry.done,
      finished: !!entry.finished,
      ...(entry.state ? { setup: entry.state } : {})
    }
  }

  /**
   * Messages retenus par le branchement : la carte le dit (« Votre message attend… »). Rend faux
   * s'il n'y a pas encore de carte (copie qui commence).
   */
  hold(id: string, count: number): boolean {
    const entry = this.pending.get(id)
    if (!entry) return false
    entry.held = count
    if (!entry.state) return false
    this.emitter(entry)(entry.state)
    return true
  }

  /**
   * « Continuer sans préparer » (commande à autoriser) : elle n'est pas lancée ; la carte le dit,
   * et le premier message le dira à l'agent. `unattended` : exécution sans surveillance (tâche
   * planifiée), qui n'attend jamais d'accord. Rend vrai si c'était bien à autoriser.
   */
  skip(id: string, unattended = false): boolean {
    const entry = this.pending.get(id)
    if (entry?.state?.state !== 'approval') return false
    const { held: _held, changed: _changed, signature: _signature, ...rest } = entry.state
    entry.held = undefined
    this.emitter(entry)({ ...rest, state: 'skipped', ...(unattended ? { unattended: true } : {}) })
    return true
  }

  /**
   * « Arrêter » : la commande `setup` en cours est arrêtée (état « échec », arrêtée par
   * l'utilisateur) ; les messages retenus partent avec la ligne de contexte. Rend vrai si elle
   * tournait.
   */
  stop(id: string): boolean {
    const entry = this.pending.get(id)
    if (entry?.state?.state !== 'running' || entry.finished) return false
    entry.abort.abort(STOPPED_BY_USER)
    return true
  }

  /**
   * « Continuer sans attendre » : la commande continue, les messages ne l'attendent plus. Rend la
   * ligne de contexte du premier d'entre eux (commande encore en cours), ou `undefined` si elle
   * ne tournait pas.
   */
  proceed(id: string): string | undefined {
    const entry = this.pending.get(id)
    if (entry?.state?.state !== 'running' || entry.finished || entry.told) return undefined
    entry.proceeded = true
    entry.told = true
    entry.held = undefined
    this.emitter(entry)(entry.state)
    return setupContext({ ...entry.state, proceeded: true }) ?? ''
  }

  /** Ligne de contexte du premier message (échec, accord attendu), une seule fois. */
  takeContext(id: string): string | undefined {
    const entry = this.pending.get(id)
    if (!entry || entry.told || !entry.finished) return undefined
    entry.told = true
    return setupContext(entry.state)
  }

  /**
   * « Autoriser » : l'accord ne couvre que les commandes montrées, dont la carte renvoie
   * l'empreinte (`signature`). Le fichier est relu : s'il a changé, rien ne tourne et la carte
   * montre les nouvelles commandes à autoriser (`changed`). Sinon l'accord est gardé pour ce
   * dépôt et ces commandes, puis `setup` est lancée dans le worktree (rend après sa fin).
   */
  async approve(id: string, worktree: WorktreeInfo, signature: string): Promise<ApproveResult> {
    const entry = this.pending.get(id)
    if (!entry || entry.state?.state !== 'approval' || entry.state.signature !== signature) {
      return 'ignored'
    }
    const emit = this.emitter(entry)
    const copy = entry.state.copy
    const config = await readWorktreeConfig(worktree.root)
    if (!hasCommands(config)) {
      emit({ ...(copy ? { copy } : {}), state: 'done' })
      return 'approved'
    }
    const print = fingerprint(config)
    if (print !== signature) {
      emit({
        ...(copy ? { copy } : {}),
        ...shownCommands(config),
        state: 'approval',
        signature: print,
        changed: true
      })
      return 'changed'
    }
    this.options.approvals.approve(await this.repoOf(worktree.root), print, config)
    if (!config.setup) {
      emit({ ...(copy ? { copy } : {}), ...shownCommands(config), state: 'done' })
      return 'approved'
    }
    entry.finished = false
    entry.abort = new AbortController()
    entry.done = this.track(entry, this.runSetup(worktree, config, copy, emit, entry.abort.signal))
    await entry.done
    return 'approved'
  }

  /**
   * Avant la suppression d'un worktree par l'app : la préparation en cours est arrêtée, puis la
   * commande `archive` autorisée est lancée dans le worktree. Ne lève jamais.
   */
  async beforeRemove(info: WorktreeInfo): Promise<void> {
    for (const entry of this.pending.values()) {
      if (entry.path === info.path) entry.abort.abort()
    }
    const config = await readWorktreeConfig(info.root)
    if (!config.archive) return
    if (!this.options.approvals.approved(await this.repoOf(info.root), fingerprint(config))) return
    const started = Date.now()
    const result = await this.shell(config.archive, {
      cwd: info.path,
      env: this.env(info),
      timeoutMs: ARCHIVE_TIMEOUT_MS,
      onOutput: () => {},
      signal: new AbortController().signal
    }).catch((error: unknown) => ({ code: null, timedOut: false, error: String(error) }))
    this.logEnd('archive', config.archive, result, started)
  }

  /** Départ de l'app : les commandes en cours sont arrêtées. */
  dispose(): void {
    for (const entry of this.pending.values()) entry.abort.abort()
  }

  /**
   * Carte d'une entrée : l'état est gardé, complété des messages retenus et de « Continuer sans
   * attendre » tant que la commande attend l'accord ou tourne.
   */
  private emitter(entry: Pending): Emit {
    return (setup) => {
      const { held: _held, proceeded: _proceeded, ...base } = setup
      entry.state = base
      const live = setup.state === 'running' || setup.state === 'approval'
      entry.emit({
        ...base,
        ...(live && entry.held && !entry.proceeded ? { held: entry.held } : {}),
        ...(setup.state === 'running' && entry.proceeded ? { proceeded: true } : {})
      })
    }
  }

  private track(
    entry: Pending,
    work: Promise<WorktreeSetup | undefined>
  ): Promise<WorktreeSetup | undefined> {
    return work
      .catch((error: unknown) => {
        this.options.log.warn('Préparation du worktree impossible :', error)
        return entry.state
      })
      .finally(() => {
        entry.finished = true
        entry.held = undefined
      })
  }
  private async prepare(
    worktree: WorktreeInfo,
    emit: Emit,
    signal: AbortSignal
  ): Promise<WorktreeSetup | undefined> {
    const config = await readWorktreeConfig(worktree.root)
    const print = fingerprint(config)
    const approved =
      hasCommands(config) &&
      this.options.approvals.approved(await this.repoOf(worktree.root), print)
    // Commande à suivre : la carte est « en cours » dès la copie.
    if (approved && config.setup) emit({ ...shownCommands(config), state: 'running' })
    const copy = signal.aborted
      ? undefined
      : ((await copyIncluded(this.options.run, worktree.root, worktree.path, this.options.git)) ??
        undefined)
    // À autoriser : toutes les commandes que l'accord couvrira (`archive` seule comprise).
    if (hasCommands(config) && !approved) {
      const setup: WorktreeSetup = {
        ...(copy ? { copy } : {}),
        ...shownCommands(config),
        state: 'approval',
        signature: print
      }
      emit(setup)
      return setup
    }
    if (!config.setup) {
      if (!copy && !config.archive) return undefined
      const setup: WorktreeSetup = {
        ...(copy ? { copy } : {}),
        ...shownCommands(config),
        state: 'done'
      }
      emit(setup)
      return setup
    }
    return this.runSetup(worktree, config, copy, emit, signal)
  }

  private async runSetup(
    worktree: WorktreeInfo,
    config: WorktreeConfig,
    copy: WorktreeSetup['copy'],
    emit: Emit,
    signal: AbortSignal
  ): Promise<WorktreeSetup> {
    const command = config.setup ?? ''
    const now = this.options.now ?? (() => new Date())
    const started = now()
    const base: WorktreeSetup = {
      ...(copy ? { copy } : {}),
      ...shownCommands(config),
      state: 'running',
      startedAt: started.toISOString()
    }
    emit(base)
    this.options.log.info(`Préparation du worktree ${worktree.branch} : ${command}`)
    let output = ''
    let last = 0
    let timer: NodeJS.Timeout | undefined
    const flush = () => {
      timer = undefined
      last = Date.now()
      emit({ ...base, output: tailOutput(output) })
    }
    const throttle = this.options.throttleMs ?? 400
    // Arrêtée pendant la copie : la commande n'est pas lancée.
    const run = signal.aborted
      ? Promise.resolve<CommandResult>({ code: null, timedOut: false, error: 'stopped' })
      : this.shell(command, {
          cwd: worktree.path,
          env: this.env(worktree),
          timeoutMs: SETUP_TIMEOUT_MS,
          signal,
          onOutput: (chunk) => {
            // Gardée bornée : la carte n'en montre que la fin.
            output = (output + chunk).slice(-64_000)
            if (timer) return
            const wait = Math.max(0, throttle - (Date.now() - last))
            timer = setTimeout(flush, wait)
          }
        })
    const result = await run.catch((error: unknown) => ({
      code: null,
      timedOut: false,
      error: String(error)
    }))
    if (timer) clearTimeout(timer)
    this.logEnd('setup', command, result, started.getTime())
    const stopped = signal.aborted && signal.reason === STOPPED_BY_USER
    const ok = result.code === 0 && !stopped
    const setup: WorktreeSetup = {
      ...base,
      state: ok ? 'done' : 'failed',
      endedAt: now().toISOString(),
      ...(output ? { output: tailOutput(output) } : {}),
      ...(!ok && result.code !== null ? { exitCode: result.code } : {}),
      ...(result.timedOut ? { timedOut: true } : {}),
      ...(stopped ? { stopped: true } : result.error ? { error: result.error } : {})
    }
    emit(setup)
    return setup
  }

  /**
   * Dépôt de l'accord : le dossier principal du dépôt (parent du dossier git commun), pour qu'un
   * worktree parti d'un autre worktree (fille d'une fille) relève du même accord. `root` si git
   * ne répond pas.
   */
  private async repoOf(root: string): Promise<string> {
    const result = await this.options
      .run(this.options.git ?? 'git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
        cwd: root,
        timeoutMs: 10_000
      })
      .catch(() => undefined)
    const common = result?.code === 0 ? result.stdout.toString('utf8').trim() : ''
    return common && basename(common) === '.git' ? dirname(common) : root
  }

  private env(worktree: WorktreeInfo): NodeJS.ProcessEnv {
    return {
      ...this.options.env(),
      BOBINE_WORKTREE_SOURCE: worktree.root,
      BOBINE_WORKTREE_PATH: worktree.path,
      BOBINE_WORKTREE_BRANCH: worktree.branch
    }
  }

  private logEnd(kind: string, command: string, result: CommandResult, started: number): void {
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    const end = result.timedOut
      ? 'arrêtée au délai'
      : result.code === null
        ? `non lancée (${result.error ?? 'arrêtée'})`
        : `code ${result.code}`
    const line = `Worktree, commande ${kind} « ${command} » : ${end}, ${seconds} s`
    if (result.code === 0) this.options.log.info(line)
    else this.options.log.warn(line)
  }
}
