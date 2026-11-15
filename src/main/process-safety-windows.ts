/**
 * Sûreté des processus sous Windows (fiche 229, ADR-0050), chargée par `process-safety.ts` sous
 * Windows seulement : arbres par objets de tâche (`koffi`), repli `taskkill` s'il ne se charge pas,
 * processus du lancement précédent relus par `Win32_Process`.
 */
import { execFile, execFileSync } from 'node:child_process'
import { win32 } from 'node:path'
import { messageOf } from '@shared/errors'
import { loadJobApi } from './job-api-koffi'
import { log } from './log'
import { STOP_GRACE_MS } from './process-group'
import { envValue, windowsPowerShell } from './process-launch'
import type { ChildEntry } from './process-registry'
import { listWin32Processes, reapOrphansWindows } from './process-registry-windows'
import { configureProcessTrees } from './process-tree'
import { WindowsTrees, type JobApi } from './process-tree-windows'

/** `taskkill /T /F /PID` : l'arbre par les parents, de force (repli sans objets de tâche). */
function taskkill(env: NodeJS.ProcessEnv): (pid: number, sync: boolean) => void {
  const root = envValue(env, 'SystemRoot', 'windows')
  const file = root ? win32.join(root, 'System32', 'taskkill.exe') : 'taskkill.exe'
  return (pid, sync) => {
    const args = ['/T', '/F', '/PID', String(pid)]
    if (sync) execFileSync(file, args, { windowsHide: true, stdio: 'ignore', timeout: 5000 })
    else execFile(file, args, { windowsHide: true, timeout: 5000 }, () => {})
  }
}

/** Objets de tâche ; `undefined` : repli taskkill, dit au journal. */
function windowsJobs(load: () => JobApi): JobApi | undefined {
  try {
    return load()
  } catch (error) {
    log.warn(`Objets de tâche indisponibles (koffi : ${messageOf(error)})`)
    return undefined
  }
}

/** Arbres de Windows de l'app : objets de tâche, sinon repli `taskkill`. Aussi ceux des essais. */
export function createWindowsTrees(
  env: NodeJS.ProcessEnv = process.env,
  loadJobs: () => JobApi = loadJobApi
): WindowsTrees {
  return new WindowsTrees({
    jobs: windowsJobs(loadJobs),
    taskkill: taskkill(env),
    log: (line) => log.info(line),
    graceMs: STOP_GRACE_MS
  })
}

export function setupWindowsProcesses(
  previous: ChildEntry[],
  env: NodeJS.ProcessEnv = process.env,
  loadJobs: () => JobApi = loadJobApi
): void {
  const kill = taskkill(env)
  const trees = createWindowsTrees(env, loadJobs)
  configureProcessTrees(trees)
  log.info(
    trees.mode === 'jobs'
      ? 'Arbres de processus : objets de tâche (Windows)'
      : 'Arbres de processus : repli taskkill, sans objets de tâche (Windows)'
  )
  void reapOrphansWindows(previous, {
    list: () => listWin32Processes(windowsPowerShell(env)),
    taskkill: (pid) => kill(pid, false),
    log: (line) => log.info(line),
    self: process.pid
  })
}
