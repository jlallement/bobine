/**
 * Relevé de fin des tests unitaires en CI (`scripts/verify`, fiche 250) : machine (cœurs, charge),
 * nombre de workers de vitest, et les essais les plus lents, lus dans le rapport JSON de vitest.
 * Un relevé, jamais bloquant : pour qu'un rouge par délai dépassé (Windows, 2026-11-25) soit lisible.
 *
 *   node scripts/test-report.mts <rapport.json> [n]
 */
import { readFileSync } from 'node:fs'
import { availableParallelism, freemem, loadavg, totalmem } from 'node:os'
import { fileURLToPath } from 'node:url'

export interface SlowTest {
  file: string
  name: string
  ms: number
  status: string
}

interface JsonAssertion {
  fullName?: unknown
  title?: unknown
  duration?: unknown
  status?: unknown
}
interface JsonFile {
  name?: unknown
  assertionResults?: unknown
}

/** Les `n` essais les plus longs d'un rapport JSON de vitest (format compatible Jest). */
export function slowestTests(report: unknown, n = 10, root = ''): SlowTest[] {
  const files = (report as { testResults?: unknown } | null)?.testResults
  if (!Array.isArray(files)) return []
  const all: SlowTest[] = []
  for (const f of files as JsonFile[]) {
    // Chemins comparés en `/` : vitest écrit `D:/a/…` sous Windows, Node `D:\a\…`.
    const file = typeof f.name === 'string' ? f.name.replace(/\\/g, '/') : '?'
    const base = root.replace(/\\/g, '/').replace(/\/$/, '')
    const short = base && file.startsWith(`${base}/`) ? file.slice(base.length + 1) : file
    if (!Array.isArray(f.assertionResults)) continue
    for (const a of f.assertionResults as JsonAssertion[]) {
      if (typeof a.duration !== 'number') continue
      const name =
        typeof a.fullName === 'string' ? a.fullName : typeof a.title === 'string' ? a.title : '?'
      all.push({ file: short, name, ms: a.duration, status: String(a.status ?? '?') })
    }
  }
  return all.sort((a, b) => b.ms - a.ms).slice(0, n)
}

/** Une ligne par essai : durée, état, fichier › nom (tronqué). */
export function formatSlowest(tests: readonly SlowTest[]): string[] {
  if (!tests.length) return ['(aucune durée lue dans le rapport)']
  return tests.map((t) => {
    const label = `${t.file} › ${t.name}`
    const cut = label.length > 150 ? `${label.slice(0, 149)}…` : label
    return `  ${(t.ms / 1000).toFixed(1).padStart(5)} s  ${t.status.padEnd(6)}  ${cut}`
  })
}

/** Ligne machine : cœurs, workers demandés, charge (sans valeur sous Windows), mémoire libre. */
export function machineLine(info: {
  cores: number
  workers: string | undefined
  load: readonly number[]
  platform: NodeJS.Platform
  freeBytes: number
  totalBytes: number
}): string {
  const workers = info.workers
    ? `${info.workers} (BOBINE_TEST_WORKERS)`
    : `défaut de vitest (${Math.max(info.cores - 1, 1)})`
  const load =
    info.platform === 'win32'
      ? 'charge non mesurée sous Windows'
      : `charge ${info.load.map((l) => l.toFixed(2)).join(' ')} (1, 5, 15 min)`
  const gib = (b: number): string => (b / 1024 ** 3).toFixed(1)
  return `${info.cores} cœurs · workers ${workers} · ${load} · mémoire libre ${gib(info.freeBytes)} / ${gib(info.totalBytes)} Gio`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [path, count] = process.argv.slice(2)
  console.log(
    `Machine : ${machineLine({
      cores: availableParallelism(),
      workers: process.env.BOBINE_TEST_WORKERS,
      load: loadavg(),
      platform: process.platform,
      freeBytes: freemem(),
      totalBytes: totalmem()
    })}`
  )
  let report: unknown
  try {
    report = path ? JSON.parse(readFileSync(path, 'utf8')) : undefined
  } catch (error) {
    console.log(`(rapport illisible : ${(error as Error).message})`)
  }
  const n = Number(count) || 10
  console.log(`Les ${n} essais les plus lents :`)
  const root = fileURLToPath(new URL('..', import.meta.url))
  for (const line of formatSlowest(slowestTests(report, n, root))) console.log(line)
}
