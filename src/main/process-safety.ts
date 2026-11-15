/**
 * Sûreté au démarrage (fiche 138), un seul appel depuis `index.ts` : système des processus posé
 * (lancement, arbres : ADR-0050), registre des processus enfants ouvert avant tout lancement,
 * processus laissés par un lancement précédent arrêtés (en tâche de fond), permissions de la
 * session par défaut restreintes.
 */
import { execFile, execFileSync } from 'node:child_process'
import { join, win32 } from 'node:path'
import { restrictDefaultPermissions } from './default-permissions'
import { log } from './log'
import { STOP_GRACE_MS } from './process-group'
import {
  configureProcessLaunch,
  envValue,
  windowsPowerShell,
  type ProcessSystem
} from './process-launch'
import { openProcessRegistry, PIDS_FILE, reapOrphans } from './process-registry'
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

export function setupProcessSafety(
  userData: string,
  system: ProcessSystem,
  jobs?: JobApi,
  env: NodeJS.ProcessEnv = process.env
): void {
  configureProcessLaunch(system)
  const previous = openProcessRegistry(join(userData, PIDS_FILE))
  if (system === 'windows') {
    const kill = taskkill(env)
    const trees = new WindowsTrees({
      jobs,
      taskkill: kill,
      log: (line) => log.info(line),
      graceMs: STOP_GRACE_MS
    })
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
  } else {
    void reapOrphans(previous)
  }
  restrictDefaultPermissions()
}
