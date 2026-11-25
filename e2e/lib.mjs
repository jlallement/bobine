/**
 * Outils communs des essais de bout en bout (voir `run.mjs`) : lancement de l'app avec un dossier
 * de données jetable, pilotage par le protocole DevTools, vérifications et captures.
 */
import { execFileSync, spawn } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentPlatformFeatures } from '../src/main/platform.ts'
import { formatKeys } from '../src/shared/shortcuts.ts'
import { withSystemTexts } from '../src/shared/i18n/system-texts.ts'
import { mockLanguage, say } from '../src/mock-agent/langue.mts'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const electron = createRequire(import.meta.url)('electron')
export const captures = join(root, 'e2e', 'captures')
mkdirSync(captures, { recursive: true })

/**
 * Capacités de la plateforme de l'app essayée (fiche 145), `BOBINE_PLATFORM` compris : une suite
 * mêlée ne vérifie ce qui est propre au Mac (compteur du Dock, capture d'écran, iOS…) que si la
 * capacité est là, et vérifie sinon que l'app ne le propose pas.
 */
export const FEATURES = currentPlatformFeatures(process.env, process.platform)

/**
 * Préférences d'affichage émulées dans la page (CDP) : le mode des essais, et celles de la machine
 * fixées à leur valeur par défaut (fiche 250). Le runner macOS de GitHub a « Réduire les
 * animations » et « Réduire la transparence » (`configure-system.sh` de `actions/runner-images`) :
 * l'app les suit, comme il se doit, et les suites qui supposent le réglage par défaut tombaient.
 * Une suite qui essaie l'une d'elles la demande par `ui.media`.
 */
export const mediaFeatures = (scheme, features = {}) =>
  Object.entries({
    'prefers-color-scheme': scheme,
    'prefers-reduced-motion': 'no-preference',
    'prefers-reduced-transparency': 'no-preference',
    'prefers-contrast': 'no-preference',
    ...features
  }).map(([name, value]) => ({ name, value }))

/**
 * Un trousseau chiffre les clés d'API de l'app essayée (fiche 145, D4) : sur macOS (le trousseau
 * simulé de `--use-mock-keychain`) et sous Windows (DPAPI), toujours. Sous Linux, Chromium ne joint
 * GNOME Keyring ni KWallet qu'à travers le bus D-Bus de la session : sans lui (Docker, job Linux de
 * GitHub), `safeStorage` n'a que `basic_text`, et Bobine garde la clé en clair, marquée `plain:` et
 * dite à l'écran. C'est ce comportement que les essais vérifient alors, pas un chiffrement absent.
 *
 * Déduit de l'environnement, pas lu dans l'app : elle n'expose nulle part le moteur choisi par
 * Chromium (`safeStorage.getSelectedStorageBackend()`, lu seulement dans le main), et l'ajouter
 * pour les essais serait une condition propre aux essais. Limite connue : un bus de session sans
 * démon de trousseau (ni GNOME Keyring ni KWallet) fait attendre une clé chiffrée alors que l'app
 * la garde en clair ; l'essai tombe alors rouge, jamais en faux vert. Lancer les essais Linux
 * sans bus (Docker, CI), ou avec un vrai trousseau.
 */
export const KEYRING = process.platform !== 'linux' || !!process.env['DBUS_SESSION_BUS_ADDRESS']

/**
 * Compteur sur l'icône de l'app (`main` : `mainProcess()`) : `expected` là où la plateforme a ce
 * compteur (capacité `dockBadge`) ; ailleurs, jamais posé.
 */
export async function dockBadgeIs(main, expected) {
  const badge = await main.evaluate(`require('electron').app.dock?.getBadge() ?? null`)
  return FEATURES.dockBadge ? badge === expected : badge === null || badge === ''
}

/**
 * Langue de l'interface pendant les essais (fiche 074) : `pnpm e2e --lang en` ; le français sinon,
 * quelle que soit la langue de la machine.
 */
export const LANG = (() => {
  const i = process.argv.indexOf('--lang')
  const value =
    i >= 0 ? process.argv[i + 1] : process.argv.find((a) => a.startsWith('--lang='))?.slice(7)
  return value ?? 'fr'
})()
// Textes du système de l'app essayée (« cet ordinateur », Explorateur…), comme l'app (fiche 229).
const messages = (() => {
  try {
    return withSystemTexts(
      JSON.parse(
        readFileSync(join(root, 'src', 'shared', 'i18n', 'locales', `${LANG}.json`), 'utf8')
      ),
      FEATURES
    )
  } catch {
    return {}
  }
})()

/**
 * Texte de l'interface dans la langue des essais, comme i18next l'affiche : clé, variables
 * `{{nom}}`, pluriel d'après `count`. Pour les textes de l'app seulement : ceux de l'agent factice
 * passent par `M`.
 */
export function L(key, params = {}) {
  const lookup = (k) => k.split('.').reduce((node, part) => node?.[part], messages)
  const plural =
    typeof params.count === 'number'
      ? lookup(`${key}_${new Intl.PluralRules(LANG).select(params.count)}`)
      : undefined
  const value = plural ?? lookup(key)
  if (typeof value !== 'string') throw new Error(`texte inconnu : ${key}`)
  const text = value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => String(params[name] ?? ''))
  // Raccourcis dans la notation de la plateforme, comme le renderer (`keyNotation`, fiche 145).
  return K(LANG === 'fr' ? frenchTypography(text) : text)
}

/**
 * Raccourci (ou texte) tel que l'interface l'affiche (fiche 145) : écrit comme sur macOS (⇧⌘U),
 * en Ctrl+Maj+U sans la capacité `commandKey` (`formatKeys` de `src/shared/shortcuts.ts`).
 */
export function K(text) {
  const lookup = (k) => k.split('.').reduce((node, part) => node?.[part], messages)
  return formatKeys(
    text,
    FEATURES.commandKey
      ? null
      : { ctrl: lookup('keys.ctrl'), alt: lookup('keys.alt'), shift: lookup('keys.shift') }
  )
}

/** Modificateur CDP de la touche des raccourcis : ⌘ (4) sur macOS, Ctrl (2) ailleurs (fiche 145). */
export const COMMAND = FEATURES.commandKey ? 4 : 2

/**
 * Texte de l'agent factice dans la langue des essais (fiche 167) : il parle la langue de
 * `MOCK_AGENT_LANG`, posée à celle des essais ; ses scénarios sont écrits en français, d'où la
 * phrase française en argument, traduite par le même dictionnaire que l'agent.
 */
export const MOCK_LANG = mockLanguage(LANG)
export const M = (text) => say(text, MOCK_LANG)

/**
 * Typographie du français comme l'app l'affiche (`src/shared/i18n/typography.ts`, fiche 126) :
 * élisions (« Fichier d’OpenCode ») et espaces insécables. Mêmes expressions, à garder identiques.
 */
const frenchTypography = (text) =>
  text
    .replace(/(?<![\p{L}\p{N}_’'])(de|que) (?=[AEIOUYÀÂÆÉÈÊËÎÏÔŒÛÜ])/gu, (_, word) =>
      word === 'de' ? 'd’' : 'qu’'
    )
    .replace(/ ([:;?!%»])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')

/**
 * Plus long morceau fixe d'un texte à variables (`L` sans elles) : ce qui est sûr de figurer dans
 * le texte affiché, quelles que soient les valeurs.
 */
export function Lpart(key, params = {}) {
  const marker = '\u0000'
  const names = Object.fromEntries(
    [...JSON.stringify(messages).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(([, name]) => [name, marker])
  )
  return L(key, { ...names, ...params })
    .split(marker)
    .map((part) => part.trim())
    .sort((a, b) => b.length - a.length)[0]
}

/** `L(…)` dans une expression régulière. */
export const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Expression : le texte du terminal affiché (les autres onglets restent cachés dans la page,
 * fiche 126), ses lignes mises bout à bout. Une commande passe à la ligne n'importe où selon la
 * longueur de l'invite (le nom de la machine varie d'un runner à l'autre) : à chercher avec
 * `.includes(…)`, jamais ligne par ligne.
 */
export const TERMINAL_TEXT = `([...document.querySelectorAll('.terminal-host .xterm-rows')].find((e) => !e.closest('[hidden]'))?.innerText ?? '').replaceAll('\\n', '')`

/** Fichier de capture : préfixé `en-` pour les essais en anglais. */
const captureFile = (name, scheme, ext) =>
  join(captures, `${LANG === 'fr' ? '' : `${LANG}-`}${name}-${scheme}.${ext}`)
/** Le port est libre : on a pu l'écouter (et on le rend aussitôt). */
const canListen = (port) =>
  new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
/**
 * Premier port libre à partir d'un point de départ tiré au sort dans la plage (fiche 106) : deux
 * lancements en parallèle (sessions parallèles, `pnpm dev` ouvert) ne se parlent jamais, au lieu de
 * compter sur la chance d'un tirage seul.
 *
 * Lancé par `pnpm e2e --jobs N` (fiche 115), chaque processus a sa propre tranche de la plage
 * (`BOBINE_E2E_JOB` sur `BOBINE_E2E_JOBS`) : le port choisi au lancement reste libre entre deux
 * apps de la même suite, aucun autre processus d'essai ne le prendra entre-temps.
 */
async function freePort(base, size) {
  const job = Number(process.env.BOBINE_E2E_JOB)
  const jobs = Number(process.env.BOBINE_E2E_JOBS)
  const sliced = Number.isInteger(job) && jobs > 1 && job < jobs
  const span = sliced ? Math.floor(size / jobs) : size
  const from = sliced ? base + job * span : base
  const start = from + Math.floor(Math.random() * span)
  for (let i = 0; i < span; i++) {
    const port = from + ((start - from + i) % span)
    if (await canListen(port)) return port
  }
  throw new Error(`aucun port libre entre ${from} et ${from + span - 1}`)
}
/** Protocole DevTools de la fenêtre (`--remote-debugging-port`). */
export const PORT = await freePort(9555, 300)
/** Inspecteur du processus principal (essais qui y regardent : notifications, badge). */
export const MAIN_PORT = await freePort(10555, 300)

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** Point d'état de l'agent dans la barre latérale (`ready`, `busy`, `needs-action`…). */
const AGENT_DOT = '.agent-avatar .status-dot'
/** Lignes de console du renderer gardées pour une capture d'échec. */
const CONSOLE_LINES = 200
/** Valeur CDP lisible : primitive telle quelle, sinon la description (objet, fonction, erreur). */
const remoteValue = (arg) =>
  arg.value !== undefined
    ? typeof arg.value === 'string'
      ? arg.value
      : JSON.stringify(arg.value)
    : (arg.description ?? arg.unserializableValue ?? String(arg.type))
/** Message d'une exception CDP : la description de l'erreur (pile comprise) ou son texte. */
const exceptionText = (details) =>
  details.exception?.description ?? details.exception?.value ?? details.text
let failures = 0
/** Contrôles en échec, dans l'ordre (annotations des suites indicatives, fiche 250). */
const failedLabels = []
/** Suite en cours (`run.mjs`) : son nom préfixe les captures d'échec (fiche 115). */
let suiteName = ''
export const setSuite = (name) => {
  suiteName = name
}
/** Nombre d'échecs depuis le début des essais. */
export const failureCount = () => failures
/** Contrôles en échec depuis le début des essais. */
export const failureLabels = () => [...failedLabels]
/** Échec hors `check` (exception d'une suite). */
export const fail = (label) => {
  console.log(`  ✗ ${label}`)
  failures++
  failedLabels.push(label)
  captureFailure(label)
}
export const check = (ok, label) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}`)
  if (!ok) {
    failures++
    failedLabels.push(label)
    captureFailure(label)
  }
}

/** App en cours d'essai : de quoi capturer l'écran au moment d'un échec. */
let current
const pendingCaptures = []

/** Capture, texte de la fenêtre et sortie de l'app, nommés d'après l'échec. */
function captureFailure(label) {
  if (!current) return
  const slug = label
    .normalize('NFD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  // Le nom de la suite : en parallèle, chaque processus compte ses échecs à partir de 1.
  const name = `echec-${suiteName ? `${suiteName}-` : ''}${String(failures).padStart(2, '0')}-${slug}`
  pendingCaptures.push(current.capture(name).catch(() => {}))
}

/**
 * Outils neutres par défaut : aucun essai ne touche le simulateur iOS, AXe ni le SDK Android réels
 * de la machine (un iPhone ou un émulateur démarré par l'utilisateur). Les suites qui en ont besoin
 * passent leurs propres faux outils.
 */
const neutral = mkdtempSync(join(tmpdir(), 'bob-e2e-outils-'))
const AGENTLESS_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'
mkdirSync(join(neutral, 'sdk', 'platform-tools'), { recursive: true })
mkdirSync(join(neutral, 'sdk', 'emulator'), { recursive: true })
for (const [file, script] of [
  [
    'xcrun',
    `#!/bin/sh\n[ "$2" = list ] && echo '{"devices":{}}'\n[ "$1" = xcodebuild ] && printf 'Xcode 26.0\\nBuild version 17A324\\n'\nexit 0\n`
  ],
  [
    'sdk/platform-tools/adb',
    '#!/bin/sh\n[ "$1" = devices ] && echo "List of devices attached"\nexit 0\n'
  ],
  ['sdk/emulator/emulator', '#!/bin/sh\nexit 0\n'],
  // Diagnostic des capacités : aucun vrai agent découvert, même s’il est installé sur le Mac.
  ['agentless-shell', `#!/bin/sh\nPATH=${AGENTLESS_PATH}\nexport PATH\nexec /bin/sh -c "$2"\n`],
  // Forges (fiche 037) : ni `gh` ni `glab` réels ; « introuvables » pour l'app.
  ['gh', '#!/bin/sh\nexit 1\n'],
  ['glab', '#!/bin/sh\nexit 1\n']
]) {
  writeFileSync(join(neutral, file), script)
  chmodSync(join(neutral, file), 0o755)
}
process.on('exit', () => rmSync(neutral, { recursive: true, force: true }))

/** Comme la suite diagnostic : un shell de connexion qui conserve le PATH sans agents réels. */
export const NEUTRAL_AGENT_ENV = {
  PATH: AGENTLESS_PATH,
  SHELL: join(neutral, 'agentless-shell')
}

/**
 * Apps lancées par les essais : arrêtées si le lanceur s'arrête lui-même (Ctrl+C, erreur, disque
 * plein…). Une app orpheline garderait sa sortie standard coupée et ses fichiers ouverts.
 */
const running = new Set()
process.on('exit', () => {
  for (const app of running) app.kill('SIGKILL')
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(130))
}
export const NEUTRAL_ENV = {
  // Langue des essais (`--lang`), quelle que soit celle de la machine (fiche 074).
  BOBINE_LANG: LANG,
  // L'agent factice parle la même langue (fiche 167) : ses textes ne sont pas traduits par l'app.
  MOCK_AGENT_LANG: LANG,
  // Texte de l'agent factice diffusé à 5 ms le morceau au lieu de 40 (fiche 279) : le scénario
  // `echo` rediffuse tout le contexte joint par l'app (jusqu'à 700 mots, 10 s par tour). Les
  // pauses des scénarios gardent le délai de base : les fenêtres « en cours » ne changent pas.
  // Une suite qui a besoin d'une diffusion lente le redit dans son environnement.
  MOCK_AGENT_CHUNK_MS: '5',
  // Fenêtre montrée sans prendre le focus de la machine (fiche 106) : l'utilisateur continue de
  // travailler à côté, ses frappes ne tombent pas dans l'app d'essai.
  BOBINE_SHOW_INACTIVE: '1',
  // Dossier personnel des fichiers des agents (serveurs MCP, fiche 025) : jamais les vrais.
  BOBINE_CONFIG_HOME: join(neutral, 'home'),
  BOBINE_XCRUN: join(neutral, 'xcrun'),
  // Vide : pas d'AXe (ni celui livré avec l'app, ni celui du PATH).
  BOBINE_AXE: '',
  ANDROID_HOME: join(neutral, 'sdk'),
  ANDROID_SDK_ROOT: join(neutral, 'sdk'),
  // Avis de nouvelle version (fiche 274) : jamais GitHub dans un essai. Vérification automatique
  // coupée, et l'adresse pointe vers un port local fermé (la suite `nouvelle-version` la remplace).
  BOBINE_UPDATE_CHECK: 'off',
  BOBINE_RELEASES_URL: 'http://127.0.0.1:9/repos/jlallement/bobine/releases'
}

/**
 * Réglages AppKit du lanceur (argument `-Nom valeur`, lu par macOS seulement pour ce processus) :
 * pas de restauration des fenêtres. Sans lui, après un essai tué en plein vol, macOS ouvre au
 * lancement suivant l'alerte « rouvrir les fenêtres ? » qui bloque l'app et tous les essais
 * suivants. L'app packagée et ses réglages n'en savent rien.
 */
export const APPKIT_ARGS = ['-ApplePersistenceIgnoreState', 'YES']

/**
 * Attente d'une page posée (voir `settled` dans `withApp`) : les animations qui finissent dans la
 * demi-seconde (fondu, menu qui s'ouvre, transition) sont terminées, puis deux images. Les plus
 * longues (avis qui s'efface en quelques secondes, décor) et les animations sans fin ne sont pas
 * attendues : une capture ne les attendait pas non plus. Fenêtre cachée : aucune image n'arrive,
 * chacune est bornée à 250 ms.
 */
const SETTLED = `(async () => {
  const moving = document.getAnimations().filter((a) => {
    if (a.playState !== 'running') return false
    const left = a.effect?.getComputedTiming().endTime - (Number(a.currentTime) || 0)
    return Number.isFinite(left) && left <= 500
  })
  await Promise.race([
    Promise.all(moving.map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 1000))
  ])
  for (let i = 0; i < 2; i++) {
    await new Promise((r) => {
      setTimeout(r, 250)
      requestAnimationFrame(() => r())
    })
  }
  return true
})()`

/** Lance l'app. `keep` : réutilise / conserve ce dossier de données (pour simuler un redémarrage). */
export async function withApp(
  scheme,
  fn,
  keep,
  scenario = 'demo',
  extraEnv = {},
  extraArgs = [],
  // `startError` : l'agent doit refuser de démarrer (fiche 198) ; on attend l'échec expliqué.
  { startError = false } = {}
) {
  const userData = keep ?? mkdtempSync(join(tmpdir(), 'bob-e2e-'))
  const app = spawn(
    electron,
    [
      root,
      `--user-data-dir=${userData}`,
      `--remote-debugging-port=${PORT}`,
      // Clés d'API (fiche 022) : trousseau simulé, jamais celui de l'utilisateur.
      '--use-mock-keychain',
      ...APPKIT_ARGS,
      ...extraArgs
    ],
    {
      env: {
        ...process.env,
        ...NEUTRAL_ENV,
        BOBINE_AGENT_PROFILE: 'mock',
        MOCK_AGENT_SCENARIO: scenario,
        ...extraEnv
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  running.add(app)
  app.once('exit', () => running.delete(app))
  // Sortie de l'app (journal du main process), gardée pour les échecs.
  let output = ''
  const keepOutput = (data) => {
    output = (output + data.toString()).slice(-64 * 1024)
  }
  app.stdout.on('data', keepOutput)
  app.stderr.on('data', keepOutput)
  try {
    // Fenêtre principale (pas la fenêtre rapide, fiche 062). Jusqu'à une minute : avec plusieurs
    // suites en parallèle (fiche 115) sur une machine chargée, le démarrage passe 20 s.
    const mainPage = (targets) =>
      targets.find((t) => t.type === 'page' && !t.url.includes('#quick'))
    let targets = []
    for (let i = 0; i < 240 && !mainPage(targets); i++) {
      await sleep(250)
      targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(
        (r) => r.json(),
        () => []
      )
    }
    if (!mainPage(targets)) {
      // Sans fenêtre, pas de capture d'échec : la fin de la sortie de l'app dit pourquoi (sans les
      // plaintes de Chromium sur D-Bus, absent sous xvfb).
      const tail = output
        .split('\n')
        .filter((line) => line && !line.includes(':ERROR:dbus/'))
        .slice(-15)
        .join('\n      ')
      throw new Error(
        `fenêtre de l'app absente au bout d'une minute (port ${PORT}${app.exitCode !== null ? `, app sortie : ${app.exitCode}` : ''})\n      ${tail}`
      )
    }
    const ws = new WebSocket(mainPage(targets).webSocketDebuggerUrl)
    await new Promise((r) => (ws.onopen = r))
    let id = 0
    const pending = new Map()
    const dialogs = []
    // Console du renderer (fiche 106) : les 200 dernières lignes accompagnent une capture d'échec.
    const consoleLines = []
    const consoleLine = (at, level, text) => {
      consoleLines.push(`${new Date(at).toISOString().slice(11, 23)} ${level.padEnd(7)} ${text}`)
      if (consoleLines.length > CONSOLE_LINES) consoleLines.shift()
    }
    // Une minute au plus par commande : une page qui ne répond plus (capture d'écran sans image,
    // renderer figé) devient un échec capturé au lieu d'une suite bloquée sans trace (fiche 115).
    const cdp = (method, params = {}) =>
      within(
        new Promise((r) => {
          const i = ++id
          pending.set(i, r)
          ws.send(JSON.stringify({ id: i, method, params }))
        }),
        60_000,
        `protocole DevTools : ${method} sans réponse`
      )
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.method === 'Page.javascriptDialogOpening') {
        dialogs.push(d.params.message)
        void cdp('Page.handleJavaScriptDialog', { accept: true })
      }
      if (d.method === 'Runtime.consoleAPICalled') {
        const { type, args, timestamp } = d.params
        consoleLine(timestamp, type, args.map(remoteValue).join(' '))
      }
      if (d.method === 'Runtime.exceptionThrown') {
        const { timestamp, exceptionDetails } = d.params
        consoleLine(timestamp, 'error', exceptionText(exceptionDetails))
      }
      if (d.method === 'Log.entryAdded') {
        const { timestamp, level, text, url } = d.params.entry
        consoleLine(timestamp, level, url ? `${text} (${url})` : text)
      }
      pending.get(d.id)?.(d)
      pending.delete(d.id)
    }
    await cdp('Page.enable')
    await cdp('Runtime.enable')
    await cdp('Log.enable')
    // La fenêtre n'est jamais au premier plan (`BOBINE_SHOW_INACTIVE`, fiche 106) : la page doit se
    // croire active, sinon la saisie envoyée par CDP est perdue.
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
    await cdp('Emulation.setEmulatedMedia', { features: mediaFeatures(scheme) })
    /** Évalue dans la page ; une exception de la page est levée telle quelle (fiche 106). */
    const ev = async (expression) => {
      const r = await cdp('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      })
      const { exceptionDetails, result } = r.result ?? {}
      if (exceptionDetails) {
        throw new Error(`erreur dans la page : ${exceptionText(exceptionDetails)} — ${expression}`)
      }
      return result?.value
    }
    /**
     * Attend qu'une expression soit vraie. Une exception en cours de route (élément pas encore là)
     * compte comme « pas encore » ; passé le délai, la dernière est dite avec l'expression.
     */
    const waitFor = async (expression, ms = 15000) => {
      const start = Date.now()
      let lastError
      while (Date.now() - start < ms) {
        try {
          if (await ev(expression)) return true
          lastError = undefined
        } catch (error) {
          lastError = error
        }
        await sleep(100)
      }
      throw new Error(
        `délai dépassé : ${expression}${lastError ? ` (dernière erreur : ${lastError.message})` : ''}`
      )
    }
    const $ = (testId) => `document.querySelector('[data-testid="${testId}"]')`
    /** Une image du renderer : les évènements envoyés avant sont traités (fiche 115). */
    const frame = () => ev(`new Promise((r) => requestAnimationFrame(() => r(true)))`)
    /**
     * Page posée avant une capture (fiche 279, au lieu d'un quart de seconde fixe) : les animations
     * courtes en cours terminées, puis deux images rendues (`SETTLED`).
     */
    const settled = () => ev(SETTLED)
    /** Largeur de la fenêtre avant toute émulation (`ui.viewport`). */
    let naturalWidth
    /**
     * Centre d'un élément amené dans la partie visible de son conteneur, et immobile : une boîte de
     * dialogue ou un menu qui s'ouvre encore (animation) déplacerait la cible sous le pointeur.
     */
    const center = async (selector) => {
      // L'élément peut encore manquer (menu qui s'ouvre) : on l'attend avant de le viser.
      await waitFor(`!!(${selector})`)
      return ev(
        `(async () => {
          const el = ${selector}
          el.scrollIntoView({ block: 'nearest' })
          // Animation d'ouverture (menu, fondu) d'un parent : sa fin d'abord. Sur une machine
          // chargée, elle reste plusieurs centaines de ms sur sa première image, que les deux
          // mesures égales ci-dessous prenaient pour la place finale (fiche 234 : 6 px plus bas).
          const moving = () =>
            document.getAnimations().filter((a) => {
              const target = a.effect?.target
              return (
                a.playState === 'running' &&
                target?.contains?.(el) &&
                a.effect.getComputedTiming().endTime !== Infinity
              )
            })
          await Promise.race([
            Promise.all(moving().map((a) => a.finished.catch(() => {}))),
            new Promise((r) => setTimeout(r, 2000))
          ])
          const center = () => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
          let last = center()
          for (let i = 0; i < 30; i++) {
            // Fenêtre cachée : aucune image n'arrive ; borné pour ne pas attendre sans fin.
            await new Promise((r) => {
              setTimeout(r, 250)
              requestAnimationFrame(() => requestAnimationFrame(r))
            })
            const next = center()
            if (next.x === last.x && next.y === last.y) break
            last = next
          }
          return last
        })()`
      )
    }
    /**
     * Vues natives de la fenêtre (page du navigateur intégré), composées sur la capture du
     * renderer (fiche 129) : sans elles, la zone de la page est vide sur les captures. Il faut
     * l'inspecteur du main (`--inspect`), d'où la capture seule pour les suites qui ne l'ont pas.
     */
    const inspected = extraArgs.some((arg) => String(arg).startsWith('--inspect'))
    let main
    /**
     * État réel des pages du navigateur intégré, joint aux échecs (macOS CI 2026-11-24 : onglet neuf
     * resté « en chargement », cause non établie) : processus de rendu lancé (`pid`), page validée
     * ou non (`url`), réponse attendue, débogueur attaché (`cdp-tab.ts`, `whenReady`). Les pages
     * des fenêtres sont écartées par leur `id` : celles d'un `WebContentsView` (onglets) ont aussi le
     * type `window` (relevé sur Electron 45, fiche 250), le filtre par type les cachait toutes.
     */
    const mainPages = async () => {
      try {
        main ??= await mainProcess()
        const found = await main.evaluate(`(() => {
          const { BrowserWindow, webContents } = require('electron')
          const windows = BrowserWindow.getAllWindows()
          const own = new Set(windows.map((w) => w.webContents.id))
          const shown = new Map()
          for (const w of windows) {
            for (const v of w.contentView.children) if (v.webContents) shown.set(v.webContents.id, v.getVisible())
          }
          const pages = webContents.getAllWebContents().filter((w) => !own.has(w.id)).map((w) => ({ id: w.id, type: w.getType(), url: w.getURL(), title: w.getTitle(), loading: w.isLoading(), waitingForResponse: w.isWaitingForResponse(), crashed: w.isCrashed(), pid: w.getOSProcessId(), debugger: w.debugger.isAttached(), viewVisible: shown.get(w.id), backgroundThrottling: w.getBackgroundThrottling() }))
          return { pages, windowPids: windows.map((w) => w.webContents.getOSProcessId()) }
        })()`)
        const pages = found?.pages ?? []
        if (!pages.length) return '(aucune)'
        // Priorité des processus de rendu des onglets, à côté de celle des fenêtres (macOS : un
        // rendu caché peut passer en arrière-plan, CPU et disque bridés) : piste de la page cachée
        // qui ne finit pas de charger sur une VM chargée (fiche 250).
        const pids = [...pages.map((p) => p.pid), ...(found?.windowPids ?? [])].filter(
          (pid) => pid > 0
        )
        let priorities = ''
        try {
          if (pids.length) {
            priorities = execFileSync('ps', ['-o', 'pid=,pri=,stat=,%cpu=', '-p', pids.join(',')], {
              encoding: 'utf8'
            })
          }
        } catch (error) {
          priorities = `(ps illisible : ${error.message})`
        }
        return [
          ...pages.map((p) => JSON.stringify(p)),
          priorities.trim() && `ps (pid pri stat %cpu) :\n${priorities.trim()}`
        ]
          .filter(Boolean)
          .join('\n')
      } catch (error) {
        return `(illisible : ${error.message})`
      }
    }
    const withNativeViews = async (png) => {
      if (!inspected) return png
      main ??= await mainProcess()
      const native = await main.evaluate(`(async () => {
        const { BrowserWindow } = require('electron')
        const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.contentView.children.some((v) => v.getVisible()))
        if (!win) return null
        const views = win.contentView.children.filter((v) => v.getVisible())
        return {
          width: win.getContentBounds().width,
          views: await Promise.all(views.map(async (v) => ({ bounds: v.getBounds(), png: (await v.webContents.capturePage()).toPNG().toString('base64') })))
        }
      })()`)
      if (!native?.views.length) return png
      return ev(`(async () => {
        const load = (b64) => createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' }))
        const base = await load(${JSON.stringify(png)})
        const k = base.width / ${native.width}
        const canvas = new OffscreenCanvas(base.width, base.height)
        const g = canvas.getContext('2d')
        g.drawImage(base, 0, 0)
        for (const v of ${JSON.stringify(native.views)}) {
          g.drawImage(await load(v.png), v.bounds.x * k, v.bounds.y * k, v.bounds.width * k, v.bounds.height * k)
        }
        const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())
        let text = ''
        for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return btoa(text)
      })()`)
    }
    /**
     * Amène un élément à l'écran avant un clic, comme un utilisateur : rien s'il y est déjà (à
     * l'arrondi de la mise en page près) ; sinon au milieu de ce qui le fait défiler, et l'on
     * attend qu'il y soit. Au milieu, pas au plus près : remonté de moins de 60 px, le fil se
     * croit encore en bas et y revient à la prochaine nouveauté (`useThreadScroll`) ; le clic
     * tombait alors à côté (fiche 145).
     */
    const reveal = (selector) =>
      waitFor(`(() => {
        const el = ${selector}
        if (!el) return false
        const box = () => el.closest('.scroll')?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight }
        const shown = () => {
          const r = el.getBoundingClientRect()
          return r.top >= box().top - 1 && r.bottom <= box().bottom + 1
        }
        if (shown()) return true
        el.scrollIntoView({ block: 'center' })
        return shown()
      })()`)
    /**
     * L'élément (ou l'un de ses descendants) est-il ce que le pointeur touche en `box` ? Un parent
     * compte aussi pour une cible en `pointer-events: none`, qui laisse passer à son conteneur.
     */
    const underPointer = (selector, box) =>
      ev(`(() => {
        // Ce que touchent l'appui, le relâché et le clic (fiche 250) : relevé par \`clickTrail\`.
        if (!window.__e2ePress) {
          const trail = (window.__e2ePress = { down: null, up: null, click: null })
          addEventListener('pointerdown', (e) => (trail.down = e.target), true)
          addEventListener('pointerup', (e) => (trail.up = e.target), true)
          addEventListener('click', (e) => (trail.click = e.target), true)
        }
        Object.assign(window.__e2ePress, { down: null, up: null, click: null })
        const el = ${selector}
        const hit = document.elementFromPoint(${box.x}, ${box.y})
        if (!el || !hit || el.contains(hit)) return true
        return getComputedStyle(el).pointerEvents === 'none' && hit.contains(el)
      })()`).catch(() => true)
    /**
     * Le dernier clic a-t-il manqué sa cible (fiche 250) ? Dit où sont tombés l'appui, le relâché et
     * le clic, sinon rien. Un fil qui défile entre la visée et l'appui, ou entre l'appui et le
     * relâché, perd le clic sans bruit ; l'essai échouait plus loin, sur une attente sans rapport.
     */
    const clickTrail = (selector) =>
      ev(`(() => {
        const el = ${selector}
        const trail = window.__e2ePress
        if (!el || !trail) return null
        const on = (t) => !!t && (!t.isConnected || el.contains(t) || (getComputedStyle(el).pointerEvents === 'none' && t.contains(el)))
        if (on(trail.down) && on(trail.up) && on(trail.click)) return null
        const name = (t) => !t ? 'rien' : t.tagName.toLowerCase() + (t.dataset?.testid ? '[' + t.dataset.testid + ']' : '') + (typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + ' « ' + (t.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 40) + ' »'
        return 'appui sur ' + name(trail.down) + ', relâché sur ' + name(trail.up) + ', clic sur ' + name(trail.click)
      })()`).catch(() => null)
    const ui = {
      ev,
      waitFor,
      $,
      // Sortie de l'app jusqu'ici (journal du main, 64 Kio au plus) : erreurs IPC (recette rc.4).
      output: () => output,
      // Protocole DevTools brut : images de la vidéo de la vitrine (fiche 225).
      cdp,
      dialogs,
      // Le point d'état de l'agent dans la barre latérale (pas ceux de Réglages › Agents).
      ready: () => waitFor(`!!document.querySelector('${AGENT_DOT}.ready')`),
      reveal,
      shot: async (name) => {
        await settled()
        const r = await cdp('Page.captureScreenshot', { format: 'png' })
        const png = await withNativeViews(r.result.data)
        writeFileSync(captureFile(name, scheme, 'png'), Buffer.from(png, 'base64'))
      },
      send: async (text) => {
        const users = `document.querySelectorAll('.msg-user').length`
        const before = await ev(users)
        const input = `${$('composer-input')}.value`
        // Le texte attendu après la frappe : ce qui est là, la sélection remplacée par le texte.
        const expected = await ev(
          `(() => { const i = ${$('composer-input')}; return i.value.slice(0, i.selectionStart) + ${JSON.stringify(text)} + i.value.slice(i.selectionEnd) })()`
        )
        await ev(`${$('composer-input')}.focus()`)
        await cdp('Input.insertText', { text })
        // Ce qui part est exactement ce qui a été demandé : une frappe parasite (focus de la machine,
        // raccourci) se verrait ici, pas dans un scénario inattendu plus loin (fiche 106).
        const typed = await ev(input)
        if (typed !== expected) {
          throw new Error(`zone de saisie : « ${typed} » au lieu de « ${expected} »`)
        }
        const enter = async () => {
          // Le focus a pu repartir entre-temps (un menu qui se ferme le rend à son bouton, avec un
          // léger retard) : Entrée ne doit pas tomber ailleurs que dans la zone de saisie.
          await ev(`${$('composer-input')}.focus()`)
          for (const type of ['keyDown', 'keyUp']) {
            await cdp('Input.dispatchKeyEvent', {
              type,
              key: 'Enter',
              code: 'Enter',
              windowsVirtualKeyCode: 13,
              text: type === 'keyDown' ? '\r' : undefined
            })
          }
        }
        await enter()
        // Le message est parti (le tour a commencé, et peut même être déjà fini) : un ready()
        // ultérieur attendra donc bien la fin de la réponse. Entrée perdue sur une machine
        // chargée : le texte attend encore dans la zone de saisie, on l'envoie une seconde fois.
        try {
          await waitFor(`${users} > ${before}`, 5000)
        } catch {
          if (await ev(`${$('composer-input')}.value.trim() !== ''`)) await enter()
          await waitFor(`${users} > ${before}`)
        }
      },
      // Vrai clic souris (les menus Radix réagissent au pointeur, pas à element.click()).
      click: async (selector) => {
        // Bouton d'une carte d'autorisation : un clic réel n'y compte qu'une fois armé (400 ms
        // sans défilement, anti-clic accidentel, 0.11 M1). On attend, comme un humain.
        await waitFor(
          `!(${selector})?.closest?.('[data-testid=permission]:not([data-armed])')`,
          5000
        )
        let box = await center(selector)
        // Comme une vraie souris : amenée sur la cible avant d'appuyer. Sans ce mouvement, sous
        // charge (suites en parallèle, fiche 115), un appui isolé sur un élément de menu Radix ou
        // une poignée est parfois perdu.
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
        await frame()
        // Et l'on regarde, comme un humain, ce qui est sous le pointeur avant d'appuyer (fiche 250) :
        // une nouveauté du fil (compte rendu, pied « Terminé ») arrivée après la mesure le fait
        // défiler, et l'appui tombait à côté (Linux, `filles-tech-lead`, `fil`). Visé de nouveau,
        // au plus deux fois ; une cible vraiment recouverte reçoit l'appui comme avant.
        for (let aim = 0; aim < 2 && !(await underPointer(selector, box)); aim++) {
          await reveal(selector).catch(() => {})
          box = await center(selector)
          await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
          await frame()
        }
        for (const type of ['mousePressed', 'mouseReleased']) {
          await cdp('Input.dispatchMouseEvent', {
            type,
            x: box.x,
            y: box.y,
            button: 'left',
            clickCount: 1
          })
        }
        // Dit, sans échouer : le clic perdu se voit alors à côté de l'attente qui en échoue.
        const missed = await clickTrail(selector)
        if (missed) console.log(`    ⚠ clic manqué : ${missed}`)
      },
      // Vrai clic souris à un point de la fenêtre, sans viser d'élément (ce qui est dessous le prend).
      clickAt: async (at) => {
        for (const type of ['mousePressed', 'mouseReleased']) {
          await cdp('Input.dispatchMouseEvent', { type, ...at, button: 'left', clickCount: 1 })
        }
      },
      // Souris amenée à un point, sans clic (survol : infobulles).
      hover: (at) => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at }),
      center,
      /**
       * Fenêtre émulée à cette largeur (fiche 092 : demi-écran, plus étroit que la fenêtre ne le
       * permet) ; sans largeur, retour à la vraie taille.
       */
      /**
       * Préférences d'affichage de macOS émulées en plus du mode des essais (fiche 226) :
       * `{ 'prefers-reduced-transparency': 'reduce' }`, `{ 'prefers-contrast': 'more' }` ; sans
       * rien, retour aux valeurs par défaut (`mediaFeatures`).
       */
      media: async (features = {}) => {
        await cdp('Emulation.setEmulatedMedia', { features: mediaFeatures(scheme, features) })
        // Styles recalculés au rendu des deux images suivantes (fiche 279, au lieu de 150 ms fixes).
        await frame()
        await frame()
      },
      /**
       * Deux images rendues (fiche 250) : ce qui ne se met à jour qu'au rendu d'une image (lignes
       * de temps de défilement, `ResizeObserver`) est alors à jour. Sur une machine chargée
       * (runner macOS de GitHub), aucune image n'arrive parfois en 150 ou 300 ms.
       */
      frames: async () => {
        await frame()
        await frame()
      },
      viewport: async (width, height = 820) => {
        // Largeur de la vraie fenêtre, relevée avant la première émulation : celle qui revient.
        naturalWidth ??= await ev('innerWidth')
        if (width) {
          await cdp('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 0,
            mobile: false
          })
        } else await cdp('Emulation.clearDeviceMetricsOverride')
        // La page a pris sa nouvelle largeur (fiche 279, au lieu de 300 ms fixes) ; sans largeur,
        // celle de la vraie fenêtre.
        await waitFor(`innerWidth === ${width || naturalWidth}`, 5000)
        // Deux images rendues à la nouvelle taille (fiche 250) : les `ResizeObserver` de la page
        // (repli de la barre de saisie…) ne passent qu'au rendu d'une image, et une machine chargée
        // n'en produit parfois aucune en 300 ms (runner macOS de GitHub).
        await frame()
        await frame()
      },
      enter: async () => {
        for (const type of ['keyDown', 'keyUp']) {
          await cdp('Input.dispatchKeyEvent', {
            type,
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13,
            text: type === 'keyDown' ? '\r' : undefined
          })
        }
      },
      // Glisser à la souris d'un point à un autre (poignée de redimensionnement…).
      // Une image entre deux mouvements : sur une machine chargée, le relâcher arrivait avant que
      // la page ait traité les derniers (fiche 115 : largeur de la barre latérale à mi-chemin).
      drag: async (from, to) => {
        await cdp('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...from,
          button: 'left',
          clickCount: 1
        })
        await frame()
        for (let i = 1; i <= 5; i++) {
          await cdp('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: from.x + ((to.x - from.x) * i) / 5,
            y: from.y + ((to.y - from.y) * i) / 5,
            button: 'left',
            buttons: 1
          })
          await frame()
        }
        await cdp('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...to,
          button: 'left',
          clickCount: 1
        })
      },
      // Bouton de la souris tenu à un point, sans bouger (appui long).
      hold: async (at, ms) => {
        await cdp('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...at,
          button: 'left',
          clickCount: 1
        })
        await sleep(ms)
        await cdp('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...at,
          button: 'left',
          clickCount: 1
        })
      },
      /**
       * Crans de molette (ou trackpad) à un point, puis l'on attend que la page les ait reçus
       * (fiche 250). Chromium rend la main dès que son compositeur a pris la molette ; l'évènement
       * `wheel` n'arrive au fil principal de la page qu'ensuite, très en retard sur une machine
       * chargée. Il désarmait alors une carte d'autorisation (`useArmedCard`) après que l'essai
       * l'avait vue armée, et le clic qui suivait était refusé (Linux, `autorisation-commande`).
       */
      wheel: async (at, deltaX, deltaY) => {
        const seen = await ev(`(() => {
          if (!window.__e2eWheels) {
            window.__e2eWheels = { count: 0 }
            addEventListener('wheel', () => window.__e2eWheels.count++, { capture: true, passive: true })
          }
          return window.__e2eWheels.count
        })()`)
        await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', ...at, deltaX, deltaY })
        await waitFor(`window.__e2eWheels.count > ${seen}`)
      },
      type: (text) => cdp('Input.insertText', { text }),
      /** Temps cumulés du renderer (`Performance.getMetrics`), en millisecondes, par nom. */
      metrics: async () => {
        await cdp('Performance.enable')
        const r = await cdp('Performance.getMetrics')
        return Object.fromEntries(r.result.metrics.map((m) => [m.name, m.value * 1000]))
      },
      /**
       * Glisser des fichiers du Finder jusqu'au point (x, y) et les y déposer (vrai glisser-déposer
       * de Chromium). `drop: false` : s'arrête au survol (pour voir l'indication).
       */
      dragFiles: async (files, point, { drop = true } = {}) => {
        const data = { items: [], files, dragOperationsMask: 1 }
        await cdp('Input.dispatchDragEvent', { type: 'dragEnter', ...point, data })
        await cdp('Input.dispatchDragEvent', { type: 'dragOver', ...point, data })
        if (drop) await cdp('Input.dispatchDragEvent', { type: 'drop', ...point, data })
      },
      dragCancel: (point) =>
        cdp('Input.dispatchDragEvent', {
          type: 'dragCancel',
          ...point,
          data: { items: [], dragOperationsMask: 1 }
        }),
      key: (key) =>
        cdp('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key,
          code: key,
          windowsVirtualKeyCode: { Escape: 27, Enter: 13 }[key] ?? 0
        }),
      // Touche avec modificateurs (8 = Maj), keyDown puis keyUp.
      press: async (key, modifiers = 0) => {
        const code =
          { Tab: 'Tab', Enter: 'Enter', '`': 'Backquote' }[key] ??
          (/^\d$/.test(key) ? `Digit${key}` : key)
        const vk =
          { Tab: 9, Enter: 13, Escape: 27, '`': 192 }[key] ??
          (/^\d$/.test(key) ? 48 + Number(key) : 0)
        for (const type of ['keyDown', 'keyUp']) {
          await cdp('Input.dispatchKeyEvent', {
            type,
            key,
            code,
            modifiers,
            windowsVirtualKeyCode: vk
          })
        }
      },
      /**
       * Flèche avec son code de touche (fiche 227) : le navigateur fait aussi son geste natif
       * (le curseur monte ou descend d'une ligne dans une zone de saisie) si la page ne l'empêche
       * pas. `press` envoie un code nul, sans geste natif.
       */
      arrow: async (key) => {
        const vk = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 }[key]
        for (const type of ['rawKeyDown', 'keyUp']) {
          await cdp('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: vk })
        }
      },
      /**
       * Ferme le panneau de droite s'il est ouvert (fiche 166 : il s'ouvre de lui-même sur
       * « Session » au premier message) ; fermé à la main, il reste fermé pour la conversation.
       */
      closePanel: async () => {
        if (!(await ev(`!!${$('side-panel')}`))) return
        await ui.click(`${$('side-panel')}.querySelector('[aria-label="${L('sidePanel.close')}"]')`)
        await waitFor(`!${$('side-panel')}`)
      },
      lastAgentText: () =>
        ev(`[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText ?? ''`),
      lastTool: () =>
        ev(
          `(() => { const t = [...document.querySelectorAll('[data-testid=tool]')].at(-1); return { status: t?.dataset.status, answer: t?.querySelector('[data-testid=permission-answer]')?.innerText } })()`
        )
    }
    // Prêt, ou en attente d'une action (dossier à approuver, connexion…).
    await waitFor(
      startError
        ? `!!document.querySelector('${AGENT_DOT}.error')`
        : `!!document.querySelector('${AGENT_DOT}.ready, ${AGENT_DOT}.needs-action')`
    )
    current = {
      capture: async (name) => {
        const r = await cdp('Page.captureScreenshot', { format: 'png' })
        if (r.result?.data) {
          // La page du navigateur aussi, si on peut ; sinon la capture seule.
          const png = await withNativeViews(r.result.data).catch(() => r.result.data)
          writeFileSync(captureFile(name, scheme, 'png'), Buffer.from(png, 'base64'))
        }
        const text = await ev(`document.body.innerText`).catch(() => '')
        writeFileSync(
          captureFile(name, scheme, 'txt'),
          [
            `--- Texte de la fenêtre ---\n${text ?? ''}`,
            `--- Console du renderer (${consoleLines.length} dernières lignes) ---\n${consoleLines.join('\n')}`,
            `--- Sortie de l'app (journal du main) ---\n${output}`,
            ...(inspected ? [`--- Pages du main (hors fenêtres) ---\n${await mainPages()}`] : [])
          ].join('\n\n')
        )
      }
    }
    try {
      await fn(ui)
    } catch (error) {
      fail(error.message)
      throw Object.assign(error, { reported: true })
    } finally {
      await Promise.all(pendingCaptures.splice(0))
      current = undefined
      main?.close()
    }
  } finally {
    // Déjà arrêtée (plantage) : rien à attendre ; sinon SIGTERM, puis SIGKILL au bout de 5 s.
    if (app.exitCode === null && app.signalCode === null) {
      const exited = new Promise((r) => app.once('exit', r))
      app.kill()
      const timer = setTimeout(() => app.kill('SIGKILL'), 5000)
      await exited
      clearTimeout(timer)
    }
    // Rien ne survit à l'app (fiche 208) : ses processus (agents, essais du diagnostic, flux…) sont
    // arrêtés en quittant ; un survivant fait échouer l'essai, en le nommant.
    //
    // Sauf `chrome_crashpad_handler` : l'assistant d'Electron (pas lancé par Bobine) qui recueille
    // les plantages, base dans `<données>/crash-dumps`. Il sort de lui-même, mais pas toujours
    // aussitôt : il reste tant qu'un processus né de l'app vit encore (même hors de nos dossiers),
    // ou le temps de son propre arrêt sur une machine chargée. On l'attend plus longtemps (10 s)
    // avant de supprimer le dossier qu'il utilise, sans échouer pour lui ; resté au-delà, il est
    // arrêté (il cite ce dossier jetable : c'est bien le nôtre).
    //
    // Restent seuls des processus de Chromium nés de l'app (`--type=`, service réseau…) : ils
    // sortent d'eux-mêmes après elle, parfois au-delà de 3 s sur un runner chargé (macOS CI,
    // `filles-tech-lead` 2026-11-23, `parcours-outils` 2026-11-24, fiche 250). Attendus 10 s en
    // tout, comme crashpad ; encore là ensuite, l'essai échoue comme pour les autres.
    let survivors = processesUsing(userData)
    const lingering = () => survivors.filter((line) => !isCrashpad(line))
    let waited = 0
    for (; waited < 3000 && lingering().length > 0; waited += 100) {
      await sleep(100)
      survivors = processesUsing(userData)
    }
    while (waited < 10_000 && lingering().length > 0 && lingering().every(isChromiumHelper)) {
      await sleep(100)
      waited += 100
      survivors = processesUsing(userData)
    }
    const ours = lingering()
    if (ours.length > 0 && !keep) {
      // Les nôtres (ils citent ce dossier jetable) : arrêtés, puis l'essai échoue en les nommant.
      killAll(ours)
      await sleep(200)
      await settleCrashpad(userData)
      removeUserData(userData)
      throw new Error(
        `processus encore vivants ${Math.round(waited / 1000)} s après l'app :\n    ${ours.join('\n    ')}`
      )
    }
    if (!keep) await settleCrashpad(userData)
    if (!keep) removeUserData(userData)
  }
}

/** L'assistant de plantages d'Electron (voir la fin de `withApp`). */
const isCrashpad = (line) => line.includes('chrome_crashpad_handler')

/** Processus de Chromium lancé par Electron pour l'app (utilitaire, rendu, GPU) : pas par Bobine. */
const isChromiumHelper = (line) => !isCrashpad(line) && /\s--type=[a-z-]+/.test(line)

function killAll(lines) {
  for (const line of lines) {
    try {
      process.kill(Number(line.split(/\s+/)[0]), 'SIGKILL')
    } catch {}
  }
}

/** Attend (10 s au plus) que le crashpad d'Electron lâche ce dossier, sinon l'arrête. */
async function settleCrashpad(dir) {
  let left = processesUsing(dir).filter(isCrashpad)
  for (let i = 0; i < 100 && left.length > 0; i++) {
    await sleep(100)
    left = processesUsing(dir).filter(isCrashpad)
  }
  if (left.length > 0) {
    console.log(`  (crashpad d'Electron encore là après 10 s : arrêté)`)
    killAll(left)
    await sleep(200)
  }
}

/** Processus dont la ligne de commande mentionne ce dossier (l'app est sortie : il n'en reste aucun). */
export function processesUsing(dir) {
  try {
    return execFileSync('ps', ['-axww', '-o', 'pid=,pgid=,command='], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => line.includes(dir))
      .map((line) => line.trim())
  } catch {
    return []
  }
}

/**
 * Dossier de données supprimé. Un échec (ENOTEMPTY : quelqu'un y écrit encore) dit ce qui reste et
 * qui l'utilise, au lieu d'un message sans indice.
 */
function removeUserData(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (error) {
    let left = []
    try {
      left = readdirSync(dir, { recursive: true }).slice(0, 40)
    } catch {}
    const users = processesUsing(dir)
    error.message += `\n    reste : ${left.join(', ') || '(rien)'}\n    processus : ${users.join(' ; ') || '(aucun)'}`
    throw error
  }
}

/**
 * Autre page de l'app (fenêtre rapide, fiche 062) : la première dont l'adresse contient `part`.
 * Juste ce qu'il faut pour la piloter : évaluer, attendre, cliquer, écrire, touches, capture.
 */
export async function attachPage(part, scheme) {
  let target
  for (let i = 0; i < 40 && !target; i++) {
    const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(
      (r) => r.json(),
      () => []
    )
    target = targets.find((t) => t.type === 'page' && t.url.includes(part))
    if (!target) await sleep(250)
  }
  if (!target) throw new Error(`page introuvable : ${part}`)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    pending.get(d.id)?.(d)
    pending.delete(d.id)
  }
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id
      pending.set(i, r)
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  await cdp('Page.enable')
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cdp('Emulation.setEmulatedMedia', { features: mediaFeatures(scheme) })
  const ev = async (expression) =>
    (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result
      .result.value
  const waitFor = async (expression, ms = 15000) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await ev(expression)) return true
      await sleep(100)
    }
    throw new Error(`délai dépassé : ${expression}`)
  }
  const press = async (key) => {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp('Input.dispatchKeyEvent', {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: { Escape: 27, Enter: 13 }[key] ?? 0,
        ...(type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {})
      })
    }
  }
  return {
    ev,
    waitFor,
    $: (testId) => `document.querySelector('[data-testid="${testId}"]')`,
    click: async (selector) => {
      // Carte d'autorisation : armée avant un clic réel (0.11 M1, voir plus haut).
      await waitFor(`!(${selector})?.closest?.('[data-testid=permission]:not([data-armed])')`, 5000)
      const box = await ev(
        `(() => { const b = ${selector}.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`
      )
      for (const type of ['mousePressed', 'mouseReleased']) {
        await cdp('Input.dispatchMouseEvent', { type, ...box, button: 'left', clickCount: 1 })
      }
    },
    type: (text) => cdp('Input.insertText', { text }),
    press,
    // Glisser à la souris d'un point à un autre (dessin, fiche 067).
    drag: async (from, to) => {
      const frame = () => ev(`new Promise((r) => requestAnimationFrame(() => r(true)))`)
      await cdp('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        ...from,
        button: 'left',
        clickCount: 1
      })
      await frame()
      for (let i = 1; i <= 5; i++) {
        await cdp('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: from.x + ((to.x - from.x) * i) / 5,
          y: from.y + ((to.y - from.y) * i) / 5,
          button: 'left',
          buttons: 1
        })
        await frame()
      }
      await cdp('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        ...to,
        button: 'left',
        clickCount: 1
      })
    },
    shot: async (name) => {
      await ev(SETTLED)
      const r = await cdp('Page.captureScreenshot', { format: 'png' })
      writeFileSync(captureFile(name, scheme, 'png'), Buffer.from(r.result.data, 'base64'))
    },
    close: () => ws.close()
  }
}

/**
 * Évalue du code dans le processus principal (lancé avec `--inspect=MAIN_PORT`) : `require` y est
 * disponible. Renvoie la fonction d'évaluation et de quoi fermer la connexion.
 */
/** Promesse qui échoue au bout de `ms` au lieu d'attendre toujours. */
function within(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${ms / 1000} s)`)), ms)
    })
  ]).finally(() => clearTimeout(timer))
}

export async function mainProcess() {
  let targets = []
  for (let i = 0; i < 40 && !targets.length; i++) {
    targets = await fetch(`http://127.0.0.1:${MAIN_PORT}/json/list`).then(
      (r) => r.json(),
      () => []
    )
    if (!targets.length) await sleep(250)
  }
  if (!targets.length) throw new Error(`process principal injoignable (port ${MAIN_PORT})`)
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
  await within(
    new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('connexion au process principal refusée'))
    }),
    10_000,
    'connexion au process principal'
  )
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    pending.get(d.id)?.(d)
    pending.delete(d.id)
  }
  const evaluate = (expression) =>
    within(
      new Promise((r) => {
        const i = ++id
        pending.set(i, (d) => r(d.result?.result?.value))
        ws.send(
          JSON.stringify({
            id: i,
            method: 'Runtime.evaluate',
            params: {
              expression,
              includeCommandLineAPI: true,
              returnByValue: true,
              awaitPromise: true
            }
          })
        )
      }),
      30_000,
      'évaluation dans le process principal'
    )
  return { evaluate, close: () => ws.close() }
}

/**
 * « ↓ N nouveaux » de façon déterministe (fiche 185, P8) : l'agent (`fil-long-relu`) écrit un long
 * fil puis attend un fichier ; l'essai relit plus haut à la molette, comme un utilisateur, attend
 * que l'app le sache (« ↓ » visible), et seulement alors retire le fichier : les réponses qui
 * suivent arrivent forcément après la relecture. Avant, l'essai remontait le fil à chaque sondage
 * pendant que l'agent écrivait : sur une machine lente, le fil entier était rendu d'un coup, après
 * la dernière réponse, et rien de « nouveau » n'arrivait plus.
 */
export async function readUpWhileAgentWrites(ui) {
  const workspace = await ui.ev(
    `window.api.conversations.get().then((s) => s.conversations.find((c) => c.id === s.activeId)?.workspace ?? '')`
  )
  if (!workspace) throw new Error('readUpWhileAgentWrites : dossier de la conversation inconnu')
  const marker = join(workspace, 'relecture.attente')
  writeFileSync(marker, '')
  // Les fils longs déjà là (un `fil-long` plus haut) : on attend celui de ce tour.
  const step30 = `(document.querySelector('.thread').textContent.split(${JSON.stringify(M('Étape 30'))}).length - 1)`
  const before = await ui.ev(step30)
  try {
    await ui.send('/scenario fil-long-relu')
    const scroller = `document.querySelector('.thread').closest('.scroll')`
    // Le long fil est rendu en entier (l'agent attend le fichier) et dépasse la fenêtre.
    await ui.waitFor(
      `${step30} > ${before} && ${scroller}.scrollHeight > ${scroller}.clientHeight + 120`,
      60_000
    )
    const at = await ui.ev(
      `(() => { const r = ${scroller}.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 3) } })()`
    )
    await ui.wheel(at, 0, -4000)
    await ui.waitFor(`!!document.querySelector('[data-testid="scroll-to-bottom"]')`, 10_000)
  } finally {
    rmSync(marker, { force: true })
  }
  await ui.waitFor(
    `/\\d/.test(document.querySelector('[data-testid="scroll-to-bottom"]')?.innerText ?? '')`,
    20_000
  )
}
