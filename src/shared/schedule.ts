/**
 * Tâches planifiées (fiche 178, ADR-0039) : une consigne, un dossier, un agent et une fréquence ;
 * à l'heure dite, le main ouvre une conversation ordinaire et envoie la consigne. Ce module est
 * pur (main, renderer, essais) : types, validation, échéances à l'heure locale, estimation du coût.
 */

/** Fréquence d'une tâche, à l'heure locale du Mac. */
export type Schedule =
  /** Une seule fois : date et heure locales `AAAA-MM-JJTHH:MM`. */
  | { kind: 'once'; at: string }
  /** Chaque jour à `HH:MM`. */
  | { kind: 'daily'; time: string }
  /** Du lundi au vendredi à `HH:MM`. */
  | { kind: 'weekdays'; time: string }
  /** Toutes les `hours` heures (1 à 24), comptées depuis la création ou la dernière échéance. */
  | { kind: 'interval'; hours: number }

export type ScheduleKind = Schedule['kind']

/**
 * Plafond d'une tâche (fiche 157) : un montant dans la devise de l'agent (bobcoins, dollars…), ou
 * des jetons quand l'agent ne donne pas de coût. La devise n'est connue qu'à la première
 * consommation : le plafond propre de la conversation est posé à ce moment-là.
 */
export interface TaskCap {
  amount?: number
  tokens?: number
}

/** Ce que l'utilisateur saisit pour une tâche. */
export interface ScheduledTaskInput {
  name: string
  instruction: string
  folder: string
  profileId: string
  schedule: Schedule
  /** Chaque exécution dans un nouveau worktree du dossier (fiche 036). */
  worktree: boolean
  /** Au plus une exécution de rattrapage pour les échéances manquées (Mac en veille, app fermée). */
  catchUp: boolean
  cap?: TaskCap
}

/**
 * Issue d'une exécution : en cours, finie, en erreur (tour en échec), arrêtée au plafond, lancement
 * impossible, sautée (la précédente tournait encore), manquée (sans rattrapage), interrompue
 * (agent arrêté, conversation supprimée).
 */
export type RunOutcome =
  'running' | 'done' | 'error' | 'capped' | 'failed' | 'skipped' | 'missed' | 'stopped'

export interface TaskRun {
  id: string
  /** Échéance (ISO) ; absente pour « Lancer maintenant ». */
  dueAt?: string
  /** Début (ISO) : lancement, ou moment où l'échéance a été sautée ou notée manquée. */
  at: string
  endedAt?: string
  outcome: RunOutcome
  /** Lancée à la main (« Lancer maintenant »). */
  manual?: true
  /** Rattrapage d'une échéance manquée. */
  catchUp?: true
  /** Échéances manquées regroupées dans cette ligne (rattrapage ou « manquée »). */
  missed?: number
  conversationId?: string
  /** Coût réel (résumé de consommation de la conversation à la fin du tour). */
  cost?: { amount: number; currency: string }
  tokens?: number
  /** Raison d'un lancement impossible (texte de l'erreur). */
  error?: string
  /**
   * Nouveau worktree d'un dépôt dont la commande de préparation n'est pas autorisée (fiche 175) :
   * l'exécution n'attend pas l'accord, elle part sans la préparation.
   */
  setupNotApproved?: true
}

export interface ScheduledTask extends ScheduledTaskInput {
  id: string
  paused: boolean
  createdAt: string
  /** Prochaine échéance (ISO) ; absente en pause, ou pour « une fois » déjà passée. */
  nextRunAt?: string
  /** Dernières exécutions, la plus récente d'abord (au plus `MAX_RUNS`). */
  runs: TaskRun[]
}

/** Exécutions gardées par tâche. */
export const MAX_RUNS = 20
/** Retard au-delà duquel une échéance est « manquée » (et non simplement un peu tardive). */
export const LATE_GRACE_MS = 10 * 60_000
/** Exécutions prises en compte pour l'estimation du coût. */
const ESTIMATE_RUNS = 5
const HOUR_MS = 3_600_000

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/

/** `HH:MM` → heures et minutes ; `undefined` si mal formé. */
function parseTime(time: string): { h: number; m: number } | undefined {
  const match = TIME.exec(time)
  return match ? { h: Number(match[1]), m: Number(match[2]) } : undefined
}

/** `AAAA-MM-JJTHH:MM` à l'heure locale ; `undefined` si mal formé ou date impossible. */
export function parseLocalDateTime(value: string): Date | undefined {
  const match = LOCAL_DATE_TIME.exec(value)
  if (!match) return undefined
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [number, number, number, number, number]
  const date = new Date(y, mo - 1, d, h, mi)
  return date.getMonth() === mo - 1 && date.getDate() === d ? date : undefined
}

/** Date locale au format des champs `datetime-local` (`AAAA-MM-JJTHH:MM`). */
export function toLocalDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

const isWeekday = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6

/**
 * Prochaine échéance strictement après `after`. `anchor` (création ou dernière échéance) cale les
 * fréquences « toutes les N heures » sur leur grille.
 */
export function nextRunAfter(
  schedule: Schedule,
  after: Date,
  anchor: Date = after
): Date | undefined {
  switch (schedule.kind) {
    case 'once': {
      const at = parseLocalDateTime(schedule.at)
      return at && at > after ? at : undefined
    }
    case 'interval': {
      const step = schedule.hours * HOUR_MS
      if (!(step > 0)) return undefined
      const elapsed = after.getTime() - anchor.getTime()
      const k = elapsed < 0 ? 1 : Math.floor(elapsed / step) + 1
      return new Date(anchor.getTime() + k * step)
    }
    case 'daily':
    case 'weekdays': {
      const time = parseTime(schedule.time)
      if (!time) return undefined
      for (let day = 0; day <= 7; day++) {
        const candidate = new Date(
          after.getFullYear(),
          after.getMonth(),
          after.getDate() + day,
          time.h,
          time.m
        )
        if (candidate <= after) continue
        if (schedule.kind === 'daily' || isWeekday(candidate)) return candidate
      }
      return undefined
    }
  }
}

/** Ce qu'il faut faire d'une tâche à l'instant `now`. */
export type DueDecision =
  | { kind: 'none' }
  /**
   * Échéance atteinte : `run` à l'heure (ou presque), `catch-up` pour un rattrapage, `missed` quand
   * la tâche ne rattrape pas. `missed` compte les échéances passées regroupées (au moins 1 pour
   * `catch-up` et `missed`) ; `next` est la prochaine échéance, après `now`.
   */
  | { kind: 'run' | 'catch-up' | 'missed'; dueAt: Date; missed: number; next: Date | undefined }

/**
 * Décision pour une tâche : jamais de rafale, une seule exécution au plus pour toutes les échéances
 * passées, et la suivante repart de maintenant.
 */
export function dueDecision(
  task: Pick<ScheduledTask, 'paused' | 'nextRunAt' | 'schedule' | 'catchUp'>,
  now: Date,
  graceMs = LATE_GRACE_MS
): DueDecision {
  if (task.paused || !task.nextRunAt) return { kind: 'none' }
  const dueAt = new Date(task.nextRunAt)
  if (Number.isNaN(dueAt.getTime()) || dueAt > now) return { kind: 'none' }
  // Échéances passées depuis la première (bornées : une tâche horaire après un mois d'absence).
  let latest = dueAt
  let count = 1
  for (let next = nextRunAfter(task.schedule, dueAt, dueAt); next && next <= now;) {
    latest = next
    count++
    if (count > 10_000) break
    next = nextRunAfter(task.schedule, next, dueAt)
  }
  const next = nextRunAfter(task.schedule, now, latest)
  const onTime = count === 1 && now.getTime() - dueAt.getTime() <= graceMs
  if (onTime) return { kind: 'run', dueAt, missed: 0, next }
  return { kind: task.catchUp ? 'catch-up' : 'missed', dueAt: latest, missed: count, next }
}

/**
 * Exécutions par jour d'une tâche fréquente (« toutes les N heures ») : là où part l'argent. Rien
 * pour les autres fréquences (une par jour au plus : le coût par jour est celui d'une exécution).
 */
export function runsPerDay(schedule: Schedule): number | undefined {
  return schedule.kind === 'interval' && schedule.hours < 24 ? 24 / schedule.hours : undefined
}

/** Unité du coût connue d'une exécution passée : sa devise, sinon `tokens` ; rien avant. */
export function knownUnit(runs: readonly TaskRun[]): string | undefined {
  const run = runs.find((r) => r.cost || r.tokens !== undefined)
  return run?.cost?.currency ?? (run ? 'tokens' : undefined)
}

/** Estimation du coût d'une exécution : moyenne des dernières qui ont un coût, dans une devise. */
export function estimateCost(
  runs: readonly TaskRun[]
):
  | { amount: number; currency: string; runs: number }
  | { tokens: number; runs: number }
  | undefined {
  const costed = runs.filter((r) => r.cost && r.outcome !== 'running')
  const currency = costed[0]?.cost?.currency
  if (currency) {
    const same = costed.filter((r) => r.cost?.currency === currency).slice(0, ESTIMATE_RUNS)
    const total = same.reduce((sum, r) => sum + (r.cost?.amount ?? 0), 0)
    return { amount: total / same.length, currency, runs: same.length }
  }
  const counted = runs
    .filter((r) => r.tokens !== undefined && r.outcome !== 'running')
    .slice(0, ESTIMATE_RUNS)
  if (counted.length === 0) return undefined
  const tokens = counted.reduce((sum, r) => sum + (r.tokens ?? 0), 0) / counted.length
  return { tokens: Math.round(tokens), runs: counted.length }
}

const fail = (name: string): never => {
  throw new Error(`Paramètre invalide : ${name}`)
}

const text = (value: unknown, name: string, max: number): string => {
  if (typeof value !== 'string') return fail(name)
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return fail(name)
  return trimmed
}

/** Fréquence lue d'un appel IPC ou du fichier : vérifiée. */
export function parseSchedule(value: unknown): Schedule {
  const s = value as Partial<Record<string, unknown>> | null
  if (typeof s !== 'object' || s === null) return fail('schedule')
  switch (s.kind) {
    case 'once':
      if (typeof s.at !== 'string' || !parseLocalDateTime(s.at)) return fail('schedule.at')
      return { kind: 'once', at: s.at }
    case 'daily':
    case 'weekdays':
      if (typeof s.time !== 'string' || !parseTime(s.time)) return fail('schedule.time')
      return { kind: s.kind, time: s.time }
    case 'interval':
      if (
        typeof s.hours !== 'number' ||
        !Number.isInteger(s.hours) ||
        s.hours < 1 ||
        s.hours > 24
      ) {
        return fail('schedule.hours')
      }
      return { kind: 'interval', hours: s.hours }
    default:
      return fail('schedule.kind')
  }
}

function parseCap(value: unknown): TaskCap | undefined {
  if (value === undefined || value === null) return undefined
  const c = value as Partial<Record<string, unknown>>
  const positive = (n: unknown, name: string) =>
    n === undefined
      ? undefined
      : typeof n === 'number' && Number.isFinite(n) && n > 0
        ? n
        : fail(name)
  const amount = positive(c.amount, 'cap.amount')
  const tokens = positive(c.tokens, 'cap.tokens')
  if (amount === undefined && tokens === undefined) return undefined
  return {
    ...(amount !== undefined ? { amount: Math.round(amount * 1e6) / 1e6 } : {}),
    ...(tokens !== undefined ? { tokens: Math.round(tokens) } : {})
  }
}

/** Saisie d'une tâche lue d'un appel IPC (ou du fichier) : vérifiée, nettoyée. */
export function parseTaskInput(value: unknown): ScheduledTaskInput {
  const v = value as Partial<Record<string, unknown>> | null
  if (typeof v !== 'object' || v === null) return fail('task')
  const instruction = text(v.instruction, 'instruction', 20_000)
  const name =
    typeof v.name === 'string' && v.name.trim() ? text(v.name, 'name', 200) : titleOf(instruction)
  const folder = text(v.folder, 'folder', 4096)
  if (!folder.startsWith('/')) return fail('folder')
  const cap = parseCap(v.cap)
  return {
    name,
    instruction,
    folder,
    profileId: text(v.profileId, 'profileId', 200),
    schedule: parseSchedule(v.schedule),
    worktree: v.worktree === true,
    catchUp: v.catchUp !== false,
    ...(cap ? { cap } : {})
  }
}

/** Nom d'une tâche sans nom : le début de sa consigne. */
export function titleOf(instruction: string): string {
  const line = instruction.trim().split('\n')[0] ?? ''
  return line.length > 60 ? `${line.slice(0, 59)}…` : line
}
