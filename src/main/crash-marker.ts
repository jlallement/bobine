/**
 * Marque « en cours » et rapport local de plantage (fiche 194). La marque est posée au lancement et
 * retirée en quittant normalement. Restée là au lancement suivant (plantage, `kill -9`, coupure de
 * courant), un rapport est rangé dans `<données>/crash-reports/<date>/` : version, système, fin du
 * journal, minidumps de `crashReporter`. Rien n'est envoyé : tout reste sur le Mac.
 * N'importe pas `electron`.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, join } from 'node:path'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { log } from './log'
import { isReadOnly, readJson, writeFileAtomic } from './storage'

export const RUN_MARK_FILE = 'running.json'
export const CRASH_REPORTS_DIR = 'crash-reports'
/** Rapports gardés : les dix plus récents, de moins de trente jours. */
const KEEP_REPORTS = 10
const KEEP_DAYS = 30
const LOG_TAIL_LINES = 300

interface RunMark {
  pid: number
  startedAt: string
  version: string
}

export interface RunFacts {
  version: string
  electron: string
  os: string
  /** Journal de l'app, dont la fin va dans le rapport. */
  logFile?: string
  /** Dossier des minidumps de `crashReporter`. */
  dumpsDir?: string
  now?: Date
  pid?: number
}

/**
 * Au lancement : rend le dossier du rapport si le lancement précédent ne s'est pas arrêté
 * proprement (sinon `undefined`), puis pose la marque de ce lancement. Ne lève jamais.
 */
export function startRunMark(userData: string, facts: RunFacts): string | undefined {
  const file = join(userData, RUN_MARK_FILE)
  // Profil en lecture seule (fiche 196) : ni marque, ni rapport, ni ménage dans le profil.
  if (isReadOnly(file)) return undefined
  const now = facts.now ?? new Date()
  let report: string | undefined
  try {
    const previous = readJson(file)
    if (previous.ok) report = writeCrashReport(userData, previous.value as Partial<RunMark>, facts)
    else if (previous.reason === 'corrupt') report = writeCrashReport(userData, {}, facts)
    pruneReports(join(userData, CRASH_REPORTS_DIR), now)
  } catch (error) {
    log.warn(`Rapport du plantage précédent non écrit : ${messageOf(error)}`)
  }
  try {
    const mark: RunMark = {
      pid: facts.pid ?? process.pid,
      startedAt: now.toISOString(),
      version: facts.version
    }
    writeFileAtomic(file, `${JSON.stringify(mark)}\n`)
  } catch (error) {
    log.warn(`Marque de lancement non écrite : ${messageOf(error)}`)
  }
  return report
}

/** En quittant normalement : la marque part. */
export function endRunMark(userData: string): void {
  if (isReadOnly(join(userData, RUN_MARK_FILE))) return
  rmSync(join(userData, RUN_MARK_FILE), { force: true })
}

const stamp = (date: Date) => date.toISOString().slice(0, 19).replace(/[T:]/g, '-')

function writeCrashReport(userData: string, mark: Partial<RunMark>, facts: RunFacts): string {
  const now = facts.now ?? new Date()
  const dir = join(userData, CRASH_REPORTS_DIR, stamp(now))
  mkdirSync(dir, { recursive: true })
  const startedAt = typeof mark.startedAt === 'string' ? Date.parse(mark.startedAt) : NaN
  const dumps = facts.dumpsDir ? minidumpsSince(facts.dumpsDir, startedAt) : []
  for (const dump of dumps) copyFileSync(dump, join(dir, basename(dump)))
  // Dans la langue de l'interface : le rapport est fait pour être lu et joint par l'utilisateur.
  const lines = [
    t('crashReport.intro'),
    t('crashReport.privacy'),
    '',
    t('crashReport.stopped', {
      startedAt: mark.startedAt ?? t('crashReport.unknown'),
      pid: String(mark.pid ?? '?'),
      version: mark.version ?? '?'
    }),
    t('crashReport.seen', { at: now.toISOString() }),
    `Bobine ${facts.version}, Electron ${facts.electron}, macOS ${facts.os}`,
    t('crashReport.dumps', { count: dumps.length }),
    '',
    t('crashReport.logTail', { lines: LOG_TAIL_LINES }),
    logTail(facts.logFile)
  ]
  writeFileSync(join(dir, 'rapport.txt'), `${lines.join('\n')}\n`)
  log.warn(`Le lancement précédent s’est arrêté sans quitter : rapport local dans ${dir}`)
  return dir
}

function logTail(file: string | undefined): string {
  if (!file || !existsSync(file)) return t('crashReport.noLog')
  return readFileSync(file, 'utf8').split('\n').slice(-LOG_TAIL_LINES).join('\n')
}

/** Minidumps (`.dmp`) écrits depuis `since` (tous si l'heure est inconnue), sous `dir`. */
function minidumpsSince(dir: string, since: number): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  const walk = (current: string, depth: number) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory() && depth < 3) walk(path, depth + 1)
      else if (entry.isFile() && entry.name.endsWith('.dmp')) {
        if (Number.isNaN(since) || statSync(path).mtimeMs >= since - 5000) found.push(path)
      }
    }
  }
  walk(dir, 0)
  return found
}

/** Garde les `KEEP_REPORTS` rapports les plus récents, de moins de `KEEP_DAYS` jours. */
export function pruneReports(dir: string, now: Date): void {
  if (!existsSync(dir)) return
  const reports = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ path: join(dir, entry.name), at: statSync(join(dir, entry.name)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  const limit = now.getTime() - KEEP_DAYS * 24 * 3600_000
  reports.forEach((report, index) => {
    if (index >= KEEP_REPORTS || report.at < limit) {
      rmSync(report.path, { recursive: true, force: true })
    }
  })
}
