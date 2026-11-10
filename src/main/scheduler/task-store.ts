/**
 * Fichier des tâches planifiées (fiche 178) : `scheduled-tasks.json` à côté de `settings.json`,
 * versionné (`version`), écrit de façon atomique ; un fichier illisible est mis de côté
 * (`readJson`), un fichier d'une version plus récente de Bobine est laissé tel quel (lecture seule).
 */
import { log } from '../log'
import { readJson, writeFileAtomicAsync } from '../storage'
import {
  MAX_RUNS,
  parseTaskInput,
  type RunOutcome,
  type ScheduledTask,
  type TaskRun
} from '@shared/schedule'

export const TASKS_FILE = 'scheduled-tasks.json'
export const TASKS_VERSION = 1

const OUTCOMES: readonly RunOutcome[] = [
  'running',
  'done',
  'error',
  'capped',
  'failed',
  'skipped',
  'missed',
  'stopped'
]

function parseRun(value: unknown): TaskRun | undefined {
  const r = value as Partial<TaskRun> | null
  if (typeof r !== 'object' || r === null) return undefined
  if (typeof r.id !== 'string' || typeof r.at !== 'string') return undefined
  if (!OUTCOMES.includes(r.outcome as RunOutcome)) return undefined
  return r as TaskRun
}

/** Une tâche lue du fichier ; `undefined` si elle est mal formée (elle est alors ignorée). */
export function parseStoredTask(value: unknown): ScheduledTask | undefined {
  const v = value as Partial<ScheduledTask> | null
  if (typeof v !== 'object' || v === null || typeof v.id !== 'string') return undefined
  try {
    const input = parseTaskInput(v)
    const runs = Array.isArray(v.runs) ? v.runs.map(parseRun).filter((r) => r !== undefined) : []
    return {
      ...input,
      id: v.id,
      paused: v.paused === true,
      createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
      ...(typeof v.nextRunAt === 'string' ? { nextRunAt: v.nextRunAt } : {}),
      runs: runs.slice(0, MAX_RUNS)
    }
  } catch {
    return undefined
  }
}

export interface TaskStorage {
  load(): ScheduledTask[]
  save(tasks: readonly ScheduledTask[]): void
}

export class TaskStore implements TaskStorage {
  private readonly file: string
  /** Fichier d'une version plus récente : jamais réécrit. */
  private readOnly = false
  /** Écritures en file : la dernière l'emporte, dans l'ordre. */
  private queue: Promise<unknown> = Promise.resolve()
  private generation = 0

  constructor(file: string) {
    this.file = file
  }

  load(): ScheduledTask[] {
    const read = readJson(this.file)
    if (!read.ok) {
      if (read.reason === 'corrupt')
        log.warn(`Tâches planifiées illisibles, mises de côté : ${read.movedTo ?? this.file}`)
      return []
    }
    const data = read.value as { version?: unknown; tasks?: unknown } | null
    if (typeof data?.version === 'number' && data.version > TASKS_VERSION) {
      log.warn(`Tâches planifiées d'une version plus récente (${data.version}) : lecture seule`)
      this.readOnly = true
    }
    const tasks = Array.isArray(data?.tasks) ? data.tasks : []
    return tasks.map(parseStoredTask).filter((task) => task !== undefined)
  }

  save(tasks: readonly ScheduledTask[]): void {
    if (this.readOnly) return
    const text = JSON.stringify({ version: TASKS_VERSION, tasks }, null, 2)
    const generation = ++this.generation
    this.queue = this.queue
      .then(() =>
        writeFileAtomicAsync(this.file, text, { commit: () => generation === this.generation })
      )
      .catch((error: unknown) => log.warn('Écriture des tâches planifiées impossible :', error))
  }

  /** Attend les écritures en cours (essais, arrêt). */
  flushed(): Promise<unknown> {
    return this.queue
  }
}
