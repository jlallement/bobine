/**
 * Arbres de processus sous Windows (fiche 229, ADR-0050, D9) : pas de groupes ni de signaux.
 * Chaque processus lancé par l'app est placé, dès que `spawn` rend son pid, dans **son** objet de
 * tâche (`KILL_ON_JOB_CLOSE`, sans sortie autorisée) : arrêter l'arbre, c'est fermer le job, et le
 * noyau le ferme si le main plante. Sans objets de tâche (`JobApi` absente : bibliothèque non
 * chargée), repli : `taskkill /T /F` et le job de libuv (enfants directs tués si le main plante).
 * Arrêt « poli » d'abord : l'entrée standard fermée (un agent ACP sort à la fin de son flux), puis
 * l'arbre arrêté au bout du délai de grâce, comme SIGTERM puis SIGKILL sous Unix (fiche 138).
 * Tout ce qui touche la machine est injecté : essayé sur le Mac avec des faux, puis dans la VM.
 * N'importe pas `electron`.
 */
import type { ChildProcess } from 'node:child_process'

/** Objet de tâche ouvert par l'app (poignée opaque). */
export type JobHandle = object

/** Appels Win32 des objets de tâche (`koffi` en vrai, faux en essai). */
export interface JobApi {
  /** Nouveau job `KILL_ON_JOB_CLOSE`, sans `BREAKAWAY_OK` ni `SILENT_BREAKAWAY_OK`. */
  create(): JobHandle
  /** Place le processus dans le job ; faux si c'est impossible (déjà sorti, refusé). */
  assign(job: JobHandle, pid: number): boolean
  /** Processus encore dans le job. */
  active(job: JobHandle): number
  /** Arrête tout le job (`TerminateJobObject`). */
  terminate(job: JobHandle): void
  /** Ferme la poignée (avec `KILL_ON_JOB_CLOSE`, arrête ce qui y reste). */
  close(job: JobHandle): void
}

export interface WindowsTreeDeps {
  /** Absente : repli `taskkill`. */
  jobs?: JobApi
  /** `taskkill /T /F /PID <pid>` ; `sync` en quittant (plus de boucle d'évènements). */
  taskkill: (pid: number, sync: boolean) => void
  log: (line: string) => void
  graceMs: number
}

interface Tree {
  child: ChildProcess
  job?: JobHandle
  stopping?: true
  timer?: NodeJS.Timeout
  /** Arbre déjà arrêté : sa poignée est fermée, et Windows peut en redonner la valeur. */
  finished?: true
}

const exited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null

export class WindowsTrees {
  private readonly trees = new Map<ChildProcess, Tree>()
  private readonly deps: WindowsTreeDeps

  constructor(deps: WindowsTreeDeps) {
    this.deps = deps
  }

  /** Mode d'arrêt, pour le journal et le Diagnostic. */
  get mode(): 'jobs' | 'taskkill' {
    return this.deps.jobs ? 'jobs' : 'taskkill'
  }

  /** À appeler juste après `spawn`, sans `await` entre les deux (course avec les petits-enfants). */
  adopt(child: ChildProcess): void {
    if (child.pid === undefined) return // Lancement raté.
    const tree: Tree = { child }
    const jobs = this.deps.jobs
    if (jobs) {
      try {
        const job = jobs.create()
        if (jobs.assign(job, child.pid)) tree.job = job
        else jobs.close(job)
      } catch (error) {
        this.deps.log(`Objet de tâche non posé (pid ${child.pid}) : ${String(error)}`)
      }
    }
    this.trees.set(child, tree)
    child.once('exit', () => this.leaderExited(tree))
  }

  /** Le chef est sorti : ce qui reste est arrêté s'il était en cours d'arrêt, sinon laissé. */
  private leaderExited(tree: Tree): void {
    if (tree.timer) clearTimeout(tree.timer)
    if (tree.finished) return
    if (tree.stopping) return this.finish(tree, false)
    const jobs = this.deps.jobs
    // Rien ne reste : la poignée est rendue. Sinon le job reste ouvert (descendants encore au
    // travail, comme un groupe Unix) jusqu'à un arrêt ou la sortie de l'app.
    if (tree.job && jobs && jobs.active(tree.job) === 0) {
      jobs.close(tree.job)
      this.trees.delete(tree.child)
    } else if (!tree.job) {
      this.trees.delete(tree.child)
    }
  }

  /**
   * Arrête l'arbre de force, maintenant, **une seule fois** : une poignée fermée peut être redonnée
   * par Windows au job d'un processus lancé ensuite ; la terminer une seconde fois (à la sortie du
   * chef, après le délai de grâce ou un arrêt sans entrée standard) tuait ce processus-là (relevé
   * dans la VM, fiche 229, lot 7a : agents arrêtés 3 ms après leur lancement).
   */
  private finish(tree: Tree, sync: boolean): void {
    if (tree.timer) clearTimeout(tree.timer)
    if (tree.finished) return
    tree.finished = true
    this.trees.delete(tree.child)
    const { jobs } = this.deps
    if (tree.job && jobs) {
      jobs.terminate(tree.job)
      jobs.close(tree.job)
      return
    }
    // Repli : par les parents, tant que le chef vit (un pid sorti peut être réattribué).
    const pid = tree.child.pid
    if (pid !== undefined && !exited(tree.child)) {
      try {
        this.deps.taskkill(pid, sync)
      } catch {
        tree.child.kill()
      }
    }
  }

  /**
   * Arrête un processus lancé par l'app et son arbre : entrée standard fermée, puis l'arbre au bout
   * de `graceMs` (tout de suite pour un processus sans entrée standard, qui n'a pas d'arrêt poli).
   * Déjà sorti : ce qui reste de son job est arrêté.
   */
  stop(child: ChildProcess, graceMs = this.deps.graceMs): void {
    const tree = this.trees.get(child)
    if (!tree) {
      if (!exited(child)) child.kill()
      return
    }
    if (exited(child)) return this.finish(tree, false)
    if (tree.stopping) return
    tree.stopping = true
    const stdin = child.stdin
    if (!stdin || stdin.destroyed || graceMs <= 0) return this.finish(tree, false)
    stdin.end()
    tree.timer = setTimeout(() => this.finish(tree, false), graceMs)
    tree.timer.unref()
  }

  /** Arbres en cours d'arrêt dont le chef vit encore. */
  stopping(): number {
    return [...this.trees.values()].filter((t) => t.stopping && !exited(t.child)).length
  }

  /**
   * En quittant : attend au plus `waitMs` les arbres en cours d'arrêt, puis arrête de force ceux
   * qui vivent encore. Rend leur nombre.
   */
  async settle(waitMs = 1500, stepMs = 50): Promise<number> {
    const deadline = Date.now() + waitMs
    while (this.stopping() > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, stepMs))
    }
    const alive = [...this.trees.values()].filter((t) => t.stopping)
    for (const tree of alive) this.finish(tree, true)
    return alive.filter((t) => !exited(t.child)).length
  }

  /** En quittant (fiche 208) : tout ce qui reste, arrêté de force. Rend le nombre d'arbres. */
  stopAll(): number {
    const remaining = [...this.trees.values()]
    for (const tree of remaining) this.finish(tree, true)
    if (remaining.length > 0) {
      this.deps.log(`En quittant : ${remaining.length} arbre(s) de processus arrêté(s)`)
    }
    return remaining.length
  }
}

/** Un processus de la machine, lu par `Win32_Process`. */
export interface WinProcessRow {
  pid: number
  ppid: number
  /** Heure de création, en millisecondes. */
  startedAt: number
  command: string
}

/**
 * Sortie JSON de `Get-CimInstance Win32_Process` (script `WIN32_PROCESS_SCRIPT`) : un objet seul
 * ou une liste ; lignes incomplètes ignorées. Lève si ce n'est pas du JSON.
 */
export function parseWin32Processes(output: string): WinProcessRow[] {
  const text = output.trim()
  if (!text) return []
  const data = JSON.parse(text) as unknown
  const rows = Array.isArray(data) ? data : [data]
  const out: WinProcessRow[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const pid = Number(r['ProcessId'])
    const ppid = Number(r['ParentProcessId'])
    const startedAt = typeof r['Start'] === 'string' ? Date.parse(r['Start']) : NaN
    if (!Number.isInteger(pid) || !Number.isInteger(ppid) || Number.isNaN(startedAt)) continue
    out.push({
      pid,
      ppid,
      startedAt,
      command: typeof r['CommandLine'] === 'string' ? r['CommandLine'] : ''
    })
  }
  return out
}

/**
 * Script PowerShell (constant, sans donnée extérieure) qui liste les processus : pid, parent,
 * heure de création en UTC (ISO), ligne de commande ; sortie en UTF-8.
 */
export const WIN32_PROCESS_SCRIPT =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' +
  'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,' +
  "@{n='Start';e={$_.CreationDate.ToUniversalTime().ToString('o')}},CommandLine" +
  ' | ConvertTo-Json -Compress'
