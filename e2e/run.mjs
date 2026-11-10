/**
 * Essais de bout en bout de l'interface, contre l'app buildée et l'agent factice.
 *
 *   pnpm build && pnpm e2e              toutes les suites, thèmes clair et sombre, 3 en parallèle
 *   pnpm e2e plan history               seulement ces suites
 *   pnpm e2e plan --dark                seulement le thème sombre
 *   pnpm e2e --jobs 1                   une suite à la fois, dans ce processus (fiche 115)
 *   pnpm e2e --changed                  les suites touchées par les fichiers modifiés depuis main
 *   pnpm e2e --changed --base origin/main   … depuis une autre base
 *   pnpm e2e --if-needed                la suite complète, sauf si elle est déjà verte pour ces
 *                                       sources et ce build (`pnpm e2e:pretag`, avant un tag)
 *   pnpm e2e --changed --dry-run        ce qui serait joué, sans rien lancer
 *   pnpm e2e --list                     liste des suites
 *   pnpm e2e base --lang en             interface en anglais (captures `en-…`, fiche 074)
 *
 * En parallèle (`--jobs N`, 3 par défaut), chaque suite et chaque thème tournent dans leur propre
 * processus (`pool.mjs`) : une ligne par suite finie (durée, job), sa sortie entière si elle
 * échoue (`--verbose` : toujours). Une suite qui prend une ressource de toute la machine tourne
 * seule ou sous verrou (`catalog.mjs`). Une suite complète verte (sans filtre, les deux thèmes)
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
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  formatDuration,
  isFullRun,
  orderTasks,
  parseArgs,
  selectSuites,
  supported,
  tasksFor
} from '../scripts/e2e-select.mts'
import { currentPlatformFeatures } from '../src/main/platform.ts'
import { GLOBAL_SOURCES, SUITES } from './catalog.mjs'
import { SUITE_TIMEOUT_MS, runPool } from './pool.mjs'
import {
  changedFiles,
  lastGreen,
  readDurations,
  sourceFingerprint,
  writeDurations,
  writeGreen
} from './state.mjs'

let options
try {
  options = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error(error.message)
  process.exit(2)
}
if (options.list) {
  for (const { name } of SUITES) console.log(name)
  process.exit(0)
}
const unknown = options.suites.filter((w) => !SUITES.some(({ name }) => name === w))
if (unknown.length) {
  console.error(`Suite inconnue : ${unknown.join(', ')} (voir pnpm e2e --list)`)
  process.exit(2)
}
/** Processus lancé par `pool.mjs` pour une seule tâche. */
const isChild = process.env.BOBINE_E2E_JOB !== undefined

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
  names = [...new Set([...(names ?? []), ...selection.suites.map((s) => s.name)])]
  if (!names.length) {
    console.log('\nAucune suite touchée : rien à jouer.')
    process.exit(0)
  }
  console.log()
}

// Capacités de la plateforme (fiche 145) : celles de l'app lancée par les essais, `BOBINE_PLATFORM`
// compris. Une suite qui demande une capacité absente est sautée, et dite.
const features = currentPlatformFeatures(process.env, process.platform)
const skipped = SUITES.filter((s) => (!names || names.includes(s.name)) && !supported(s, features))
for (const s of skipped) console.log(`↷ ${s.name} sautée : demande ${s.needs.join(', ')}`)
// Une suite sautée : ce n'est plus une suite complète (rien n'est noté vert).
const fullRun = isFullRun(options) && !skipped.length
const tasks = tasksFor(SUITES, names, options.schemes, features)
const parallel = options.jobs > 1 && tasks.length > 1
const ordered = parallel ? orderTasks(tasks, readDurations()) : tasks
if (options.dryRun) {
  console.log(`${tasks.length} tâche(s), ${parallel ? `${options.jobs} jobs` : 'une à la fois'} :`)
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
  console.log(`▶ ${tasks.length} tâches, ${options.jobs} jobs\n`)
  result = await runPool(ordered, options)
} else {
  result = await runHere(tasks)
}
const duration = formatDuration(Date.now() - started)
if (!isChild) writeDurations(result.durations)
if (fullRun && fingerprint && result.failures === 0) {
  writeGreen(options.lang, {
    fingerprint,
    date: new Date().toISOString(),
    duration: Math.round((Date.now() - started) / 1000),
    jobs: options.jobs
  })
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
  const { fail, failureCount, setSuite } = await import('./lib.mjs')
  const durations = {}
  for (const task of list) {
    const entry = SUITES.find((s) => s.name === task.name)
    const run = (await import(`./suites/${entry.file}`))[entry.run]
    setSuite(task.name)
    const before = Date.now()
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
    console.log(
      `  (${task.name}${task.scheme ? ` ${task.scheme}` : ''} : ${Math.round(durations[task.key] / 1000)} s)`
    )
  }
  return { failures: failureCount(), durations }
}
