/**
 * Relevé de fin de lot e2e : processus encore vivants lancés par le lot, et charge de la machine.
 * Un relevé, pas un garde-fou : il ne fait jamais échouer le lot (diagnostic du lot anglais lent
 * sur le runner Mac de GitHub, 2026-11-25 : des processus survivent-ils au lot français ?).
 *
 * Un processus est « du lot » (raison dite dans le relevé) :
 * - `marque` : son environnement porte la marque du lot (`RUN_MARK`, posée par `e2e/run.mjs`
 *   avant tout lancement, héritée même par un orphelin rattaché à `launchd`). macOS ne montre pas
 *   l'environnement des binaires d'Apple (`sh`, `sleep`, `/usr/bin/git`) : d'où les suivants ;
 * - `groupe` : il est dans le groupe de processus du lanceur (un orphelin garde son groupe) ;
 * - `dépôt` : sa ligne de commande cite le dépôt (Electron, agent factice…) ;
 * - `dossier d’essai` : elle cite un dossier jetable des essais (`bob-e2e-`) ; peut aussi trouver
 *   les essais d'un autre dépôt lancés en même temps, d'où une raison à part ;
 * - `descendant` : enfant, ou membre du groupe, d'un processus déjà retenu (hors `dossier d’essai`).
 *
 * En ligne de commande (`node scripts/e2e-leftovers.mts`, `e2e.yml` entre le français et
 * l'anglais), sans lanceur : dépôt, dossiers jetables et descendants. Sortie toujours 0.
 */
import { execFileSync } from 'node:child_process'
import { availableParallelism, freemem, loadavg, totalmem } from 'node:os'
import { fileURLToPath } from 'node:url'

/** Variable d'environnement qui marque les processus d'un lot (sa valeur : l'identifiant du lot). */
export const RUN_MARK = 'BOBINE_E2E_RUN'
/** Préfixe des dossiers jetables des essais (`e2e/lib.mjs` : `bob-e2e-`, `bob-e2e-outils-`). */
export const TMP_PREFIX = 'bob-e2e-'
/** Longueur gardée d'une ligne de commande dans le relevé. */
export const COMMAND_WIDTH = 140

export interface PsRow {
  pid: number
  ppid: number
  /** Groupe de processus. */
  pgid: number
  /** Âge, tel que `ps` l'écrit (`[[jj-]hh:]mm:ss`). */
  elapsed: string
  cpu: number
  command: string
}

export type LeftoverWhy = 'marque' | 'groupe' | 'dépôt' | 'dossier d’essai' | 'descendant'

export interface Leftover {
  row: PsRow
  why: LeftoverWhy
}

/** Colonnes lues par `parsePs`. */
export const PS_COLUMNS = 'pid=,ppid=,pgid=,etime=,%cpu=,command='

/** Lit `ps -o pid=,ppid=,pgid=,etime=,%cpu=,command=` ; les lignes illisibles sont ignorées. */
export function parsePs(text: string): PsRow[] {
  const rows: PsRow[] = []
  for (const line of text.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\d.,]+)\s+(.*)$/.exec(line)
    const [, pid, ppid, pgid, elapsed, cpu, command] = m ?? []
    if (!pid || !ppid || !pgid || !elapsed || !cpu || command === undefined) continue
    rows.push({
      pid: Number(pid),
      ppid: Number(ppid),
      pgid: Number(pgid),
      elapsed,
      cpu: Number(cpu.replace(',', '.')),
      command: command.trim()
    })
  }
  return rows
}

/** Pids dont l'environnement (sortie de `ps` avec l'environnement) porte `mark=id`. */
export function markedPids(text: string, mark: string, id: string): Set<number> {
  const needle = `${mark}=${id}`
  const pids = new Set<number>()
  for (const line of text.split('\n')) {
    const m = /^\s*(\d+)\s/.exec(line)
    if (!m) continue
    // La valeur suivie d'un blanc ou de la fin : `…=12` ne prend pas `…=123`.
    const at = line.indexOf(needle)
    if (at < 0) continue
    const next = line[at + needle.length]
    if (next === undefined || /\s/.test(next)) pids.add(Number(m[1]))
  }
  return pids
}

/** Le processus `self` et ses ancêtres (le lanceur, pnpm, le shell) : jamais des restes. */
export function ancestry(rows: readonly PsRow[], self: number): Set<number> {
  const byPid = new Map(rows.map((r) => [r.pid, r]))
  const seen = new Set<number>()
  for (let pid: number | undefined = self; pid && !seen.has(pid); pid = byPid.get(pid)?.ppid) {
    seen.add(pid)
  }
  return seen
}

export interface PickOptions {
  marked: ReadonlySet<number>
  /** Dossier du dépôt (chemin absolu). */
  root: string
  /** Pid du lanceur : lui et ses ancêtres ne comptent jamais, le `ps` du relevé non plus. */
  self: number
  /** Groupe du lanceur (absent en ligne de commande : pas de lot à suivre). */
  group?: number
}

/** Raison directe (sans la parenté) de rattacher un processus au lot. */
function directWhy(row: PsRow, o: PickOptions): LeftoverWhy | undefined {
  if (o.marked.has(row.pid)) return 'marque'
  if (o.group !== undefined && o.group > 1 && row.pgid === o.group) return 'groupe'
  if (row.command.includes(o.root)) return 'dépôt'
  if (row.command.includes(`/${TMP_PREFIX}`)) return 'dossier d’essai'
  return undefined
}

/** Processus du lot encore vivants, avec la raison qui les rattache au lot. */
export function pickLeftovers(rows: readonly PsRow[], o: PickOptions): Leftover[] {
  const exclude = ancestry(rows, o.self)
  const candidates = rows.filter(
    (r) => !exclude.has(r.pid) && !(r.ppid === o.self && /^(\/bin\/)?ps\s/.test(r.command))
  )
  const why = new Map<number, LeftoverWhy>()
  for (const row of candidates) {
    const w = directWhy(row, o)
    if (w) why.set(row.pid, w)
  }
  // Parenté : enfants et membres du groupe d'un processus retenu, jusqu'au point fixe.
  for (let grew = true; grew;) {
    grew = false
    const kept = candidates.filter((r) => {
      const w = why.get(r.pid)
      return w !== undefined && w !== 'dossier d’essai'
    })
    const pids = new Set(kept.map((r) => r.pid))
    const groups = new Set(kept.map((r) => r.pgid).filter((g) => g > 1))
    for (const row of candidates) {
      if (why.has(row.pid)) continue
      if (pids.has(row.ppid) || groups.has(row.pgid)) {
        why.set(row.pid, 'descendant')
        grew = true
      }
    }
  }
  return candidates.flatMap((row) => {
    const w = why.get(row.pid)
    return w ? [{ row, why: w }] : []
  })
}

export interface LoadInfo {
  load: readonly number[]
  cores: number
  freeBytes: number
  totalBytes: number
}

const gib = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1)

/** Une ligne : charge moyenne (1, 5, 15 min), cœurs, mémoire libre. */
export function formatLoad(l: LoadInfo): string {
  const [a = 0, b = 0, c = 0] = l.load
  return `charge ${a.toFixed(2)} ${b.toFixed(2)} ${c.toFixed(2)} (1, 5, 15 min) · ${l.cores} cœurs · mémoire libre ${gib(l.freeBytes)} / ${gib(l.totalBytes)} Gio`
}

/** Le relevé, prêt à écrire (dépôt raccourci en `.`, commandes tronquées). */
export function formatLeftovers(items: readonly Leftover[], root: string): string[] {
  if (!items.length) return ['aucun processus restant']
  const lines = [`${items.length} processus restant(s) (pid · âge · %CPU · raison · commande) :`]
  for (const { row, why } of items) {
    const command = row.command.split(root).join('.')
    const cut = command.length > COMMAND_WIDTH ? `${command.slice(0, COMMAND_WIDTH - 1)}…` : command
    lines.push(`  ${row.pid} · ${row.elapsed} · ${row.cpu.toFixed(1)} % · ${why} · ${cut}`)
  }
  return lines
}

/** `ps` avec l'environnement : `-E` sur macOS, `e` (BSD) avec procps sous Linux. */
function psWithEnv(platform: NodeJS.Platform): string[] {
  return platform === 'darwin' ? ['-axwwE', '-o', 'pid=,command='] : ['axwwe', '-o', 'pid=,args=']
}

export interface SnapshotOptions {
  root: string
  /** Identifiant du lot (valeur de `RUN_MARK`) ; absent : ni marque ni groupe du lanceur. */
  runId?: string
  platform?: NodeJS.Platform
}

/** Un relevé maintenant ; `undefined` si `ps` n'est pas lisible (Windows, `ps` absent…). */
export function snapshotLeftovers(o: SnapshotOptions): Leftover[] | undefined {
  const platform = o.platform ?? process.platform
  if (platform === 'win32') return undefined
  try {
    const rows = parsePs(
      execFileSync('ps', ['-axww', '-o', PS_COLUMNS], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024
      })
    )
    let marked = new Set<number>()
    if (o.runId) {
      try {
        marked = markedPids(
          execFileSync('ps', psWithEnv(platform), {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024
          }),
          RUN_MARK,
          o.runId
        )
      } catch {
        // Environnement illisible : dépôt et dossiers jetables seulement.
      }
    }
    const self = rows.find((r) => r.pid === process.pid)
    return pickLeftovers(rows, {
      marked,
      root: o.root,
      self: process.pid,
      group: o.runId ? self?.pgid : undefined
    })
  } catch {
    return undefined
  }
}

export const loadNow = (): LoadInfo => ({
  load: loadavg(),
  cores: availableParallelism(),
  freeBytes: freemem(),
  totalBytes: totalmem()
})

/**
 * Le relevé complet (lignes à écrire). Un reste vu tout de suite est revu `recheckMs` plus tard :
 * un processus qui finissait de sortir (crashpad, rendu de Chromium) n'est pas un survivant.
 */
export async function leftoverReport(
  o: SnapshotOptions & { recheckMs?: number; title?: string }
): Promise<string[]> {
  const recheck = o.recheckMs ?? 3000
  let items = snapshotLeftovers(o)
  let waited = false
  if (items?.length && recheck > 0) {
    await new Promise((r) => setTimeout(r, recheck))
    items = snapshotLeftovers(o)
    waited = true
  }
  const head = `${o.title ?? 'Relevé de fin de lot'}${waited ? ` (revu après ${recheck / 1000} s)` : ''} : ${formatLoad(loadNow())}`
  if (!items) return [head, 'processus : relevé indisponible sur ce système']
  return [head, ...formatLeftovers(items, o.root)]
}

// En ligne de commande : relevé sans marque (entre deux étapes de `e2e.yml`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')
  for (const line of await leftoverReport({
    root,
    recheckMs: 0,
    title: 'Relevé entre deux lots'
  })) {
    console.log(line)
  }
}
