/**
 * Essai de l'app installée sous Linux (le `.deb`) et sous Windows (l'installeur NSIS), sur le
 * modèle de `packaged.mjs` du Mac (fiches 111, 145, 229) : l'app installée démarre sur un profil
 * temporaire (`--profil-temporaire`, comme neuve), s'ouvre sur l'accueil du premier lancement, ne
 * parle pas du Mac, ouvre un terminal, puis quitte proprement (code 0, aucun processus restant,
 * profil temporaire effacé).
 *
 *   pnpm e2e:packaged                         (Linux, Windows : `packaged.mjs` passe la main ici)
 *   node e2e/packaged-installed.mjs [<exécutable>] [--captures <dossier>]
 *
 * Exécutable par défaut : `/opt/Bobine/bobine` (Linux, `.deb`) ou
 * `%LOCALAPPDATA%\Programs\bobine\Bobine.exe` (Windows) ; `BOBINE_PACKAGED_APP` le remplace.
 * Autonome (rien d'autre du dépôt n'est importé) : il peut être copié seul dans une machine
 * virtuelle. Sous Windows, il doit tourner dans la session du bureau (pas une session SSH :
 * fenêtre invisible). Aucun agent n'est sollicité ; n'arrête que les processus qu'il a lancés.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Exécutable installé par défaut, selon le système. */
export function defaultExecutable(platform = process.platform, env = process.env) {
  if (platform === 'linux') return '/opt/Bobine/bobine'
  if (platform === 'win32') {
    return join(env['LOCALAPPDATA'] ?? '', 'Programs', 'bobine', 'Bobine.exe')
  }
  return '/Applications/Bobine.app/Contents/MacOS/Bobine'
}

/** Commande du terminal qui écrit `bob-42` sans que la ligne tapée le contienne. */
export function terminalProbe(platform = process.platform) {
  return platform === 'win32' ? 'Write-Output ("bob-" + 6*7)\r' : 'echo bob-$((6*7))\r'
}

/** Mots du Mac qui ne doivent pas s'afficher ailleurs (fiches 145, 229). */
export const MAC_WORDS = /\bMac\b|\bFinder\b|\bDock\b|trousseau macOS|macOS Keychain|⌘/

/** Processus encore vivants qui exécutent ce binaire. */
function processesOf(executable) {
  try {
    if (process.platform === 'win32') {
      const script = `Get-Process | Where-Object { $_.Path -eq '${executable.replaceAll("'", "''")}' } | ForEach-Object { $_.Id }`
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
        encoding: 'utf8',
        windowsHide: true
      })
      return out.split(/\s+/).filter(Boolean).map(Number)
    }
    const out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' })
    return out
      .split('\n')
      .filter((line) => line.trim().split(/\s+/)[1] === executable)
      .map((line) => Number(line.trim().split(/\s+/)[0]))
  } catch {
    return []
  }
}

const profiles = () =>
  new Set(readdirSync(tmpdir()).filter((name) => name.startsWith('bobine-profil-')))

/** Connexion CDP minimale (Node 22+ : `WebSocket` global). */
async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    pending.get(d.id)?.(d)
    pending.delete(d.id)
  }
  const cdp = (method, params = {}) =>
    new Promise((resolveCall, reject) => {
      const i = ++id
      const timer = setTimeout(() => {
        pending.delete(i)
        reject(new Error(`${method} : pas de réponse en 30 s`))
      }, 30_000)
      pending.set(i, (d) => {
        clearTimeout(timer)
        resolveCall(d)
      })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  return { ws, cdp }
}

export async function main(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--captures')
  const captures = resolve(
    i >= 0 ? (argv[i + 1] ?? '.') : join(dirname(fileURLToPath(import.meta.url)), 'captures')
  )
  const positional = argv.filter((a, k) => !a.startsWith('--') && argv[k - 1] !== '--captures')
  const executable = positional[0] ?? process.env['BOBINE_PACKAGED_APP'] ?? defaultExecutable()
  if (!existsSync(executable)) {
    console.error(`App installée introuvable : ${executable}`)
    return 1
  }
  mkdirSync(captures, { recursive: true })
  let failures = 0
  const check = (ok, label) => {
    console.log(`${ok ? '  ✓' : '  ✗'} ${label}`)
    if (!ok) failures++
  }
  const system = process.platform === 'win32' ? 'windows' : process.platform
  console.log(`\n▶ App installée (${system}) : ${executable}`)
  const port = 9555 + Math.floor(Math.random() * 300)
  const before = profiles()
  // Dossier de la conversation (le terminal s'y ouvre), jetable ; rien d'autre n'est touché.
  const workspace = mkdtempSync(join(tmpdir(), 'bobine-installed-'))
  const child = spawn(
    executable,
    ['--profil-temporaire', `--remote-debugging-port=${port}`, '--use-mock-keychain'],
    // Jamais le vrai Bob : pas de lecture de son quota (fiche 091).
    {
      env: { ...process.env, BOBINE_QUOTA: 'off', BOBINE_DEFAULT_WORKSPACE: workspace },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: false
    }
  )
  const exit = new Promise((r) => child.once('exit', (code, signal) => r({ code, signal })))
  // Sortie du main (journal) : gardée à côté des captures, lue en cas d'échec.
  let output = ''
  const keep = (data) => (output = (output + data.toString()).slice(-256 * 1024))
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  try {
    let page
    for (let k = 0; k < 160 && !page; k++) {
      await sleep(250)
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (r) => r.json(),
        () => []
      )
      page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools:'))
    }
    check(!!page, 'la fenêtre s’ouvre')
    if (!page) throw new Error('pas de fenêtre')
    const { ws, cdp } = await connect(page.webSocketDebuggerUrl)
    const ev = async (expression) =>
      (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))
        .result?.result?.value
    const waitFor = async (expression, ms = 20_000) => {
      const start = Date.now()
      while (Date.now() - start < ms) {
        if (await ev(expression).catch(() => false)) return true
        await sleep(200)
      }
      return false
    }
    check(
      await waitFor(
        `!!document.querySelector('[data-testid="onboarding"], [data-testid="welcome"], [data-testid="composer-input"]')`
      ),
      'l’accueil s’affiche'
    )
    const home = await ev(
      `document.querySelector('[data-testid="onboarding"]') ? 'premier lancement' : 'accueil'`
    )
    console.log(`    · ${home}`)
    const info = await ev(`window.api.app.getInfo()`)
    check(info?.name === 'Bobine', `nom de l’app : ${info?.name} ${info?.version ?? ''}`)
    check(
      info?.freshStart?.temporary === true,
      'profil temporaire (comme neuve, effacé à la fermeture)'
    )
    check((await ev(`typeof require`)) === 'undefined', 'renderer isolé (pas de require)')
    const settings = await ev(`window.api.settings.get()`)
    check(
      !(settings?.profiles ?? []).some((p) => p.id === 'mock'),
      'agent factice absent de l’app installée'
    )
    for (const p of settings?.profiles ?? []) {
      console.log(`    · ${p.label} : ${p.available ? 'trouvé' : p.reason}`)
    }
    const text = (await ev(`document.body.innerText`)) ?? ''
    const mac = MAC_WORDS.exec(text)?.[0]
    check(!mac, `aucun texte du Mac à l’écran${mac ? ` (« ${mac} »)` : ''}`)
    // Terminal : node-pty (ConPTY sous Windows) hors de l'archive asar.
    const terminal = await ev(`(async () => {
      const { activeId } = await window.api.conversations.get()
      const tab = await window.api.terminal.create(activeId, 80, 24)
      let out = ''
      const off = window.api.terminal.onData((e) => { if (e.tabId === tab.id) out += e.data })
      await new Promise((r) => setTimeout(r, 2500))
      await window.api.terminal.write(activeId, tab.id, ${JSON.stringify(terminalProbe())})
      for (let i = 0; i < 80 && !out.includes('bob-42'); i++) await new Promise((r) => setTimeout(r, 100))
      off()
      await window.api.terminal.close(activeId, tab.id)
      return out.includes('bob-42')
    })().catch((e) => String(e))`)
    check(terminal === true, `un terminal s’ouvre et exécute une commande (${terminal})`)
    // Une erreur interne du main (démarrage, terminal fermé…) s'affiche en bandeau (fiche 195).
    await sleep(5000)
    const alerts = await ev(`document.querySelector('[data-testid="app-alerts"]')?.innerText ?? ''`)
    check(!alerts, `aucune alerte de l’app${alerts ? ` (« ${alerts.split('\n')[0]} »)` : ''}`)
    // Capture : impossible quand le compositeur ne dessine pas (écran verrouillé, session sans
    // bureau) ; dite, sans bloquer la suite.
    const shot = await Promise.race([
      cdp('Page.captureScreenshot', { format: 'png' }).catch(() => undefined),
      sleep(10_000).then(() => undefined)
    ])
    if (shot?.result?.data) {
      const file = join(captures, `packaged-${system}.png`)
      writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
      console.log(`    · capture : ${file}`)
    } else {
      console.log('  ⚠ capture impossible (écran verrouillé, ou pas de bureau ?)')
    }
    ws.close()
    // Quitter comme l'utilisateur (Quitter du menu) : CDP ferme le navigateur, l'app sort.
    const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json())
    const browser = await connect(version.webSocketDebuggerUrl)
    await browser.cdp('Browser.close').catch(() => {})
    browser.ws.close()
    const ended = await Promise.race([exit, sleep(20_000).then(() => undefined)])
    check(
      ended?.code === 0,
      `quitte proprement (${ended ? `code ${ended.code}${ended.signal ? `, ${ended.signal}` : ''}` : 'toujours ouverte après 20 s'})`
    )
  } catch (error) {
    check(false, String(error?.message ?? error))
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  }
  // Processus auxiliaires (GPU, rendu, utilitaires) et assistant du profil temporaire : finis.
  let left = []
  for (let k = 0; k < 60; k++) {
    left = processesOf(executable)
    if (!left.length) break
    await sleep(500)
  }
  check(!left.length, `aucun processus restant (${left.join(', ') || 'aucun'})`)
  for (const pid of left) {
    try {
      process.kill(pid)
    } catch {}
  }
  let created = []
  for (let k = 0; k < 40; k++) {
    created = [...profiles()].filter((name) => !before.has(name))
    if (!created.length) break
    await sleep(500)
  }
  check(!created.length, `profil temporaire effacé (${created.join(', ') || 'oui'})`)
  rmSync(workspace, { recursive: true, force: true })
  writeFileSync(join(captures, `packaged-${system}.log`), output)
  console.log(failures ? `\n✗ ${failures} échec(s)` : '\n✓ app installée : tout est bon')
  return failures ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().then((code) => process.exit(code))
}
