/**
 * Suites e2e en parallèle (`pnpm e2e --jobs N`, fiche 115) : chaque tâche (une suite, un thème)
 * tourne dans son propre processus `node e2e/run.mjs <suite> --<thème> --jobs 1`, au plus N à la
 * fois. Chaque processus a sa tranche de ports (`BOBINE_E2E_JOB`), ses dossiers jetables et son
 * propre délai maximal ; sa sortie est montrée d'un bloc, entière si la suite échoue.
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { countFailures, formatDuration, nextTask } from '../scripts/e2e-select.mts'
import { root } from './state.mjs'

/** Délai maximal d'une suite (un thème) : au-delà, elle est bloquée (attente sans fin, port pris…). */
export const SUITE_TIMEOUT_MS = 5 * 60_000
/** Marge du lanceur au-dessus du délai de la suite elle-même, qui s'arrête d'abord en le disant. */
const GUARD_MS = 60_000

const label = (task) => `${task.name}${task.scheme ? ` ${task.scheme}` : ''}`
const indent = (text) =>
  text
    .trimEnd()
    .split('\n')
    .map((l) => `    │ ${l}`)
    .join('\n')

/** Lance une tâche dans son processus ; résout avec sa sortie, son code et sa durée. */
function runTask(task, slot, { jobs, lang }) {
  const args = [
    ...process.execArgv,
    join(root, 'e2e', 'run.mjs'),
    task.name,
    ...(task.scheme ? [`--${task.scheme}`] : []),
    '--jobs',
    '1',
    '--lang',
    lang
  ]
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, BOBINE_E2E_JOB: String(slot), BOBINE_E2E_JOBS: String(jobs) },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  const started = Date.now()
  // La suite s'arrête seule au bout de SUITE_TIMEOUT_MS ; sinon (processus figé), SIGTERM — ses
  // apps sont tuées à sa sortie —, puis SIGKILL.
  let blocked = false
  const guard = setTimeout(() => {
    blocked = true
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
  }, SUITE_TIMEOUT_MS + GUARD_MS)
  const done = new Promise((resolve) => {
    child.once('close', (code, signal) => {
      clearTimeout(guard)
      resolve({ output, code: code ?? 1, signal, blocked, ms: Date.now() - started })
    })
  })
  return { child, done }
}

/**
 * Joue les tâches, au plus `jobs` à la fois, dans l'ordre donné (voir `orderTasks`), en
 * respectant `alone` et `locks`. Renvoie le nombre d'échecs et la durée de chaque tâche.
 */
export async function runPool(tasks, { jobs, lang, verbose }) {
  const queue = [...tasks]
  /** Tâches en cours : tâche, poste (`slot`), processus, promesse. */
  const running = []
  const durations = {}
  let failures = 0
  let finished = 0
  const total = tasks.length

  const stop = () => {
    for (const r of running) r.child.kill('SIGTERM')
    process.exit(130)
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  const freeSlot = () => {
    for (let s = 0; s < jobs; s++) if (!running.some((r) => r.slot === s)) return s
    return -1
  }
  const start = () => {
    for (;;) {
      const i = nextTask(
        queue,
        running.map((r) => r.task),
        jobs
      )
      if (i < 0) return
      const [task] = queue.splice(i, 1)
      const slot = freeSlot()
      const { child, done } = runTask(task, slot, { jobs, lang })
      running.push({ task, slot, child, done: done.then((result) => ({ task, slot, result })) })
    }
  }

  start()
  while (running.length) {
    const { task, slot, result } = await Promise.race(running.map((r) => r.done))
    running.splice(
      running.findIndex((r) => r.task === task),
      1
    )
    finished++
    durations[task.key] = result.ms
    // Échecs comptés dans la sortie ; un processus en échec sans ligne `✗` (plantage) en vaut un.
    const counted = countFailures(result.output)
    const failed = result.code !== 0 || counted > 0
    const count = failed ? Math.max(counted, 1) : 0
    failures += count
    const head = `${failed ? '✗' : '✓'} [${String(finished).padStart(String(total).length)}/${total}] ${label(task)} · ${formatDuration(result.ms)} · job ${slot + 1}`
    const why = result.blocked
      ? ` — bloquée, arrêtée au bout de ${formatDuration(SUITE_TIMEOUT_MS + GUARD_MS)}`
      : failed
        ? ` — ${count} échec(s)`
        : ''
    console.log(`${head}${why}`)
    if (failed || verbose) console.log(indent(result.output))
    start()
  }
  process.off('SIGINT', stop)
  process.off('SIGTERM', stop)
  return { failures, durations }
}
