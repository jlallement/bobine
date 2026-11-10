/**
 * Planificateur des tâches (fiche 178, ADR-0039). Dans le main, tant que Bobine est ouverte : un
 * contrôle toutes les 30 s (et au réveil du Mac) compare l'heure aux échéances. Une exécution est
 * une conversation ordinaire, créée hors de l'active par le gestionnaire (`createDetached`, comme
 * une fille) avec la marque `scheduled`, puis la consigne est envoyée (`prompt`) : mêmes
 * autorisations, mêmes notifications, même plafond de coût que toute conversation.
 *
 * Garde-fous du coût :
 * - jamais deux exécutions d'une tâche en même temps : l'échéance est notée « sautée » ;
 * - jamais de rafale : toutes les échéances passées donnent au plus un rattrapage (`dueDecision`) ;
 * - le plafond de la tâche devient le plafond propre de la conversation (fiche 157), dès que
 *   l'unité de l'agent est connue (exécution précédente, ou première consommation).
 *
 * Une exécution dans un nouveau worktree n'attend jamais l'accord de sa commande de préparation
 * (fiche 175) : elle part sans, et son historique le dit (`setupNotApproved`).
 *
 * Rien de propre à un agent.
 */
import { randomUUID } from 'node:crypto'
import { t } from 'i18next'
import type { AgentEvent, ConversationEvent } from '@shared/agent'
import { capUnitOf, TOKEN_UNIT } from '@shared/cost-cap'
import {
  dueDecision,
  knownUnit,
  MAX_RUNS,
  nextRunAfter,
  type ScheduledTask,
  type ScheduledTaskInput,
  type TaskRun
} from '@shared/schedule'
import { log } from '../log'
import type { ConversationManager } from '../conversations/manager'
import type { TaskStorage } from './task-store'

/** Contrôle des échéances. */
export const CHECK_EVERY_MS = 30_000

type Manager = Pick<
  ConversationManager,
  'createDetached' | 'prompt' | 'subscribe' | 'state' | 'view' | 'post'
>

export interface SchedulerOptions {
  manager: Manager
  storage: TaskStorage
  isDirectory: (path: string) => boolean
  /** Lancement impossible : notification système (titre de la tâche, raison). */
  notifyFailure: (task: ScheduledTask, reason: string) => void
  /** Liste changée, pour les fenêtres. */
  emit: (tasks: ScheduledTask[]) => void
  now?: () => Date
}

/** Évènement après lequel l'unité du coût peut devenir connue. */
const usageEvent = (event: AgentEvent) =>
  event.type === 'usage-report' ||
  event.type === 'turn-end' ||
  (event.type === 'update' && event.update.sessionUpdate === 'usage_update')

export class Scheduler {
  private tasks: ScheduledTask[] = []
  private readonly options: SchedulerOptions
  private readonly now: () => Date
  private timer: ReturnType<typeof setInterval> | undefined
  private unsubscribe: (() => void) | undefined
  /** Exécutions en cours : conversation → tâche. */
  private readonly running = new Map<string, string>()
  /** Conversations arrêtées par le plafond pendant leur tour. */
  private readonly capHit = new Set<string>()

  constructor(options: SchedulerOptions) {
    this.options = options
    this.now = options.now ?? (() => new Date())
  }

  /** Lit les tâches, suit les conversations et commence les contrôles ; rend l'arrêt. */
  start(): () => void {
    this.tasks = this.options.storage.load()
    // Une exécution « en cours » d'un lancement précédent ne l'est plus : l'app a été quittée.
    const at = this.now().toISOString()
    for (const run of this.tasks.flatMap((task) => task.runs)) {
      if (run.outcome === 'running') Object.assign(run, { outcome: 'stopped', endedAt: at })
    }
    this.unsubscribe = this.options.manager.subscribe({
      event: (payload) => this.onEvent(payload),
      deleted: (id) => this.finish(id, 'stopped')
    })
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS)
    this.check()
    return () => this.stop()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  list(): ScheduledTask[] {
    return structuredClone(this.tasks)
  }

  create(input: ScheduledTaskInput): ScheduledTask[] {
    const now = this.now()
    const task: ScheduledTask = {
      ...input,
      id: randomUUID(),
      paused: false,
      createdAt: now.toISOString(),
      runs: []
    }
    this.reschedule(task, now)
    this.tasks.push(task)
    return this.changed()
  }

  update(id: string, input: ScheduledTaskInput): ScheduledTask[] {
    const task = this.get(id)
    const { cap: _cap, ...rest } = task
    Object.assign(task, { ...rest, ...input })
    if (!input.cap) delete task.cap
    this.reschedule(task, this.now())
    return this.changed()
  }

  /** Pause ou reprise ; à la reprise, rien n'est rattrapé : la prochaine échéance part de maintenant. */
  setPaused(id: string, paused: boolean): ScheduledTask[] {
    const task = this.get(id)
    task.paused = paused
    this.reschedule(task, this.now())
    return this.changed()
  }

  remove(id: string): ScheduledTask[] {
    this.tasks = this.tasks.filter((task) => task.id !== id)
    return this.changed()
  }

  /** « Lancer maintenant » : refusé si une exécution de la tâche tourne encore. */
  async runNow(id: string): Promise<ScheduledTask[]> {
    const task = this.get(id)
    if (this.isRunning(task)) throw new Error(t('scheduled.error.alreadyRunning'))
    await this.launch(task, { manual: true })
    return this.list()
  }

  /** Contrôle des échéances (minuterie, réveil du Mac). */
  check(): void {
    const now = this.now()
    let changed = false
    for (const task of this.tasks) {
      const decision = dueDecision(task, now)
      if (decision.kind === 'none') continue
      changed = true
      if (decision.next) task.nextRunAt = decision.next.toISOString()
      else delete task.nextRunAt
      const dueAt = decision.dueAt.toISOString()
      const missed = decision.missed > 0 ? { missed: decision.missed } : {}
      if (decision.kind === 'missed') {
        this.record(task, { outcome: 'missed', dueAt, ...missed })
      } else if (this.isRunning(task)) {
        this.record(task, { outcome: 'skipped', dueAt })
      } else {
        void this.launch(task, {
          dueAt,
          ...(decision.kind === 'catch-up' ? { catchUp: true as const, ...missed } : {})
        })
      }
    }
    if (changed) this.changed()
  }

  private get(id: string): ScheduledTask {
    const task = this.tasks.find((candidate) => candidate.id === id)
    if (!task) throw new Error(`Tâche planifiée inconnue : ${id}`)
    return task
  }

  private reschedule(task: ScheduledTask, now: Date): void {
    const next = task.paused ? undefined : nextRunAfter(task.schedule, now, now)
    if (next) task.nextRunAt = next.toISOString()
    else delete task.nextRunAt
  }

  private isRunning(task: ScheduledTask): boolean {
    return task.runs.some((run) => run.outcome === 'running')
  }

  private record(task: ScheduledTask, run: Omit<TaskRun, 'id' | 'at'>): TaskRun {
    const entry: TaskRun = { id: randomUUID(), at: this.now().toISOString(), ...run }
    task.runs = [entry, ...task.runs].slice(0, MAX_RUNS)
    return entry
  }

  private changed(): ScheduledTask[] {
    this.options.storage.save(this.tasks)
    const list = this.list()
    this.options.emit(list)
    return list
  }

  private async launch(task: ScheduledTask, meta: Partial<TaskRun>): Promise<void> {
    const run = this.record(task, { outcome: 'running', ...meta })
    this.changed()
    const { manager } = this.options
    try {
      if (!this.options.isDirectory(task.folder)) {
        throw new Error(t('scheduled.error.folderMissing', { folder: task.folder }))
      }
      const summary = await manager.createDetached({
        from: { workspace: task.folder, profileId: task.profileId },
        profileId: task.profileId,
        worktree: task.worktree,
        title: task.name,
        record: { scheduled: { taskId: task.id, name: task.name } }
      })
      run.conversationId = summary.id
      this.running.set(summary.id, task.id)
      this.changed()
      // Unité connue d'une exécution précédente : le plafond est posé avant le premier message.
      const unit = knownUnit(task.runs)
      if (unit) this.applyCap(task, summary.id, unit)
      await manager.prompt(summary.id, task.instruction)
    } catch (error) {
      if (run.outcome !== 'running') return // Tour déjà fini en erreur : l'issue est notée.
      const reason = error instanceof Error ? error.message : String(error)
      log.warn(`Tâche planifiée « ${task.name} » : lancement impossible :`, error)
      if (run.conversationId) this.running.delete(run.conversationId)
      Object.assign(run, { outcome: 'failed', error: reason, endedAt: this.now().toISOString() })
      this.changed()
      this.options.notifyFailure(task, reason)
    }
  }

  /** Plafond de la tâche dans l'unité de la conversation, posé comme son plafond propre. */
  private applyCap(task: ScheduledTask, conversationId: string, unit: string): void {
    const limit = unit === TOKEN_UNIT ? task.cap?.tokens : task.cap?.amount
    if (limit === undefined) return
    this.options.manager.post(conversationId, { type: 'cost-cap-set', cap: { limit, unit } })
  }

  private onEvent({ conversationId: id, event }: ConversationEvent): void {
    const taskId = this.running.get(id)
    if (!taskId) {
      // Plafond vu franchi après la fin du tour : l'issue de l'exécution le dit.
      if (event.type === 'cost-cap-reached') this.markCapped(id)
      return
    }
    if (event.type === 'cost-cap-reached') this.capHit.add(id)
    if (event.type === 'worktree-setup' && event.setup.unattended) this.markSetupSkipped(id)
    if (usageEvent(event)) this.resolveCap(taskId, id)
    if (event.type === 'turn-end') this.finish(id, this.capHit.has(id) ? 'capped' : 'done')
    else if (event.type === 'turn-error') this.finish(id, this.capHit.has(id) ? 'capped' : 'error')
    else if (event.type === 'status' && ['exited', 'error'].includes(event.snapshot.status)) {
      this.finish(id, 'stopped')
    }
  }

  /** Première consommation : l'unité est connue, le plafond de la tâche peut être posé. */
  private resolveCap(taskId: string, id: string): void {
    const task = this.tasks.find((candidate) => candidate.id === taskId)
    if (!task?.cap) return
    let transcript: ReturnType<Manager['view']>['transcript']
    try {
      transcript = this.options.manager.view(id).transcript
    } catch {
      return // Conversation supprimée entre-temps.
    }
    const unit = capUnitOf(transcript.usage)
    const own = transcript.costCap
    // Déjà posé dans cette unité (ou relevé par « Continuer ») : on n'y touche plus.
    const current = typeof own === 'object' ? own.unit : undefined
    if (unit && current !== unit) this.applyCap(task, id, unit)
  }

  private runOf(id: string): { task: ScheduledTask; run: TaskRun } | undefined {
    for (const task of this.tasks) {
      const run = task.runs.find((r) => r.conversationId === id)
      if (run) return { task, run }
    }
    return undefined
  }

  /** Préparation du worktree non autorisée : l'exécution part sans elle, son historique le dit. */
  private markSetupSkipped(id: string): void {
    const found = this.runOf(id)
    if (!found || found.run.setupNotApproved) return
    found.run.setupNotApproved = true
    this.changed()
  }

  private markCapped(id: string): void {
    const found = this.runOf(id)
    if (!found || found.run.outcome !== 'done') return
    found.run.outcome = 'capped'
    this.changed()
  }

  private finish(id: string, outcome: TaskRun['outcome']): void {
    if (!this.running.delete(id)) return
    this.capHit.delete(id)
    const found = this.runOf(id)
    if (!found) return
    const usage = this.options.manager.state().conversations.find((c) => c.id === id)?.usage
    Object.assign(found.run, {
      outcome,
      endedAt: this.now().toISOString(),
      ...(usage?.cost ? { cost: usage.cost } : {}),
      ...(usage?.total !== undefined ? { tokens: usage.total } : {})
    })
    this.changed()
  }
}
