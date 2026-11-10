/**
 * Commande longue lancée en tâche de fond (compilation Xcode, Gradle…) : sa sortie est gardée en
 * mémoire et l'outil de l'agent n'attend qu'un temps borné (Bob abandonne un appel au bout d'environ
 * 60 s), puis l'agent le rappelle.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { stopGroup } from '../process-group'
import { trackChild } from '../process-registry'

const MAX_LINES = 2000

/**
 * Travaux en cours (fiche 195) : lancés dans leur propre groupe et notés au registre des processus,
 * pour être arrêtés en quittant (`stopAllJobs`) et repris au lancement suivant après un plantage.
 */
const running = new Set<ChildProcess>()

/** Arrête tous les travaux en cours, avec leurs sous-processus (en quittant l'app). */
export function stopAllJobs(): void {
  for (const child of running) stopGroup(child)
  running.clear()
}

/** Nombre de travaux en cours (essais). */
export const runningJobs = (): number => running.size

export interface CommandJob {
  status: 'running' | 'succeeded' | 'failed'
  startedAt: number
  finishedAt?: number
  lines: string[]
  done: Promise<void>
}

/** Lance la commande ; `finish` peut compléter le travail une fois la commande terminée. */
export function startCommandJob(
  file: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
  finish?: (job: CommandJob, ok: boolean) => void
): CommandJob {
  const job: CommandJob = {
    status: 'running',
    startedAt: Date.now(),
    lines: [],
    done: Promise.resolve()
  }
  job.done = new Promise<void>((resolve) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ?? process.env,
      // Son propre groupe : `xcodebuild` ou gradle emportent leurs sous-processus en s'arrêtant.
      detached: true
    })
    running.add(child)
    trackChild(child, [file, ...args])
    let rest = ''
    const push = (line: string) => {
      if (!line.trim()) return
      job.lines.push(line)
      if (job.lines.length > MAX_LINES) job.lines.splice(0, job.lines.length - MAX_LINES)
    }
    const onData = (chunk: Buffer) => {
      const parts = (rest + chunk.toString('utf8')).split(/\r?\n/)
      rest = parts.pop() ?? ''
      parts.forEach(push)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    let settled = false
    const end = (ok: boolean, message?: string) => {
      if (settled) return
      settled = true
      running.delete(child)
      push(rest)
      if (message) push(message)
      job.status = ok ? 'succeeded' : 'failed'
      job.finishedAt = Date.now()
      finish?.(job, ok)
      resolve()
    }
    child.on('error', (error) => end(false, `${file}: error: ${error.message}`))
    child.on('exit', (code) => end(code === 0))
  })
  return job
}

/**
 * Attend la fin du travail au plus `ms`, ou jusqu'à ce que `signal` soit levé (l'agent a raccroché,
 * fiche 195) ; `true` s'il est terminé. Le travail, lui, continue : l'agent le rappellera.
 */
export function waitAtMost(job: CommandJob, ms: number, signal?: AbortSignal): Promise<boolean> {
  return Promise.race([
    job.done.then(() => true),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), ms).unref()
      if (signal?.aborted) resolve(false)
      signal?.addEventListener('abort', () => resolve(false), { once: true })
    })
  ])
}
