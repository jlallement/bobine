/**
 * Captures de la vitrine (README, image de partage, GIF et vidéo ; fiche 225), contre l'app
 * buildée et l'agent factice en mode vitrine (« Agent de démo », scénario `vitrine`) : aucun
 * modèle, aucune donnée personnelle. À relancer à chaque version, et après tout changement
 * d'apparence (nouveau thème) :
 *
 *   pnpm build && pnpm vitrine                  anglais (README.md), puis
 *   pnpm build && pnpm vitrine --lang fr        français (README.fr.md)
 *
 * Options : `--sans-video` (images seules), `--garder` (garde les captures brutes et les images de
 * la vidéo dans `e2e/captures/vitrine-*`).
 *
 * Sorties, dans `docs/images/readme/<langue>/` : `hero-light.png`, `hero-dark.png`,
 * `hero-aurora.png`, `hero-aurora-night.png`,
 * `changes.png`, `history.png`, `roles-menu.png`, `roles.png`, `questions.png`, `browser.png`,
 * `discussion.png`, `themes.png` ;
 * en anglais seulement : `docs/images/social-preview.png` (1280×640, à déposer à la main dans
 * Settings › General de GitHub). Vidéo : `e2e/captures/vitrine/<langue>/demo.mp4` (non versionnée,
 * à déposer par l'éditeur web de GitHub) et `docs/images/readme/<langue>/roles.gif`.
 *
 * Avant chaque capture, le texte de la fenêtre est contrôlé (`DENY`) : ni « factice », ni
 * « mock », ni `/scenario`, ni chemin de dossier temporaire ou personnel. Outils de développement
 * (non livrés) : `ffmpeg` et `gifski` (Homebrew) pour la vidéo et le GIF ; `sips` (macOS) pour
 * réduire les images.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, MAIN_PORT, captures, root, sleep, withApp } from './lib.mjs'
import { SHOWCASE_PROJECT } from '../src/mock-agent/scenarios-vitrine.mts'

const EN = LANG === 'en'
const WITH_VIDEO = !process.argv.includes('--sans-video')
const KEEP = process.argv.includes('--garder')
/**
 * Thèmes montrés : mode du système (`prefers-color-scheme`) et variante choisie dans Réglages ›
 * Apparence (`palette`, rien pour Clair et Sombre). Le premier fait tout le parcours ; les autres,
 * l'image de tête seule (`hero-<nom>.png`) ; tous entrent dans `themes.png`, dans cet ordre.
 */
const THEMES = [
  { name: 'light', scheme: 'light' },
  { name: 'dark', scheme: 'dark' },
  { name: 'aurora', scheme: 'light', palette: 'aurora' },
  { name: 'aurora-night', scheme: 'dark', palette: 'auroraNight' }
]
/**
 * Fenêtre des essais, à sa taille réelle (1280×820) : une taille émulée décalerait les vues natives
 * (navigateur intégré) dans les captures.
 */
const WIDTH = 1280
const HEIGHT = 820
/** Largeur des images du README : le double d'une colonne de README, net sur un écran Retina. */
const README_WIDTH = 1600
const GIF_MAX_BYTES = 5 * 1024 * 1024
const MP4_MAX_BYTES = 10 * 1024 * 1024

const out = join(root, 'docs', 'images', 'readme', LANG)
const videoOut = join(captures, 'vitrine', LANG)
mkdirSync(out, { recursive: true })
mkdirSync(videoOut, { recursive: true })

/** Textes interdits dans une capture : outillage d'essai, chemins de la machine. */
const DENY = [
  /\/scenario/i,
  /factice/i,
  /\bmock\b/i,
  /bob-e2e-/i,
  /bobine-vitrine-/i,
  /\/Users\//,
  /\/private\//,
  /\/var\/folders\//,
  /\/tmp\//
]

/** Ce que l'utilisateur tape, dans la langue des captures. */
const PROMPTS = EN
  ? {
      fix: 'The discount test fails. Can you fix it?',
      review: 'review the cart before the release',
      questions: 'Add an export of the orders',
      browser: 'Open the shop and check the page',
      email: 'Write an email to our coffee roaster: we need 10 kg more for Friday.'
    }
  : {
      fix: 'Le test de la remise échoue, tu peux corriger ?',
      review: 'relisez le panier avant la mise en ligne',
      questions: 'Ajoute un export des commandes',
      browser: 'Ouvre la boutique et vérifie la page',
      email: 'Écris un e-mail au torréfacteur : il nous faut 10 kg de plus pour vendredi.'
    }

/** Page de la boutique servie au navigateur intégré. */
const SHOP_PAGE = `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>La Bobinette</title>
<style>
  body { margin: 0; font: 16px/1.5 -apple-system, system-ui, sans-serif; color: #3b2a20; background: #fbf6ef }
  header { display: flex; justify-content: space-between; align-items: center; padding: 20px 32px; background: #6b3f2a; color: #fff }
  header b { font-size: 22px } .cart { background: #fff3; padding: 6px 14px; border-radius: 99px }
  h1 { margin: 32px 32px 8px; font-size: 28px } p.lead { margin: 0 32px 24px; color: #7a6152 }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; padding: 0 32px 32px }
  .card { background: #fff; border-radius: 14px; padding: 20px; box-shadow: 0 2px 10px #0001 }
  .dot { width: 56px; height: 56px; border-radius: 50%; margin-bottom: 12px }
  .price { font-weight: 600 } button { margin-top: 10px; border: 0; background: #c4633f; color: #fff; padding: 8px 16px; border-radius: 8px; font: inherit }
</style></head><body>
<header><b>La Bobinette</b><span class="cart">${EN ? 'Cart' : 'Panier'} · 2</span></header>
<h1>${EN ? 'The shop' : 'La boutique'}</h1>
<p class="lead">${EN ? 'Coffee roasted on Tuesdays, pastries baked every morning.' : 'Café torréfié le mardi, pâtisseries du matin.'}</p>
<div class="grid">
  <div class="card"><div class="dot" style="background:#8a5a3c"></div><b>${EN ? 'House blend' : 'Mélange maison'}</b><div class="price">8,50 €</div><button>${EN ? 'Add' : 'Ajouter'}</button></div>
  <div class="card"><div class="dot" style="background:#d9a441"></div><b>${EN ? 'Lemon tart' : 'Tarte au citron'}</b><div class="price">4,20 €</div><button>${EN ? 'Add' : 'Ajouter'}</button></div>
  <div class="card"><div class="dot" style="background:#7c9a6d"></div><b>${EN ? 'Matcha latte' : 'Latte matcha'}</b><div class="price">5,00 €</div><button>${EN ? 'Add' : 'Ajouter'}</button></div>
</div></body></html>`

/** Dossier du projet de démonstration, en dépôt git avec un commit. */
function project() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-vitrine-')))
  const dir = join(base, 'la-bobinette')
  mkdirSync(dir)
  for (const [path, content] of Object.entries(SHOWCASE_PROJECT[LANG])) {
    writeFileSync(join(dir, path), content)
  }
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'user.name=Demo', '-c', 'user.email=demo@example.invalid', ...args],
      { cwd: dir }
    )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'La Bobinette')
  return { dir, base }
}

/** Refuse une capture qui montre un texte interdit. */
async function checkClean(ui, name) {
  const text = await ui.ev(`document.body.innerText`)
  const hit = DENY.find((re) => re.test(text))
  if (hit) {
    const line = text.split('\n').find((l) => hit.test(l))
    throw new Error(`capture « ${name} » : texte interdit ${hit} (« ${line} »)`)
  }
}

/**
 * Une capture à la fois : une image de la vidéo prise pendant une capture d'écran la gâche
 * (image de tête en mosaïque).
 */
let lock = Promise.resolve()
function exclusive(fn) {
  const run = lock.then(fn)
  lock = run.catch(() => {})
  return run
}

/** Capture contrôlée, réduite à `README_WIDTH` dans le dossier du README. */
async function shot(ui, name, scheme = 'light') {
  await checkClean(ui, name)
  // Aucun survol dans l'image (poignée de la barre latérale, infobulle) : la fenêtre est à
  // l'écran, le vrai pointeur de la machine peut passer dessus. Le temps de la capture seulement.
  await ui.hover({ x: WIDTH - 4, y: HEIGHT - 4 })
  await ui.ev(
    `(() => { const s = document.createElement('style'); s.id = 'vitrine-sans-survol'; s.textContent = '* { pointer-events: none !important }'; document.head.append(s) })()`
  )
  await sleep(300)
  try {
    await exclusive(() => ui.shot(`vitrine-${name}`))
  } finally {
    await ui.ev(`document.getElementById('vitrine-sans-survol')?.remove()`)
  }
  const raw = join(captures, `${EN ? 'en-' : ''}vitrine-${name}-${scheme}.png`)
  const file = join(out, `${name}.png`)
  execFileSync('sips', ['--resampleWidth', String(README_WIDTH), raw, '--out', file], {
    stdio: 'ignore'
  })
  console.log(`  ✓ ${name}.png (${kb(file)})`)
  return raw
}

const kb = (file) => `${Math.round(statSync(file).size / 1024)} Ko`

/** Tape comme une personne (la vidéo montre la frappe). */
async function typeSlowly(ui, text) {
  await ui.ev(`${ui.$('composer-input')}.focus()`)
  for (const char of text) {
    await ui.type(char)
    await sleep(WITH_VIDEO ? 45 : 0)
  }
}

/**
 * Choisit un rôle dans le menu `@` : `@` (s'il n'est pas déjà tapé) et le début de son nom, puis
 * Entrée sur le rôle en tête.
 */
async function pickRole(ui, query, role, { at = true } = {}) {
  await typeSlowly(ui, `${at ? '@' : ''}${query}`)
  await ui.waitFor(
    `document.querySelector('[data-testid=role-item]')?.dataset.role === '${role}'`,
    5000
  )
  await sleep(WITH_VIDEO ? 500 : 0)
  await ui.enter()
  await ui.waitFor(
    `!!document.querySelector('[data-testid=role-token][data-role="${role}"]')`,
    5000
  )
}

/** Enregistre la fenêtre : images JPEG horodatées, via le protocole DevTools. */
function record(ui) {
  const dir = mkdtempSync(join(tmpdir(), 'bobine-vitrine-video-'))
  const frames = []
  const marks = {}
  let running = true
  const start = Date.now()
  const loop = (async () => {
    while (running) {
      const at = Date.now()
      const r = await exclusive(() =>
        ui.cdp('Page.captureScreenshot', {
          format: 'jpeg',
          quality: 92,
          clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 0.5 }
        })
      )
      if (r.result?.data) {
        const file = join(dir, `${String(frames.length).padStart(5, '0')}.jpg`)
        writeFileSync(file, Buffer.from(r.result.data, 'base64'))
        frames.push({ file, at: at - start })
      }
      const wait = 66 - (Date.now() - at)
      if (wait > 0) await sleep(wait)
    }
  })()
  return {
    dir,
    mark: (name) => (marks[name] = Date.now() - start),
    stop: async () => {
      running = false
      await loop
      return { frames, marks, duration: Date.now() - start }
    }
  }
}

/** MP4 (H.264, 1280 px) des images enregistrées, à leur rythme réel. */
function encodeMp4({ frames, duration }, dir, file) {
  const list = frames
    .map((f, i) => {
      const next = frames[i + 1]?.at ?? duration
      return `file '${f.file}'\nduration ${((next - f.at) / 1000).toFixed(3)}`
    })
    .join('\n')
  const listFile = join(dir, 'images.txt')
  writeFileSync(listFile, `${list}\nfile '${frames.at(-1).file}'\n`)
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-vf',
    `fps=30,scale=${WIDTH}:-2:flags=lanczos,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '24',
    '-movflags',
    '+faststart',
    file
  ])
}

/** GIF d'un passage de la vidéo (gifski), réduit jusqu'à tenir sous `GIF_MAX_BYTES`. */
function encodeGif(mp4, from, to, file) {
  for (const [width, fps, quality] of [
    [960, 12, 80],
    [880, 10, 70],
    [800, 10, 60],
    [720, 8, 55]
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-vitrine-gif-'))
    try {
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-ss',
        (from / 1000).toFixed(2),
        '-to',
        (to / 1000).toFixed(2),
        '-i',
        mp4,
        '-vf',
        `fps=${fps},scale=${width}:-1:flags=lanczos`,
        join(dir, '%04d.png')
      ])
      const pngs = readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => join(dir, f))
      execFileSync('gifski', [
        '--quiet',
        '--fps',
        String(fps),
        '--width',
        String(width),
        '--quality',
        String(quality),
        '-o',
        file,
        ...pngs
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    if (statSync(file).size <= GIF_MAX_BYTES) return
    console.log(`  … ${kb(file)} à ${width} px : on réduit`)
  }
  throw new Error(`GIF trop lourd même réduit : ${kb(file)}`)
}

/** Les images de tête de tous les thèmes, en mosaïque de deux colonnes. */
function themes(heroes, file) {
  const inputs = heroes.flatMap((hero) => ['-i', hero])
  const half = README_WIDTH / 2
  const scaled = heroes.map((_, i) => `[${i}:v]scale=${half}:-1:flags=lanczos[t${i}]`).join(';')
  // Deux colonnes : x = 0 ou w0, y = somme des hauteurs des rangées au-dessus.
  const layout = heroes
    .map((_, i) => {
      const x = i % 2 === 0 ? '0' : 'w0'
      const rows = Math.floor(i / 2)
      const y = rows === 0 ? '0' : Array.from({ length: rows }, () => 'h0').join('+')
      return `${x}_${y}`
    })
    .join('|')
  const stack = heroes.map((_, i) => `[t${i}]`).join('')
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    ...inputs,
    '-filter_complex',
    `${scaled};${stack}xstack=inputs=${heroes.length}:layout=${layout}:fill=white`,
    '-frames:v',
    '1',
    '-update',
    '1',
    file
  ])
  console.log(`  ✓ themes.png (${kb(file)})`)
}

/** Choisit une variante de thème dans Réglages › Apparence (Aurore, Aurore nuit…). */
async function choosePalette(ui, palette) {
  await ui.click(ui.$('open-settings'))
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-appearance'))
  await ui.waitFor(`!!${ui.$(`theme-${palette}`)}`)
  await ui.click(ui.$(`theme-${palette}`))
  await ui.waitFor(`document.documentElement.dataset.palette === '${palette}'`)
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
  await sleep(400)
}

/**
 * Image de partage de GitHub (1280×640), dessinée dans la page de l'app pour en garder les
 * polices et les couleurs : nom, accroche, et l'image de tête.
 */
async function socialPreview(ui, heroRaw, file) {
  const b64 = readFileSync(heroRaw).toString('base64')
  const texts = {
    title: 'Bobine',
    tagline: 'A macOS desktop app for ACP coding agents',
    agents: 'IBM Bob · OpenCode · any ACP agent',
    foot: 'Open source · Apache-2.0'
  }
  const png = await ui.ev(`(async () => {
    const t = ${JSON.stringify(texts)}
    const bytes = Uint8Array.from(atob('${b64}'), (c) => c.charCodeAt(0))
    const hero = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const W = 1280, H = 640
    const canvas = new OffscreenCanvas(W, H)
    const g = canvas.getContext('2d')
    const css = getComputedStyle(document.documentElement)
    const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback
    const font = getComputedStyle(document.body).fontFamily
    g.fillStyle = v('--bg', '#faf8f5')
    g.fillRect(0, 0, W, H)
    // Capture à droite, coins arrondis, ombre douce, coupée par le bas de l'image.
    const x = 470, y = 90, w = 900, h = w * hero.height / hero.width
    g.save()
    g.shadowColor = 'rgba(0,0,0,0.18)'
    g.shadowBlur = 40
    g.beginPath(); g.roundRect(x, y, w, h, 18); g.fillStyle = v('--bg', '#fff'); g.fill()
    g.restore()
    g.save()
    g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip()
    g.drawImage(hero, x, y, w, h)
    g.restore()
    g.fillStyle = v('--accent', '#c4633f')
    g.fillRect(64, 132, 56, 8)
    g.fillStyle = v('--text', '#222')
    g.font = '700 84px ' + font
    g.fillText(t.title, 60, 240)
    g.font = '500 30px ' + font
    const words = t.tagline.split(' ')
    let line = '', yy = 300
    for (const word of words) {
      const next = line ? line + ' ' + word : word
      if (g.measureText(next).width > 370) { g.fillText(line, 64, yy); line = word; yy += 42 }
      else line = next
    }
    g.fillText(line, 64, yy)
    g.fillStyle = v('--muted', '#777')
    g.font = '400 22px ' + font
    g.fillText(t.agents, 64, yy + 64)
    g.fillText(t.foot, 64, 580)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const data = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000))
    return btoa(s)
  })()`)
  writeFileSync(file, Buffer.from(png, 'base64'))
  console.log(`  ✓ social-preview.png (${kb(file)})`)
}

const env = (dir, extra = {}) => ({
  BOBINE_WORKSPACE: dir,
  // Agent de démo (fiche 225) : nom et modèles « de démo », aucune consommation affichée.
  MOCK_AGENT_SHOWCASE: '1',
  MOCK_AGENT_USAGE: 'none',
  MOCK_AGENT_DELAY_MS: WITH_VIDEO ? '35' : '5',
  ...extra
})

/** Envoie le message tapé (Entrée), puis attend l'état voulu. */
async function sendTyped(ui, text) {
  await typeSlowly(ui, text)
  // Tout est bien arrivé dans la saisie (une conversation qui s'ouvre peut perdre une frappe).
  await ui.waitFor(`${ui.$('composer-input')}?.value === ${JSON.stringify(text)}`, 5000)
  await sleep(WITH_VIDEO ? 400 : 0)
  await ui.enter()
}

const permissionCard = `document.querySelector('[data-testid=permission]')`

/** Le test corrigé : carte d'autorisation (image de tête), puis Modifications. */
async function fixTheTest(ui, theme, { changes = true } = {}) {
  await sendTyped(ui, PROMPTS.fix)
  await ui.waitFor(`!!${permissionCard}`, 30_000)
  await ui.waitFor(`${permissionCard}.hasAttribute('data-armed')`, 5000)
  await sleep(1200)
  const raw = await shot(ui, `hero-${theme.name}`, theme.scheme)
  if (!changes) return raw
  await ui.click(`${permissionCard}.querySelector('button[data-kind=allow_once]')`)
  await ui.ready()
  await ui.waitFor(`!!${ui.$('changes-toggle')}`, 20_000)
  await sleep(1500)
  await ui.click(ui.$('changes-toggle'))
  await ui.waitFor(`!!${ui.$('changes-tab')}`)
  const file = `document.querySelector('[data-testid=changes-file] .changes-toggle')`
  await ui.waitFor(`!!${file}`)
  if (!(await ui.ev(`!!document.querySelector('[data-testid=changes-diff]')`))) {
    await ui.click(file)
    await ui.waitFor(`!!document.querySelector('[data-testid=changes-diff]')`)
  }
  await sleep(800)
  await shot(ui, 'changes')
  // Historique des messages envoyés (fiche 227) : ↑ dans la saisie vide rappelle le dernier.
  await ui.ev(`${ui.$('composer-input')}.focus()`)
  await ui.arrow('ArrowUp')
  await ui.waitFor(`!!${ui.$('history-pill')}`, 5000)
  await sleep(600)
  await shot(ui, 'history')
  await ui.arrow('ArrowDown')
  await ui.waitFor(`${ui.$('composer-input')}?.value === ''`, 5000)
  return raw
}

/** Deux rôles appelés d'un message : menu `@`, jetons, deux filles en parallèle. */
async function reviewWithRoles(ui) {
  await ui.click(ui.$('new-conversation'))
  await ui.waitFor(`${ui.$('composer-input')}?.value === ''`)
  await sleep(500)
  await ui.closePanel()
  await typeSlowly(ui, '@')
  await ui.waitFor(`!!document.querySelector('[data-testid=role-item]')`)
  await sleep(600)
  await shot(ui, 'roles-menu')
  await pickRole(ui, 'secu', 'security-expert', { at: false })
  await pickRole(ui, ' @code', 'code-reviewer', { at: false })
  await typeSlowly(ui, ` ${PROMPTS.review}`)
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await sleep(WITH_VIDEO ? 900 : 300)
  await ui.enter()
  await ui.waitFor(`document.querySelectorAll('[data-testid=role-launch]').length === 2`, 30_000)
  await ui.waitFor(`document.querySelectorAll('[data-testid=child-report]').length === 2`, 60_000)
  await sleep(1500)
  await shot(ui, 'roles')
}

async function askFirst(ui) {
  await ui.click(ui.$('new-conversation'))
  await ui.waitFor(`${ui.$('composer-input')}?.value === ''`)
  await sleep(500)
  await sendTyped(ui, PROMPTS.questions)
  await ui.waitFor(`!!document.querySelector('[data-testid=choice]')`, 30_000)
  await sleep(800)
  await shot(ui, 'questions')
}

async function openTheShop(ui) {
  await ui.click(ui.$('new-conversation'))
  await ui.waitFor(`${ui.$('composer-input')}?.value === ''`)
  await sleep(500)
  await sendTyped(ui, PROMPTS.browser)
  await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=browser]')`, 30_000)
  await ui.ready()
  await sleep(2000)
  await shot(ui, 'browser')
}

/** Espace Discussion (fiche 224) : un e-mail rédigé, gardé dans les documents. */
async function writeAnEmail(ui) {
  await ui.click(ui.$('space-discussion'))
  await ui.waitFor(`!!${ui.$('discussion-drop-hint')}`)
  await ui.ready()
  await sendTyped(ui, PROMPTS.email)
  await ui.waitFor(`!!${ui.$('document-card')}`, 30_000)
  await ui.ready()
  if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
  await ui.waitFor(`!!${ui.$('side-panel')}`)
  // Onglet « Documents » : par son libellé accessible (le panneau étroit cache les libellés).
  if (!(await ui.ev(`!!${ui.$('documents-preview')}`))) {
    await ui.click(
      `document.querySelector('.side-panel-tab-main[aria-label=${JSON.stringify(L('panel.tab.documents'))}]')`
    )
  }
  await ui.waitFor(`!!${ui.$('documents-preview')}`)
  await sleep(1000)
  await shot(ui, 'discussion')
}

const server = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(SHOP_PAGE)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const shopUrl = `http://127.0.0.1:${server.address().port}/`

console.log(`Vitrine (${LANG}) → ${out}`)
const heroRaw = {}
try {
  // 1. Thème clair : le parcours complet, filmé ; puis la question à choix et le navigateur.
  {
    const { dir, base } = project()
    try {
      await withApp(
        'light',
        async (ui) => {
          await ui.ready()
          await sleep(600)
          const video = WITH_VIDEO ? record(ui) : undefined
          heroRaw.light = await fixTheTest(ui, THEMES[0])
          video?.mark('roles')
          await reviewWithRoles(ui)
          await sleep(1500)
          if (video) {
            const recording = await video.stop()
            const mp4 = join(videoOut, 'demo.mp4')
            encodeMp4(recording, video.dir, mp4)
            console.log(`  ✓ demo.mp4 (${kb(mp4)}, ${(recording.duration / 1000).toFixed(0)} s)`)
            if (statSync(mp4).size > MP4_MAX_BYTES) {
              throw new Error(`vidéo trop lourde pour l'éditeur web de GitHub : ${kb(mp4)}`)
            }
            const gif = join(out, 'roles.gif')
            encodeGif(mp4, recording.marks.roles, recording.duration, gif)
            console.log(`  ✓ roles.gif (${kb(gif)})`)
            if (!KEEP) rmSync(video.dir, { recursive: true, force: true })
          }
          await askFirst(ui)
          await openTheShop(ui)
          await writeAnEmail(ui)
        },
        undefined,
        'vitrine',
        env(dir, { MOCK_BROWSER_URL: shopUrl }),
        // Inspecteur du main : la page du navigateur intégré (vue native) entre dans la capture.
        [`--inspect=${MAIN_PORT}`]
      )
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }

  // 2. Les autres thèmes : l'image de tête seule.
  for (const theme of THEMES.slice(1)) {
    const { dir, base } = project()
    try {
      await withApp(
        theme.scheme,
        async (ui) => {
          await ui.ready()
          if (theme.palette) await choosePalette(ui, theme.palette)
          heroRaw[theme.name] = await fixTheTest(ui, theme, { changes: false })
        },
        undefined,
        'vitrine',
        env(dir)
      )
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }

  themes(
    THEMES.map((theme) => heroRaw[theme.name]),
    join(out, 'themes.png')
  )

  // 3. Image de partage (anglais seulement), dessinée dans l'app en thème clair.
  if (EN) {
    const { dir, base } = project()
    try {
      await withApp(
        'light',
        async (ui) => {
          await ui.ready()
          await socialPreview(ui, heroRaw.light, join(root, 'docs', 'images', 'social-preview.png'))
        },
        undefined,
        'vitrine',
        env(dir)
      )
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
} finally {
  server.close()
  if (!KEEP) {
    for (const f of readdirSync(captures).filter((f) => f.includes('vitrine-'))) {
      rmSync(join(captures, f), { force: true })
    }
  }
}
if (!existsSync(join(out, 'hero-light.png'))) throw new Error('image de tête absente')
console.log('Vitrine : terminé.')
