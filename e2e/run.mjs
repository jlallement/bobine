/**
 * Essais de bout en bout de l'interface, contre l'app buildée et l'agent factice.
 *
 *   pnpm build && pnpm e2e              toutes les suites en clair, et en sombre celles qui
 *                                       vérifient un rendu sombre (`dark` du catalogue, ADR-0071)
 *   pnpm e2e plan history               seulement ces suites
 *   pnpm e2e plan --dark                seulement le thème sombre (`--light` : le clair)
 *   pnpm e2e --themes both              les deux thèmes pour toutes les suites (nuit, avant un tag)
 *   pnpm e2e --jobs 1                   une suite à la fois, dans ce processus (fiche 115)
 *   pnpm e2e --changed                  les suites touchées par les fichiers modifiés depuis main
 *                                       (un fichier de thème ou de style touché : toutes en sombre)
 *   pnpm e2e --changed --base origin/main   … depuis une autre base
 *   pnpm e2e --if-needed                la suite complète, sauf si elle est déjà verte pour ces
 *                                       sources et ce build (`pnpm e2e:pretag`, avant un tag),
 *                                       les deux thèmes partout
 *   pnpm e2e --changed --dry-run        ce qui serait joué, sans rien lancer
 *   pnpm e2e --list                     liste des suites
 *   pnpm e2e --skip perf                tout sauf ces suites (dites, et la suite n'est plus complète)
 *                                       (une suite en quarantaine sur ce système, `quarantine` du
 *                                       catalogue, est écartée et dite de même ; nommée, elle joue)
 *   pnpm e2e base --lang en             interface en anglais (captures `en-…`, fiche 074)
 *   pnpm e2e --indicative perf          sur GitHub, chaque contrôle en échec devient une annotation
 *                                       `::warning::` ; code de sortie inchangé (fiche 250)
 *
 * En parallèle (`--jobs N` ; par défaut un job pour 3 cœurs, au plus 5, et 3 sur GitHub : fiche
 * 279 ; `--jobs 3` à la main si d'autres travaux lourds tournent), chaque suite et chaque thème
 * tournent dans leur propre
 * processus (`pool.mjs`) : une ligne par suite finie (durée, job), sa sortie entière si elle
 * échoue (`--verbose` : toujours). Une suite qui prend une ressource de toute la machine tourne
 * seule ou sous verrou (`catalog.mjs`). Une suite complète verte (sans filtre, les deux thèmes
 * partout : `--themes both` ou `--if-needed`)
 * pose `e2e/.last-green.json` ; `e2e/.durations.json` garde les durées pour l'ordre de passage.
 *
 * Captures dans e2e/captures/ (ignorées par git). En cas d'échec, une capture
 * `echec-<suite>-*.png` et un `.txt` (texte de la fenêtre, 200 dernières lignes de la console du
 * renderer, journal du main) sont écrits au moment de l'échec.
 *
 * Lance Electron avec un dossier de données jetable (les réglages réels ne sont jamais touchés) et
 * des ports libres, sans lui donner le focus de la machine (fiche 106), le pilote via le protocole
 * DevTools, et n'arrête que le processus qu'il a lancé.
 *
 * Avant de jouer, les avis de licence doivent correspondre au build essayé (fiche 217) : c'est ce
 * qui tourne avant chaque envoi.
 *
 * À la fin du lot, un relevé (jamais bloquant, `scripts/e2e-leftovers.mts`) : processus du lot
 * encore vivants (pid, âge, %CPU, commande) et charge de la machine ; « aucun processus restant »
 * sinon. Diagnostic du lot anglais lent sur le runner Mac de GitHub (fiche 250, 2026-11-25).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  defaultJobs,
  effectiveThemes,
  firstMatch,
  formatDuration,
  indicativeWarnings,
  isCi,
  isFullRun,
  orderTasks,
  parseArgs,
  staleFailureFiles,
  quarantinedOn,
  selectSuites,
  supported,
  tasksFor
} from '../scripts/e2e-select.mts'
import { RUN_MARK, leftoverReport } from '../scripts/e2e-leftovers.mts'
import { currentPlatformFeatures } from '../src/main/platform.ts'
import { GLOBAL_SOURCES, SUITES, THEME_SOURCES } from './catalog.mjs'
import { SUITE_TIMEOUT_MS, runPool } from './pool.mjs'
import {
  changedFiles,
  lastGreen,
  readDurations,
  root,
  sourceFingerprint,
  writeDurations,
  writeGreen
} from './state.mjs'

let options
try {
  options = parseArgs(process.argv.slice(2), {
    jobs: defaultJobs(availableParallelism(), isCi(process.env))
  })
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
if (options.list) {
  for (const { name } of SUITES) console.log(name)
  process.exit(0)
}
const unknown = [...options.suites, ...options.skip].filter(
  (w) => !SUITES.some(({ name }) => name === w)
)
if (unknown.length) {
  console.error(`Suite inconnue : ${unknown.join(', ')} (voir pnpm e2e --list)`)
  process.exit(2)
}
/** Processus lancé par `pool.mjs` pour une seule tâche. */
const isChild = process.env.BOBINE_E2E_JOB !== undefined
// Marque du lot (relevé de fin, `scripts/e2e-leftovers.mts`) : posée avant tout lancement, héritée
// par les tâches, les apps, les agents factices, les serveurs de test…
if (!isChild) process.env[RUN_MARK] = `${process.pid}-${Date.now()}`

if (options.ifNeeded) {
  const current = sourceFingerprint()
  const green = lastGreen(options.lang)
  const when = green && new Date(green.date).toLocaleString('fr-FR')
  if (current && green?.fingerprint === current) {
    console.log(`✓ Suite complète déjà verte pour ce build (${when}) : rien à rejouer.`)
    process.exit(0)
  }
  console.log(
    !current
      ? 'Pas de build (out/) : suite complète à jouer après pnpm build.'
      : green
        ? `Sources ou build changés depuis la dernière suite complète verte (${when}) : suite complète.`
        : 'Aucune suite complète verte enregistrée : suite complète.'
  )
}

/** Suites à jouer : celles nommées, plus celles touchées par les fichiers modifiés (`--changed`). */
let names = options.suites.length ? [...options.suites] : null
/** Fichiers de thème ou de style modifiés (`--changed`) : le sombre pour toutes les suites. */
let themeTouched = []
if (options.changed) {
  let files
  try {
    files = changedFiles(options.base)
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
  const selection = selectSuites(SUITES, files, GLOBAL_SOURCES)
  console.log(`Fichiers modifiés depuis ${options.base} (${files.length}) :`)
  for (const f of files) console.log(`  ${f}`)
  if (selection.everything.length) {
    for (const f of selection.everything) console.log(`→ ${f} : tout`)
  } else {
    for (const { name, why } of selection.suites) console.log(`→ ${name} ← ${why.join(', ')}`)
  }
  if (!selection.everything.length && selection.unmapped.length) {
    console.log(`Hors carte (aucune suite) : ${selection.unmapped.join(', ')}`)
  }
  themeTouched = files.filter((f) => firstMatch(f, THEME_SOURCES))
  if (themeTouched.length && options.themes === 'auto') {
    console.log(
      `→ thème ou style touché (${themeTouched.join(', ')}) : sombre pour toutes les suites jouées`
    )
  }
  names = [...new Set([...(names ?? []), ...selection.suites.map((s) => s.name)])]
  if (!names.length) {
    console.log('\nAucune suite touchée : rien à jouer.')
    process.exit(0)
  }
  console.log()
}

// Suites écartées à la demande (`--skip`, fiche 145) : nommées, et la suite n'est plus complète.
if (options.skip.length) {
  names = (names ?? SUITES.map(({ name }) => name)).filter((n) => !options.skip.includes(n))
  for (const n of options.skip) console.log(`↷ ${n} écartée (--skip)`)
}

// Quarantaine (fiche 250) : un échec connu et compris sur ce système, écarté pour ne pas masquer
// les autres ; dit à chaque passage (annotation sur GitHub), et joué quand on nomme la suite.
const quarantined = quarantinedOn(SUITES, names, options.suites, process.platform)
if (quarantined.length) {
  const out = quarantined.map((q) => q.name)
  names = (names ?? SUITES.map(({ name }) => name)).filter((n) => !out.includes(n))
  for (const { name, reason } of quarantined) {
    console.log(`⚠ ${name} en quarantaine sous ${process.platform} : ${reason}`)
    if (process.env.GITHUB_ACTIONS === 'true' && !isChild) {
      console.log(`::warning title=e2e ${name} en quarantaine (${process.platform})::${reason}`)
    }
  }
}

// Capacités de la plateforme (fiche 145) : celles de l'app lancée par les essais, `BOBINE_PLATFORM`
// compris. Une suite qui demande une capacité absente est sautée, et dite.
const features = currentPlatformFeatures(process.env, process.platform)
const skipped = SUITES.filter((s) => (!names || names.includes(s.name)) && !supported(s, features))
for (const s of skipped) console.log(`↷ ${s.name} sautée : demande ${s.needs.join(', ')}`)
// Une suite sautée : ce n'est plus une suite complète (rien n'est noté vert).
const fullRun = isFullRun(options) && !skipped.length && !quarantined.length
const themes = effectiveThemes(options.themes, themeTouched)
const tasks = tasksFor(SUITES, names, themes, features)
const THEMES_SAID = {
  auto: 'clair partout, sombre pour les suites qui vérifient un rendu sombre',
  both: 'clair et sombre partout',
  light: 'clair seulement',
  dark: 'sombre seulement'
}
const parallel = options.jobs > 1 && tasks.length > 1
const ordered = parallel ? orderTasks(tasks, readDurations()) : tasks
if (options.dryRun) {
  console.log(
    `${tasks.length} tâche(s), ${parallel ? `${options.jobs} jobs` : 'une à la fois'}, ${THEMES_SAID[themes]} :`
  )
  for (const t of ordered) console.log(`  ${t.key}${t.alone ? ' (seule)' : ''}`)
  process.exit(0)
}
// Avis de licence à jour pour ce build (fiche 217), vérifié une fois par le processus parent.
if (!isChild) {
  const script = fileURLToPath(new URL('../scripts/third-party-notices.mts', import.meta.url))
  try {
    execFileSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--check'],
      { stdio: 'inherit' }
    )
  } catch {
    process.exit(1)
  }
}
// Empreinte prise avant de jouer : c'est ce build et ces sources que la suite aura essayés.
const fingerprint = fullRun ? sourceFingerprint() : null

const started = Date.now()
let result
if (parallel) {
  console.log(`▶ ${tasks.length} tâches, ${options.jobs} jobs, ${THEMES_SAID[themes]}\n`)
  result = await runPool(ordered, options)
} else {
  result = await runHere(tasks)
}
const duration = formatDuration(Date.now() - started)
if (!isChild) writeDurations(result.durations)
// Captures d'échec périmées des suites repassées au vert (fiche 267, revue UX).
if (!isChild) {
  const dir = fileURLToPath(new URL('./captures/', import.meta.url))
  const files = existsSync(dir) ? readdirSync(dir) : []
  for (const file of staleFailureFiles(files, result.passed, options.lang)) {
    rmSync(join(dir, file), { force: true })
  }
}
if (fullRun && fingerprint && result.failures === 0) {
  writeGreen(options.lang, {
    fingerprint,
    date: new Date().toISOString(),
    duration: Math.round((Date.now() - started) / 1000),
    jobs: options.jobs
  })
}
// Suites indicatives (fiche 250) : sur GitHub, chaque contrôle en échec est annoncé, sans rien
// changer au code de sortie (c'est l'étape du workflow qui ne bloque pas le job).
if (options.indicative && !isChild && process.env.GITHUB_ACTIONS === 'true') {
  for (const line of indicativeWarnings(result.failed, process.platform)) console.log(line)
}
// Relevé (pas un garde-fou) : ce que le lot laisse vivre, et la charge de la machine.
if (!isChild) {
  console.log()
  const report = await leftoverReport({
    root,
    runId: process.env[RUN_MARK],
    jobs: parallel ? options.jobs : 1
  })
  for (const line of report) {
    console.log(line)
  }
}
console.log(
  result.failures
    ? `\n✗ ${result.failures} échec(s) en ${duration} — captures et journaux dans e2e/captures/`
    : `\n✓ e2e ok en ${duration} — captures dans e2e/captures/`
)
process.exit(result.failures ? 1 : 0)

/**
 * Les tâches une à une dans ce processus (`--jobs 1`, ou une seule tâche) : la sortie de chaque
 * vérification au fil de l'eau. Une suite bloquée arrête le lancement (ses apps sont tuées).
 */
async function runHere(list) {
  const { fail, failureCount, failureLabels, setSuite } = await import('./lib.mjs')
  const durations = {}
  const passed = []
  const failed = []
  for (const task of list) {
    const entry = SUITES.find((s) => s.name === task.name)
    const run = (await import(`./suites/${entry.file}`))[entry.run]
    setSuite(task.name)
    const before = Date.now()
    const failuresBefore = failureCount()
    const labelsBefore = failureLabels().length
    let timer
    try {
      await Promise.race([
        task.scheme ? run(task.scheme) : run(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`suite bloquée depuis ${SUITE_TIMEOUT_MS / 60_000} min`)
            error.blocked = true
            reject(error)
          }, SUITE_TIMEOUT_MS)
        })
      ])
    } catch (error) {
      if (error.blocked) {
        fail(
          `${task.name}${task.scheme ? ` ${task.scheme}` : ''} : ${error.message} — lancement arrêté`
        )
        console.log(`\n✗ ${failureCount()} échec(s) — lancement arrêté sur une suite bloquée`)
        process.exit(1)
      }
      // Échec déjà compté (et capturé) dans l'app ; sinon, c'est le lancement qui a échoué.
      if (!error.reported) fail(`${task.name} : ${error.message}`)
    } finally {
      clearTimeout(timer)
    }
    durations[task.key] = Date.now() - before
    if (failureCount() === failuresBefore) passed.push(task)
    else {
      const label = `${task.name}${task.scheme ? ` ${task.scheme}` : ''}`
      failed.push({ label, controls: failureLabels().slice(labelsBefore) })
    }
    console.log(
      `  (${task.name}${task.scheme ? ` ${task.scheme}` : ''} : ${Math.round(durations[task.key] / 1000)} s)`
    )
  }
  return { failures: failureCount(), durations, passed, failed }
}
