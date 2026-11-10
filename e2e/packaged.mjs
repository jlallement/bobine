/**
 * Essai de l'app packagée (fiche 012) : lance dist/…/Bobine.app comme le ferait le Finder
 * (environnement minimal, PATH réduit), avec un dossier de données jetable, et vérifie qu'elle
 * démarre, retrouve les agents de la machine, n'embarque pas l'agent factice et ouvre un terminal.
 * Puis « Recommencer à neuf » dans l'app packagée (fiche 187) : profil temporaire effacé à la
 * fermeture, réinitialisation vers une corbeille d'essai, réinitialisation impossible (rien
 * d'effacé, avis au lancement suivant) — et jamais de seconde Bobine lancée par un assistant.
 *
 *   pnpm package --dir && pnpm e2e:packaged
 *
 * Aucun agent n'est sollicité (pas de message envoyé). N'arrête que le processus qu'il a lancé.
 */
import { execFileSync, spawn } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir, tmpdir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// BOBINE_PACKAGED_APP : une autre app à essayer (ex. le .dmg d'une Release GitHub, fiche 059).
const app =
  process.env['BOBINE_PACKAGED_APP'] ??
  join(root, 'dist', process.arch === 'x64' ? 'mac' : `mac-${process.arch}`, 'Bobine.app')
const binary = join(app, 'Contents', 'MacOS', 'Bobine')
if (!existsSync(binary)) {
  console.error(`App introuvable : ${app}\nLancer d'abord : pnpm package --dir`)
  process.exit(1)
}
const captures = join(root, 'e2e', 'captures')
mkdirSync(captures, { recursive: true })
const PORT = 9555 + Math.floor(Math.random() * 300)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (ok, label) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}`)
  if (!ok) failures++
}

const userData = mkdtempSync(join(tmpdir(), 'bob-packaged-'))
const { username, shell } = userInfo()
// `xcrun` neutre : l'essai ne regarde jamais les simulateurs réels de la machine, mais l'AXe livré
// avec l'app (ADR-0009) doit être trouvé et répondre.
const xcrun = join(userData, 'xcrun')
writeFileSync(xcrun, `#!/bin/sh\n[ "$2" = list ] && echo '{"devices":{}}'\nexit 0\n`)
chmodSync(xcrun, 0o755)
const scratch = [userData]
// Pas d'alerte « rouvrir les fenêtres ? » après un essai tué (réglage AppKit de ce lancement
// seulement, comme `APPKIT_ARGS` de `lib.mjs`).
const APPKIT_ARGS = ['-ApplePersistenceIgnoreState', 'YES']

/**
 * Lance l'app comme le Finder : environnement d'une app ouverte depuis le Finder, pas le PATH du
 * shell de développement. --use-mock-keychain : les clés d'API (fiche 022) passent par
 * `safeStorage`, dont la première lecture ouvre la boîte du trousseau macOS pour une app ad hoc
 * fraîchement signée, et bloque le main process jusqu'à la réponse de l'utilisateur ; jamais le
 * vrai trousseau dans un essai.
 */
async function launch(args, extraEnv = {}) {
  const port = PORT + scratch.length
  const child = spawn(
    binary,
    [...args, `--remote-debugging-port=${port}`, '--use-mock-keychain', ...APPKIT_ARGS],
    {
      env: {
        HOME: homedir(),
        USER: username,
        LOGNAME: username,
        SHELL: shell || '/bin/zsh',
        TMPDIR: tmpdir(),
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
        BOBINE_XCRUN: xcrun,
        // Agent démarré à l'ouverture : OpenCode (ni authentification ni coût sans message).
        BOBINE_AGENT_PROFILE: 'opencode',
        // Jamais le vrai Bob dans un essai : pas de lecture de son quota (fiche 091).
        BOBINE_QUOTA: 'off',
        ...extraEnv
      },
      stdio: 'ignore'
    }
  )
  const exited = new Promise((resolve) => child.once('exit', resolve))
  let targets = []
  for (let i = 0; i < 120 && !targets.some((t) => t.type === 'page'); i++) {
    await sleep(250)
    targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
      (r) => r.json(),
      () => []
    )
  }
  const page = targets.find((t) => t.type === 'page')
  if (!page) {
    child.kill()
    throw new Error('pas de fenêtre')
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    pending.get(d.id)?.(d)
    pending.delete(d.id)
  }
  // Une réponse qui ne vient pas (main process bloqué…) est un échec, pas une attente sans fin.
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id
      const timer = setTimeout(() => {
        pending.delete(i)
        reject(new Error(`${method} : pas de réponse en 30 s (main process bloqué ?)`))
      }, 30_000)
      pending.set(i, (d) => {
        clearTimeout(timer)
        resolve(d)
      })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const ev = async (expression) =>
    (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result
      .result?.value
  const waitFor = async (expression, ms = 15000) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await ev(expression).catch(() => false)) return true
      await sleep(150)
    }
    return false
  }
  return { child, exited, ws, cdp, ev, waitFor }
}

/** Attend une condition sur le disque (l'app vient de quitter, l'assistant travaille). */
async function until(test, ms = 20_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (test()) return true
    await sleep(200)
  }
  return false
}

/** Processus qui exécutent le binaire de l'app essayée (les siens, ceux d'une seconde Bobine). */
function appProcesses() {
  const out = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
  return out
    .split('\n')
    .filter((line) => line.includes(binary))
    .map((line) => Number(line.trim().split(/\s+/)[0]))
}

/** Une seconde Bobine lancée par un assistant (fusible RunAsNode, fiche 187) serait vue ici. */
async function noSecondApp(label) {
  await sleep(2000)
  const left = appProcesses()
  check(left.length === 0, `${label} : aucune autre Bobine lancée (${left.join(', ') || 'aucune'})`)
  for (const pid of left) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {}
  }
}

async function basics() {
  console.log(`\n▶ App packagée (${app.replace(root + '/', '')})`)
  const { child, exited, ws, cdp, ev, waitFor } = await launch([`--user-data-dir=${userData}`])
  try {
    check(true, 'la fenêtre s’ouvre')
    check(
      await waitFor(`!!document.querySelector('[data-testid="composer-input"]')`),
      'l’interface s’affiche'
    )
    const info = await ev(`window.api.app.getInfo()`)
    check(info?.name === 'Bobine', `nom de l’app : ${info?.name}`)
    check((await ev(`typeof require`)) === 'undefined', 'renderer isolé (pas de require)')

    const settings = await ev(`window.api.settings.get()`)
    const profiles = settings?.profiles ?? []
    check(!profiles.some((p) => p.id === 'mock'), 'agent factice absent')
    for (const p of profiles) console.log(`    · ${p.label} : ${p.available ? 'trouvé' : p.reason}`)
    check(
      profiles.some((p) => p.available),
      'au moins un agent trouvé avec le PATH du shell de connexion (lancement façon Finder)'
    )

    // Terminal : node-pty (module natif hors de l'archive asar) et son spawn-helper.
    const marker = await ev(`(async () => {
      const { activeId } = await window.api.conversations.get()
      const tab = await window.api.terminal.create(activeId, 80, 24)
      let out = ''
      const off = window.api.terminal.onData((e) => { if (e.tabId === tab.id) out += e.data })
      await new Promise((r) => setTimeout(r, 1500))
      await window.api.terminal.write(activeId, tab.id, 'echo bob-$((6*7))\\r')
      for (let i = 0; i < 50 && !out.includes('bob-42'); i++) await new Promise((r) => setTimeout(r, 100))
      off()
      await window.api.terminal.close(activeId, tab.id)
      return out.includes('bob-42')
    })()`)
    check(marker === true, 'un terminal s’ouvre et exécute une commande (node-pty packagé)')
    // Police des icônes du terminal (fiche 201) : lue dans l'archive asar, admise par la CSP.
    const symbols = await ev(`(async () => {
      const faces = await document.fonts.load('12px "Bobine Nerd Font"', '\\ue0a0')
      return faces.map((f) => f.status).join(',')
    })().catch((e) => String(e))`)
    check(
      symbols === 'loaded',
      `police des icônes du terminal chargée dans l’app packagée (${symbols})`
    )

    // AXe livré avec l'app (Contents/Resources/axe) : trouvé sans PATH, répond, version suffisante.
    const simulator = await ev(`(async () => {
      const { activeId } = await window.api.conversations.get()
      return window.api.simulator.getState(activeId)
    })()`)
    // Le binaire du paquet, pas un AXe installé sur la machine (`~/.local/bin`, Homebrew) : l'app
    // y retomberait sinon en silence.
    const bundledAxe = join(app, 'Contents', 'Resources', 'axe', 'axe')
    check(
      simulator?.touch === true &&
        typeof simulator?.axe?.version === 'string' &&
        simulator?.axe?.path === bundledAxe,
      `AXe embarqué utilisé (${simulator?.axe?.version ?? simulator?.axe?.error ?? 'aucun état'} : ${simulator?.axe?.path ?? 'aucun'})`
    )

    const shot = await cdp('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(captures, 'packaged.png'), Buffer.from(shot.result.data, 'base64'))
    ws.close()
  } finally {
    child.kill()
    await exited
  }
}

/** Profil temporaire : dossier dans les fichiers temporaires, supprimé à la fermeture. */
async function temporaryProfile() {
  console.log('\n▶ App packagée : profil temporaire (fiche 148)')
  const profiles = () =>
    new Set(readdirSync(tmpdir()).filter((name) => name.startsWith('bobine-profil-')))
  const before = profiles()
  const { child, exited, ws, ev, waitFor } = await launch(['--profil-temporaire'])
  let folder = ''
  try {
    check(
      await waitFor(`!!document.querySelector('[data-testid="temporary-profile"]')`),
      'la pastille « profil temporaire » s’affiche'
    )
    folder = [...profiles()].find((name) => !before.has(name)) ?? ''
    check(!!folder, `dossier de données dans les fichiers temporaires (${folder || 'aucun'})`)
    check((await ev(`typeof require`)) === 'undefined', 'renderer isolé')
    ws.close()
  } finally {
    // Quitter comme macOS le demande (SIGTERM : l'app quitte proprement, `will-quit`).
    child.kill('SIGTERM')
    await exited
  }
  check(
    !!folder && (await until(() => !existsSync(join(tmpdir(), folder)))),
    'fermée, la Bobine temporaire ne laisse rien : son dossier est supprimé'
  )
  await noSecondApp('profil temporaire fermé')
}

/** Réinitialiser une Bobine d'essai (dossier imposé : ni trousseau, ni préférences ; relance enregistrée). */
async function reset({ trashWritable }) {
  console.log(
    `\n▶ App packagée : réinitialiser${trashWritable ? '' : ', corbeille impossible à écrire'} (fiches 148, 187)`
  )
  const data = mkdtempSync(join(tmpdir(), 'bob-packaged-neuf-'))
  const trash = mkdtempSync(join(tmpdir(), 'bob-packaged-corbeille-'))
  scratch.push(data, trash)
  // Relance : un enregistreur à la place de `open` (jamais le vrai profil), qui garde ses arguments.
  const opener = join(trash + '-relance')
  const relaunched = join(data + '-relance.txt')
  writeFileSync(opener, `#!/bin/sh\nprintf '%s\\n' "$@" > '${relaunched}'\n`)
  chmodSync(opener, 0o755)
  scratch.push(opener, relaunched)
  const env = { BOBINE_TRASH_DIR: trash, BOBINE_RESET_RELAUNCH: opener }
  // Chemin réel pris avant la réinitialisation : le dossier part ensuite à la corbeille.
  const dirs = [data, realpathSync(data)].map((dir) => `--user-data-dir=${dir}`)
  const checkRelaunch = async () => {
    const ok = await until(() => existsSync(relaunched))
    const args = ok ? readFileSync(relaunched, 'utf8').trim().split('\n') : []
    check(
      args.length === 4 &&
        args[0] === '-n' &&
        args[1].endsWith('Bobine.app') &&
        args[2] === '--args' &&
        dirs.includes(args[3]),
      `relancée sur son dossier de données imposé, pas sur le vrai profil (${args.join(' ') || 'pas de relance'})`
    )
  }
  const first = await launch([`--user-data-dir=${data}`], env)
  try {
    check(
      await first.waitFor(`!!document.querySelector('[data-testid="composer-input"]')`),
      'l’interface s’affiche'
    )
    if (!trashWritable) chmodSync(trash, 0o555)
    // Comme le bouton « Tout effacer et fermer » : l'app quitte, l'assistant fait le ménage.
    await first.ev(`window.api.app.reset(false)`).catch(() => {})
    first.ws.close()
  } catch (error) {
    first.child.kill()
    throw error
  }
  const quit = await Promise.race([first.exited.then(() => true), sleep(20_000).then(() => false)])
  check(quit, 'Bobine quitte d’elle-même')
  if (!quit) first.child.kill()
  if (trashWritable) {
    // Le LISEZ-MOI arrive en dernier (écrit d'un coup) : l'assistant a fini.
    const readmeOf = (folder) =>
      existsSync(folder) ? readdirSync(folder).find((f) => f.endsWith('.txt')) : undefined
    const folder = () => join(trash, readdirSync(trash)[0] ?? '-')
    check(
      await until(() => !existsSync(data) && !!readmeOf(folder())),
      'son dossier de données part dans un dossier daté de la corbeille'
    )
    const readme = readmeOf(folder())
    check(
      !!readme &&
        readdirSync(trash).length === 1 &&
        readFileSync(join(folder(), readme), 'utf8').includes(`  <-  `) &&
        readdirSync(folder()).includes(data.split('/').pop()),
      `corbeille : le dossier de données et ${readme || 'le LISEZ-MOI'}`
    )
    await checkRelaunch()
    await noSecondApp('réinitialisation')
    return
  }
  // Corbeille impossible : rien n'est effacé, l'avis est montré au lancement suivant.
  await sleep(3000)
  check(
    existsSync(join(data, 'settings.json')) && readdirSync(trash).length === 0,
    'corbeille impossible : le dossier de données reste en place, rien n’est effacé'
  )
  check(
    existsSync(join(data, 'reinitialisation-echouee.txt')),
    'la raison est gardée pour le lancement suivant'
  )
  await checkRelaunch()
  await noSecondApp('réinitialisation impossible')
  chmodSync(trash, 0o755)
  const second = await launch([`--user-data-dir=${data}`], env)
  try {
    // L'avis cite la raison : ici, la corbeille d'essai (nom unique), que `mkdir` n'a pu écrire.
    check(
      await second.waitFor(
        `document.body.innerText.includes(${JSON.stringify(trash.split('/').pop())})`,
        20_000
      ),
      'relancée : l’avis « rien n’a été supprimé » s’affiche dans la conversation'
    )
    check(
      !existsSync(join(data, 'reinitialisation-echouee.txt')),
      'l’avis n’est montré qu’une fois (fichier supprimé)'
    )
    const shot = await second.cdp('Page.captureScreenshot', { format: 'png' })
    writeFileSync(
      join(captures, 'packaged-reinitialisation-echouee.png'),
      Buffer.from(shot.result.data, 'base64')
    )
    second.ws.close()
  } finally {
    second.child.kill()
    await second.exited
  }
}

/**
 * Textes de licence livrés avec l'app (fiche 217) : ceux de Bobine, les avis des composants tiers
 * (identiques à ceux du dépôt), Electron et Chromium, la police.
 */
function licenses() {
  console.log('\n▶ Textes de licence (Contents/Resources/licenses)')
  const dir = join(app, 'Contents', 'Resources', 'licenses')
  const read = (file) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : '')
  for (const file of [
    'LICENSE',
    'NOTICE',
    'electron/LICENSE',
    'electron/LICENSES.chromium.html',
    'fonts/MesloLG-LICENSE.txt',
    'fonts/NerdFonts-LICENSE.txt',
    'fonts/MesloLGSNerdFont-README.txt'
  ]) {
    check(read(file).length > 0, `${file} livré`)
  }
  const notices = read('THIRD-PARTY-NOTICES.md')
  // BOBINE_PACKAGED_APP : une app d'une autre version peut avoir d'autres avis que le dépôt.
  const expected = process.env['BOBINE_PACKAGED_APP']
    ? notices
    : readFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), 'utf8')
  check(
    notices.includes('**EPL-2.0**') && notices === expected,
    'THIRD-PARTY-NOTICES.md livré (celui du dépôt, choix de licence d’elkjs compris)'
  )
  check(read('NOTICE').includes('Jérôme Lallement'), 'NOTICE de Bobine')
}

try {
  licenses()
  const already = appProcesses()
  if (already.length) {
    throw new Error(`l'app essayée tourne déjà (${already.join(', ')}) : fermez-la d'abord`)
  }
  await basics()
  await temporaryProfile()
  await reset({ trashWritable: true })
  await reset({ trashWritable: false })
} catch (error) {
  console.error(error)
  failures++
} finally {
  await sleep(500)
  for (const dir of scratch) {
    try {
      chmodSync(dir, 0o755)
    } catch {}
    rmSync(dir, { recursive: true, force: true })
  }
}

console.log(failures ? `\n✗ ${failures} échec(s)` : '\n✓ app packagée ok')
process.exit(failures ? 1 : 0)
