/**
 * Instance de Bobine pilotée : lancement, arrêt, et le petit fichier d'état qui évite de répéter
 * port et dossiers à chaque commande.
 *
 * Dossier du pilote : `BOBINE_PILOTE_DIR`, sinon `.pilote/` à la racine du dépôt (ignoré par git).
 * Il contient `instance.json` (l'instance courante) et `sessions/<date>/` : le journal de la
 * session (`journal.md`, `journal.jsonl`), ses captures et la sortie de Bobine (`bobine.log`).
 */
import { execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPages, mainPage, sleep } from './cdp.mjs'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const piloteDir = () => resolve(process.env.BOBINE_PILOTE_DIR ?? join(root, '.pilote'))
const instanceFile = () => join(piloteDir(), 'instance.json')

/** Instance enregistrée, ou une erreur qui dit quoi faire. */
export function readInstance({ required = true } = {}) {
  try {
    return JSON.parse(readFileSync(instanceFile(), 'utf8'))
  } catch {
    if (!required) return undefined
    throw new Error('aucune Bobine pilotée : pnpm pilote lancer')
  }
}

export function writeInstance(instance) {
  mkdirSync(piloteDir(), { recursive: true })
  writeFileSync(instanceFile(), `${JSON.stringify(instance, null, 2)}\n`)
}

/** Le processus existe encore (signal 0 : rien n'est envoyé). */
export function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

const canListen = (port) =>
  new Promise((done) => {
    const server = createServer()
    server.once('error', () => done(false))
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)))
  })

/**
 * Le processus de ce pid est bien la Bobine lancée par le pilote (sa ligne de commande porte notre
 * port de débogage) : un pid réutilisé par un autre programme n'est jamais tué.
 */
export function ours(instance) {
  try {
    const command = execFileSync('ps', ['-o', 'command=', '-p', String(instance.pid)], {
      encoding: 'utf8'
    })
    return command.includes(`--remote-debugging-port=${instance.port}`)
  } catch {
    return false
  }
}

/** Port libre dans 9300–9399 (les essais e2e prennent 9555 et plus). */
async function freePort() {
  const start = 9300 + Math.floor(Math.random() * 100)
  for (let i = 0; i < 100; i++) {
    const port = 9300 + ((start - 9300 + i) % 100)
    if (await canListen(port)) return port
  }
  throw new Error('aucun port libre entre 9300 et 9399')
}

/** Horodatage de dossier : `2026-11-08-1432`. */
const stamp = (date = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

/**
 * Exécutable et arguments de tête pour l'app demandée : une `.app` (son exécutable de
 * `Contents/MacOS`), ou un dossier de sources buildées (`out/`) lancé par l'Electron du dépôt.
 */
export function appCommand(app) {
  const target = resolve(app ?? root)
  if (target.endsWith('.app')) {
    const macos = join(target, 'Contents', 'MacOS')
    const binary = existsSync(macos) ? readdirSync(macos)[0] : undefined
    if (!binary) throw new Error(`app introuvable : ${target}`)
    return { command: join(macos, binary), args: [], packaged: true }
  }
  if (!existsSync(join(target, 'out', 'main', 'index.js'))) {
    throw new Error(`pas de build dans ${target} : pnpm build`)
  }
  const electron = createRequire(join(root, 'package.json'))('electron')
  return { command: electron, args: [target], packaged: false }
}

/** Arguments de lancement de Bobine (pur, testé). */
export function launchArgs({ base, port, options }) {
  const args = [...base]
  if (options.profil) args.push(`--user-data-dir=${resolve(options.profil)}`)
  else args.push('--profil-temporaire')
  if (options['agents-neufs'] && !options.profil) args.push('--agents-neufs')
  args.push(`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1')
  // Boutons cliquables par leur nom avec computer use (arbre d'accessibilité toujours construit).
  args.push('--force-renderer-accessibility')
  // Jamais le vrai trousseau sans le demander : sa boîte de dialogue bloquerait le main process.
  if (!options['vrai-trousseau']) args.push('--use-mock-keychain')
  // Pas d'alerte « rouvrir les fenêtres ? » après un arrêt brutal (comme les essais e2e).
  args.push('-ApplePersistenceIgnoreState', 'YES')
  if (options.dossier) args.push('--', resolve(options.dossier))
  return args
}

/** Environnement de Bobine : celui du pilote, plus la langue et l'agent factice demandés. */
export function launchEnv(env, options) {
  const out = { ...env }
  if (options.lang) {
    out.BOBINE_LANG = options.lang
    out.MOCK_AGENT_LANG = options.lang
  }
  if (options['agent-factice']) {
    out.BOBINE_AGENT_PROFILE = 'mock'
    out.MOCK_AGENT_SCENARIO = options['agent-factice']
  }
  return out
}

/** Prête : un point d'état d'agent posé, ou l'accueil (premier lancement) affiché. */
const READY = `!!document.querySelector('.agent-avatar .status-dot, [data-testid=onboarding], [data-testid=welcome]')`

/** Lance Bobine, attend sa fenêtre, enregistre l'instance. Renvoie l'instance. */
export async function launch(options) {
  const previous = readInstance({ required: false })
  if (previous && !previous.arretee && alive(previous.pid) && ours(previous)) {
    throw new Error(`une Bobine pilotée tourne déjà (pid ${previous.pid}) : pnpm pilote arreter`)
  }
  const port = options.port ? Number(options.port) : await freePort()
  const journal = resolve(options.journal ?? join(piloteDir(), 'sessions', stamp()))
  mkdirSync(join(journal, 'captures'), { recursive: true })
  const { command, args: base, packaged } = appCommand(options.app)
  const log = openSync(join(journal, 'bobine.log'), 'a')
  const child = spawn(command, launchArgs({ base, port, options }), {
    env: launchEnv(process.env, options),
    detached: true,
    stdio: ['ignore', log, log]
  })
  child.unref()
  const instance = {
    pid: child.pid,
    port,
    app: options.app ? resolve(options.app) : root,
    packaged,
    profil: options.profil ? resolve(options.profil) : 'temporaire',
    journal,
    lang: options.lang ?? null,
    demarree: new Date().toISOString()
  }
  writeInstance(instance)
  try {
    await waitWindow(instance)
  } catch (error) {
    // Fenêtre jamais prête : on n'abandonne pas une Bobine à moitié lancée.
    killGroup(instance.pid)
    writeInstance({ ...instance, arretee: new Date().toISOString() })
    throw error
  }
  return instance
}

/**
 * SIGKILL au groupe de processus de Bobine (le pilote l'a lancée `detached` : ce groupe est le
 * sien, avec ce qu'elle a lancé dedans), puis à Bobine seule si le groupe n'existe plus.
 */
function killGroup(pid) {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, 'SIGKILL')
    } catch {
      // Déjà parti.
    }
  }
}

async function waitWindow(instance, ms = 60_000) {
  const { connect } = await import('./cdp.mjs')
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (!alive(instance.pid)) {
      throw new Error(`Bobine s'est arrêtée au lancement (voir ${instance.journal}/bobine.log)`)
    }
    if (mainPage(await listPages(instance.port))) {
      try {
        const page = await connect(instance.port)
        const ready = await page.ev(READY).finally(() => page.close())
        if (ready) return
      } catch {
        // Page encore en chargement : on réessaie.
      }
    }
    await sleep(500)
  }
  throw new Error(`fenêtre de Bobine absente au bout de ${ms / 1000} s (port ${instance.port})`)
}

/**
 * Arrête l'instance pilotée, et elle seule : SIGTERM (Bobine quitte proprement, ses agents avec),
 * SIGKILL au bout de 10 s.
 */
export async function stop() {
  const instance = readInstance()
  if (instance.arretee || !alive(instance.pid) || !ours(instance)) {
    writeInstance({ ...instance, arretee: instance.arretee ?? new Date().toISOString() })
    return { instance, already: true }
  }
  process.kill(instance.pid, 'SIGTERM')
  for (let i = 0; i < 100 && alive(instance.pid); i++) await sleep(100)
  if (alive(instance.pid)) killGroup(instance.pid)
  writeInstance({ ...instance, arretee: new Date().toISOString() })
  return { instance, already: false }
}

/** Taille d'un fichier, 0 s'il n'existe pas. */
export const fileSize = (path) => (existsSync(path) ? statSync(path).size : 0)
