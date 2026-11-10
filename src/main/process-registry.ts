/**
 * Registre des processus enfants (fiche 138) : `<données>/agents.pids`. Les agents, sondes MCP et
 * serveurs de développement sont lancés dans leur propre groupe (`detached`) : un plantage du main
 * les laisse vivants. Le registre les note au lancement (pid, groupe, commande, heure) et les retire
 * quand leur groupe est vide ; au démarrage suivant, ceux qui vivent encore sont arrêtés, seulement
 * si `ps` confirme que c'est bien le même processus (un pid réattribué n'est jamais touché).
 * N'importe pas `electron`.
 */
import { execFile, execFileSync, type ChildProcess } from 'node:child_process'
import { basename } from 'node:path'
import { messageOf } from '@shared/errors'
import { log } from './log'
import {
  groupAlive,
  STOP_GRACE_MS,
  stoppingGroups,
  terminateGroup,
  terminateLeftovers
} from './process-group'
import { readJson, writeFileAtomic } from './storage'

export const PIDS_FILE = 'agents.pids'

/** Un processus lancé par l'app, chef de son groupe. */
export interface ChildEntry {
  pid: number
  pgid: number
  /** Programme puis arguments, tels que donnés à `spawn`. */
  command: string[]
  /** Heure du lancement (ISO). */
  startedAt: string
}

/** Écart toléré entre l'heure notée et l'heure de départ lue par `ps` (à la seconde près). */
const START_TOLERANCE_MS = 3000

export class ProcessRegistry {
  private readonly entries = new Map<number, ChildEntry>()
  private readonly file: string
  private readonly now: () => Date

  constructor(file: string, now: () => Date = () => new Date()) {
    this.file = file
    this.now = now
  }

  list(): ChildEntry[] {
    return [...this.entries.values()]
  }

  /** Note un processus qui vient d'être lancé ; il sort du registre quand son groupe est vide. */
  track(child: ChildProcess, command: string[]): void {
    const pid = child.pid
    if (pid === undefined) return // Lancement raté : rien à suivre.
    this.entries.set(pid, { pid, pgid: pid, command, startedAt: this.now().toISOString() })
    this.save()
    child.once('exit', () => this.release(pid, true))
  }

  /** Entrée retirée (groupe vide, ou identifiant repris par d'autres). */
  forget(pid: number): void {
    if (this.entries.delete(pid)) this.save()
  }

  /** Le chef est sorti : retiré si son groupe est vide, sinon revu après le délai d'arrêt. */
  private release(pid: number, retry: boolean): void {
    if (!groupAlive(pid)) {
      if (this.entries.delete(pid)) this.save()
      return
    }
    // Des descendants vivent encore (SIGKILL à venir, ou orphelins) : l'entrée reste s'ils
    // survivent, pour le prochain démarrage.
    if (retry) setTimeout(() => this.release(pid, false), STOP_GRACE_MS + 500).unref()
  }

  save(): void {
    try {
      writeFileAtomic(this.file, `${JSON.stringify({ version: 1, processes: this.list() })}\n`)
    } catch (error) {
      log.warn(`Registre des processus (${this.file}) non écrit : ${messageOf(error)}`)
    }
  }
}

/** Entrées valides d'un registre ; un fichier absent ou illisible n'en a aucune. */
export function readEntries(file: string): ChildEntry[] {
  const read = readJson(file)
  if (!read.ok) return []
  const processes = (read.value as { processes?: unknown } | null)?.processes
  if (!Array.isArray(processes)) return []
  return processes.filter(
    (p): p is ChildEntry =>
      typeof p === 'object' &&
      p !== null &&
      Number.isInteger(p.pid) &&
      p.pid > 1 &&
      Number.isInteger(p.pgid) &&
      p.pgid > 1 &&
      Array.isArray(p.command) &&
      p.command.length > 0 &&
      p.command.every((part: unknown) => typeof part === 'string') &&
      typeof p.startedAt === 'string' &&
      !Number.isNaN(Date.parse(p.startedAt))
  )
}

let current: ProcessRegistry | undefined

/**
 * Ouvre le registre de ce lancement (avant tout `spawn`) : rend les entrées laissées par le
 * précédent et repart d'un registre vide.
 */
export function openProcessRegistry(file: string): ChildEntry[] {
  const previous = readEntries(file)
  current = new ProcessRegistry(file)
  current.save()
  return previous
}

/** Registre fermé (essais) : `trackChild` ne fait plus rien. */
export function closeProcessRegistry(): void {
  current = undefined
}

/** Note un processus lancé dans son propre groupe ; rien sans registre ouvert (essais, sondes). */
export function trackChild(child: ChildProcess, command: string[]): void {
  current?.track(child, command)
}

/** Une ligne de `ps`. */
export interface PsRow {
  pid: number
  ppid: number
  pgid: number
  /** Heure de départ, en millisecondes (à la seconde près). */
  startedAt: number
  command: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PS_LINE =
  /^\s*(\d+)\s+(\d+)\s+(\d+)\s+\w{3}\s+(\w{3})\s+(\d+)\s+(\d+):(\d+):(\d+)\s+(\d{4})\s+(.*)$/

/** Sortie de `ps -A -ww -o pid=,ppid=,pgid=,lstart=,command=` (avec `LC_ALL=C`). */
export function parsePs(output: string): PsRow[] {
  const rows: PsRow[] = []
  for (const line of output.split('\n')) {
    const m = PS_LINE.exec(line)
    if (!m) continue
    const month = MONTHS.indexOf(m[4] ?? '')
    if (month === -1) continue
    const n = (i: number) => Number(m[i])
    rows.push({
      pid: n(1),
      ppid: n(2),
      pgid: n(3),
      startedAt: new Date(n(9), month, n(5), n(6), n(7), n(8)).getTime(),
      command: m[10] ?? ''
    })
  }
  return rows
}

/**
 * La ligne de commande lue par `ps` est-elle celle lancée ? Nom du programme puis arguments, dans
 * l'ordre : un script lancé par son interpréteur (`node /…/bob acp`) correspond à `bob acp`.
 */
export function sameCommand(psCommand: string, command: string[]): boolean {
  const [program = '', ...args] = command
  let from = 0
  for (const part of [basename(program), ...args]) {
    const at = psCommand.indexOf(part, from)
    if (at === -1) return false
    from = at + part.length
  }
  return true
}

export interface OrphanVerdict {
  /** Groupes à arrêter, et ce qui a été reconnu. */
  stop: Array<{ entry: ChildEntry; members: PsRow[] }>
  /** Entrées vivantes laissées de côté, et pourquoi. */
  skipped: Array<{ entry: ChildEntry; reason: string }>
}

/**
 * Quels groupes du lancement précédent arrêter (fonction pure). Chef retrouvé : même groupe, même
 * commande, même heure de départ, sinon c'est un pid réattribué. Chef disparu : le groupe n'est
 * arrêté que si tous ses membres sont partis après lui et que l'un d'eux a été adopté par `launchd`
 * (ppid 1), signe d'un orphelin et non d'un autre groupe qui aurait repris l'identifiant.
 */
export function orphanGroups(
  entries: ChildEntry[],
  rows: PsRow[],
  self: number = process.pid
): OrphanVerdict {
  const verdict: OrphanVerdict = { stop: [], skipped: [] }
  const ownGroup = rows.find((r) => r.pid === self)?.pgid
  for (const entry of entries) {
    if (entry.pid === self || entry.pgid === self || entry.pgid === ownGroup) continue
    const started = Date.parse(entry.startedAt)
    const members = rows.filter((r) => r.pgid === entry.pgid)
    const leader = rows.find((r) => r.pid === entry.pid)
    if (leader) {
      const reason =
        leader.pgid !== entry.pgid
          ? 'autre groupe'
          : !sameCommand(leader.command, entry.command)
            ? 'autre commande'
            : Math.abs(leader.startedAt - started) > START_TOLERANCE_MS
              ? 'autre heure de départ'
              : undefined
      if (reason) verdict.skipped.push({ entry, reason: `pid réattribué (${reason})` })
      else verdict.stop.push({ entry, members })
      continue
    }
    if (members.length === 0) continue // Parti de lui-même.
    const afterLeader = members.every((r) => r.startedAt >= started - START_TOLERANCE_MS)
    if (afterLeader && members.some((r) => r.ppid === 1)) verdict.stop.push({ entry, members })
    else verdict.skipped.push({ entry, reason: 'groupe repris par d’autres processus' })
  }
  return verdict
}

/** Processus de la machine, pour `orphanGroups`. */
export function listProcesses(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'ps',
      ['-A', '-ww', '-o', 'pid=,ppid=,pgid=,lstart=,command='],
      { env: { ...process.env, LC_ALL: 'C' }, maxBuffer: 16 * 1024 * 1024, timeout: 10_000 },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    )
  })
}

/** Processus de la machine, lus tout de suite (en quittant, plus de boucle d'évènements à attendre). */
export function listProcessesSync(): string {
  return execFileSync('ps', ['-A', '-ww', '-o', 'pid=,ppid=,pgid=,lstart=,command='], {
    env: { ...process.env, LC_ALL: 'C' },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 5_000
  })
}

export interface QuitStopDeps {
  ps: () => string
  terminate: (pgid: number) => boolean
  log: (line: string) => void
}

/**
 * En quittant (fiche 208) : les groupes lancés par ce lancement et encore vivants sont arrêtés
 * (SIGTERM, puis SIGKILL ; `will-quit` attend, fiche 195). Filet commun à ce qu'aucun arrêt propre
 * n'a visé : essai du diagnostic, liste ou suppression de sessions, sonde MCP en cours.
 *
 * Une entrée peut rester longtemps au registre (descendants vivants à la sortie du chef, partis
 * plus tard) : son identifiant de groupe a pu être repris par d'autres processus. Chaque entrée est
 * donc vérifiée par `ps` comme au démarrage (`orphanGroups` : même commande, même heure de départ),
 * en un seul appel ; `ps` en échec : rien n'est arrêté. Groupes vides ou repris : retirés du
 * registre. Ceux déjà en cours d'arrêt sont laissés. Rend le nombre de groupes arrêtés.
 */
export function stopTrackedChildren(
  deps: QuitStopDeps = {
    ps: listProcessesSync,
    terminate: (pgid) => terminateLeftovers(pgid),
    log: (line) => log.info(line)
  }
): number {
  const registry = current
  if (!registry) return 0
  const stopping = new Set(stoppingGroups())
  const entries = registry.list().filter((entry) => !stopping.has(entry.pgid))
  if (entries.length === 0) return 0
  let rows: PsRow[]
  try {
    rows = parsePs(deps.ps())
  } catch (error) {
    deps.log(`En quittant : processus lancés non vérifiés, aucun arrêté (ps : ${messageOf(error)})`)
    return 0
  }
  const verdict = orphanGroups(entries, rows)
  const kept = new Set(verdict.stop.map(({ entry }) => entry.pid))
  for (const entry of entries) if (!kept.has(entry.pid)) registry.forget(entry.pid)
  for (const { entry, reason } of verdict.skipped) {
    deps.log(`En quittant : ${describe(entry)} laissé — ${reason}`)
  }
  let stopped = 0
  for (const { entry } of verdict.stop) {
    if (deps.terminate(entry.pgid)) stopped++
  }
  if (stopped > 0)
    deps.log(`En quittant : ${stopped} groupe(s) de processus encore actif(s) arrêté(s)`)
  return stopped
}

export interface ReapDeps {
  ps: () => Promise<string>
  terminate: (pgid: number) => boolean
  log: (line: string) => void
}

const describe = (entry: ChildEntry) =>
  `${entry.command.join(' ')} (pid ${entry.pid}, lancé le ${entry.startedAt})`

/**
 * Arrête les groupes restés vivants du lancement précédent (SIGTERM, puis SIGKILL au bout de 3 s)
 * et dit dans le journal ce qui a été fait. Ne lève jamais.
 */
export async function reapOrphans(
  entries: ChildEntry[],
  deps: ReapDeps = {
    ps: listProcesses,
    terminate: (pgid) => terminateGroup(pgid),
    log: (line) => log.info(line)
  }
): Promise<OrphanVerdict> {
  const none: OrphanVerdict = { stop: [], skipped: [] }
  if (entries.length === 0) return none
  let rows: PsRow[]
  try {
    rows = parsePs(await deps.ps())
  } catch (error) {
    deps.log(`Processus du lancement précédent non vérifiés (ps : ${messageOf(error)})`)
    return none
  }
  const verdict = orphanGroups(entries, rows)
  for (const { entry, members } of verdict.stop) {
    const stopped = deps.terminate(entry.pgid)
    deps.log(
      stopped
        ? `Processus resté du lancement précédent arrêté : ${describe(entry)}, ${members.length} processus dans son groupe`
        : `Processus resté du lancement précédent déjà parti : ${describe(entry)}`
    )
  }
  for (const { entry, reason } of verdict.skipped) {
    deps.log(`Processus du lancement précédent laissé : ${describe(entry)} — ${reason}`)
  }
  return verdict
}
