/**
 * Quota de bobcoins de Bob (fiche 091, ADR-0017), lu par la commande `/status` de Bob Shell.
 *
 * Bob 2.0.6 ne transmet ni son plafond ni sa consommation par ACP, et ne les garde pas en local : sa
 * commande `/status` (`bob chat`) les demande à son serveur et les affiche (« Monthly Budget »,
 * « Monthly Usage »). On lance donc `bob chat` dans un pseudo-terminal, on tape `/status`, on relit
 * l'écran (`@xterm/headless`), puis on quitte. `bob chat` crée une tâche vide à son lancement : son
 * identifiant (« Task ID ») et les tâches vides du dossier réservé sont rendus pour suppression.
 * Écran fait pour un humain : la moindre surprise donne « quota inconnu », jamais un faux chiffre.
 */
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { Terminal } from '@xterm/headless'
import type { Pty } from '../terminal/terminal-manager'
import type { QuotaContext, QuotaReading, QuotaSource } from './adapters'
import { BOB_DB } from './bob-costs'

/** `bob chat` sans serveurs MCP ni sous-agents (rien d'autre de lancé), dans un dossier approuvé. */
export const BOB_STATUS_ARGS = ['chat', '--trust', '--disable-mcp', '--disable-subagents']

const SIZE = { cols: 120, rows: 50 }
/** Silence après lequel l'interface de Bob est prête à recevoir `/status`. */
const QUIET_MS = 1500
/** Sans réponse après ce délai, `/status` est retapé (frappe perdue pendant le démarrage). */
const RETYPE_MS = 8000
const POLL_MS = 200
/** Entre la commande et Entrée : le temps que Bob affiche ses suggestions. */
const ENTER_DELAY_MS = 500

/** Libellés de `/status` : anglais forcé par `LC_ALL`, français accepté si Bob l'impose. */
const LABELS = {
  taskId: ['Task ID:', 'ID de tâche :'],
  budget: ['Monthly Budget:', 'Budget mensuel :'],
  usage: ['Monthly Usage:', 'Utilisation mensuelle :'],
  unlimited: ['Unlimited', 'Illimité']
}

export interface BobStatus {
  taskId?: string
  /** Plafond ; `null` : illimité ; absent : pas encore lu (« Fetching budget... »). */
  limit?: number | null
  used?: number
  /** Le panneau est là, mais Bob n'a pas pu lire son budget (« — »). */
  unavailable?: boolean
}

export interface BobStatusOptions {
  command?: string
  args?: string[]
  /** Base de Bob, pour retrouver les tâches vides du dossier réservé. */
  dbPath?: string
  /** Délais, raccourcis par les tests. */
  timings?: Partial<typeof DEFAULT_TIMINGS>
}

const DEFAULT_TIMINGS = {
  quietMs: QUIET_MS,
  retypeMs: RETYPE_MS,
  pollMs: POLL_MS,
  enterDelayMs: ENTER_DELAY_MS
}

/** Quota de Bob tel que son profil le déclare (`quotaSource`, ADR-0015), en bobcoins. */
export function bobStatusQuota(options: BobStatusOptions = {}): QuotaSource {
  const command = options.command ?? 'bob'
  const args = options.args ?? BOB_STATUS_ARGS
  const dbPath = options.dbPath ?? BOB_DB
  const timings = { ...DEFAULT_TIMINGS, ...options.timings }
  return {
    id: 'bob-status',
    currency: 'bobcoins',
    read: async (context) => {
      const run = await readStatus(command, args, context, timings)
      const leftovers = new Set(emptyTasksIn(context.cwd, dbPath))
      if (run.status.taskId) leftovers.add(run.status.taskId)
      const { limit, used } = run.status
      const reading: QuotaReading = { leftovers: [...leftovers] }
      if (limit !== undefined && used !== undefined) reading.quota = { limit, used }
      else reading.problem = run.problem ?? 'chiffres absents de /status'
      return reading
    }
  }
}

/** Plafond, consommation et tâche, d'après le texte de l'écran (dernier panneau affiché). */
export function parseBobStatus(screen: string): BobStatus {
  const status: BobStatus = {}
  const taskId = lastValue(screen, LABELS.taskId)
  if (taskId && /^[0-9a-f]{16,64}$/i.test(taskId)) status.taskId = taskId
  const budget = lastValue(screen, LABELS.budget)
  const usage = lastValue(screen, LABELS.usage)
  if (budget !== undefined) {
    if (LABELS.unlimited.some((word) => budget.startsWith(word))) status.limit = null
    else {
      const limit = amount(budget)
      if (limit !== undefined) status.limit = limit
    }
  }
  const used = usage === undefined ? undefined : amount(usage)
  if (used !== undefined) status.used = used
  if (budget?.startsWith('—') || usage?.startsWith('—')) status.unavailable = true
  return status
}

/** Valeur qui suit la dernière occurrence d'un des libellés, jusqu'à la fin de la ligne. */
function lastValue(screen: string, labels: string[]): string | undefined {
  let found: { index: number; value: string } | undefined
  for (const label of labels) {
    const index = screen.lastIndexOf(label)
    if (index === -1 || (found && found.index > index)) continue
    const end = screen.indexOf('\n', index)
    found = {
      index,
      value: screen.slice(index + label.length, end === -1 ? undefined : end).trim()
    }
  }
  return found?.value
}

/** « 1000.00 🅞 » → 1000 (Bob écrit deux décimales) ; « Fetching budget... » → `undefined`. */
function amount(text: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(?:\s|$)/.exec(text)
  if (!match?.[1]) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

interface StatusRun {
  status: BobStatus
  problem?: string
}

/** Lance `bob chat`, tape `/status` une fois l'interface prête, attend les chiffres, quitte. */
function readStatus(
  command: string,
  args: string[],
  context: QuotaContext,
  timings: typeof DEFAULT_TIMINGS
): Promise<StatusRun> {
  return new Promise((resolve) => {
    const screen = new Terminal({ ...SIZE, scrollback: 1000, allowProposedApi: true })
    let pty: Pty
    try {
      pty = context.spawnPty(command, args, {
        ...SIZE,
        cwd: context.cwd,
        // Libellés et nombres en anglais, quelle que soit la langue du Mac.
        env: { ...context.env, LC_ALL: 'en_US.UTF-8', TERM: 'xterm-256color' }
      })
    } catch (error) {
      screen.dispose()
      resolve({ status: {}, problem: `lancement de ${command} : ${(error as Error).message}` })
      return
    }
    const started = Date.now()
    let lastData = started
    let received = false
    let exited = false
    let askedAt: number | undefined
    let enter: ReturnType<typeof setTimeout> | undefined
    pty.onData((data) => {
      received = true
      lastData = Date.now()
      screen.write(data)
    })
    pty.onExit(() => (exited = true))
    const finish = (run: StatusRun) => {
      clearInterval(timer)
      clearTimeout(enter)
      context.signal?.removeEventListener('abort', abort)
      try {
        pty.kill()
      } catch {
        // Déjà arrêté.
      }
      screen.dispose()
      resolve(run)
    }
    // L'app quitte (fiche 208) : `bob chat` est fermé tout de suite, sans attendre les chiffres.
    const abort = () => finish({ status: {}, problem: 'lecture arrêtée (l’app quitte)' })
    const timer = setInterval(() => {
      const now = Date.now()
      const status = parseBobStatus(screenText(screen))
      if (status.limit !== undefined && status.used !== undefined) return finish({ status })
      if (status.unavailable) return finish({ status, problem: 'budget indisponible (« — »)' })
      if (exited) return finish({ status, problem: `${command} s’est arrêté` })
      if (now - started > context.timeoutMs) {
        const problem = askedAt === undefined ? 'interface jamais prête' : 'pas de chiffres'
        return finish({ status, problem: `${problem} après ${context.timeoutMs} ms` })
      }
      const ready = received && now - lastData >= timings.quietMs
      const retype = askedAt !== undefined && !status.taskId && now - askedAt >= timings.retypeMs
      if (ready && (askedAt === undefined || retype)) {
        askedAt = now
        pty.write('/status')
        enter = setTimeout(() => pty.write('\r'), timings.enterDelayMs)
      }
    }, timings.pollMs)
    if (context.signal?.aborted) abort()
    else context.signal?.addEventListener('abort', abort, { once: true })
  })
}

/** Texte de l'écran et de l'historique du terminal, ligne par ligne. */
function screenText(screen: Terminal): string {
  const buffer = screen.buffer.active
  const lines: string[] = []
  for (let i = 0; i < buffer.length; i++)
    lines.push(buffer.getLine(i)?.translateToString(true) ?? '')
  return lines.join('\n')
}

/**
 * Tâches vides (aucun message) que Bob a enregistrées dans ce dossier : seule la lecture du quota
 * y travaille. Base de Bob en lecture seule ; la moindre surprise : aucune.
 */
export function emptyTasksIn(folder: string, dbPath = BOB_DB): string[] {
  if (!existsSync(dbPath)) return []
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    const rows = db
      .prepare(
        `SELECT id FROM tasks
         WHERE json_extract(env, '$.workspace') = ?
           AND (first_message IS NULL OR first_message = '')`
      )
      .all(folder) as { id?: unknown }[]
    return rows.flatMap((row) =>
      typeof row.id === 'string' && /^[\w-]+$/.test(row.id) ? [row.id] : []
    )
  } catch {
    return []
  } finally {
    try {
      db?.close()
    } catch {
      // Déjà fermée : rien à faire.
    }
  }
}
