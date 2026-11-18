/**
 * Cible du pilote et cartes en attente (fiche 248) : le pilote parle à la fenêtre principale de
 * Bobine, jamais à une page du navigateur intégré, ouverte ou fermée ; `attendre` voit les cartes
 * souvenir et ignore une carte « Tâches proposées » déjà traitée ; l'état ambigu est dit.
 *
 * Les cibles DevTools sont simulées : `fetch` rend la liste (`/json/list`), `WebSocket` répond au
 * protocole en évaluant les expressions dans une page jsdom par cible. Le code du pilote est celui
 * de tous les jours (aucune dépendance injectée) : ces essais échouent sans le correctif.
 */
import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answerCard, sendMessage } from './actions.mjs'
import { connect } from './cdp.mjs'
import { formatState } from './etat.mjs'
import { READ_SCREEN } from './lecture.mjs'
import { pendingReason, Watcher } from './raison.mjs'

const PORT = 9399
const MAIN_URL =
  'file:///Applications/Bobine.app/Contents/Resources/app.asar/out/renderer/index.html'

/** Fenêtre principale de Bobine, réduite à ce que lit le pilote. */
const MAIN_HTML = `<div id="root">
  <aside><div class="sidebar-footer"><span class="name">Agent factice</span></div>
    <div class="agent-avatar"><span class="status-dot ready"></span></div>
    <span data-testid="agent-status">Prêt</span></aside>
  <main><div data-testid="thread"><div class="msg-user">Bonjour</div><div class="msg-agent">Salut.</div></div>
    <textarea data-testid="composer-input"></textarea></main>
</div>`

/** Page du navigateur intégré (la maquette B de la recette du 2026-11-17). */
const BROWSER_HTML = `<h1>Maquette B</h1><textarea></textarea><button>Ajouter</button>`

/**
 * Page jsdom : chaque élément a une boîte non vide (jsdom n'en calcule pas), `innerText` suit
 * `textContent` ; `api` posé quand la page a le preload de Bobine.
 */
function makeDom(html, url, { api = false } = {}) {
  const dom = new JSDOM(`<body>${html}</body>`, { url, runScripts: 'outside-only' })
  const proto = dom.window.HTMLElement.prototype
  proto.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    width: 30,
    height: 10,
    right: 40,
    bottom: 30
  })
  proto.scrollIntoView = () => {}
  Object.defineProperty(proto, 'innerText', {
    get() {
      return this.textContent
    }
  })
  if (api) dom.window.api = {}
  return dom
}

/** Cibles simulées : `{ id, url, dom, calls, closed }`. */
let targets = []
let nextId = 1

function target(url, html, options = {}) {
  const t = {
    id: `T${nextId++}`,
    type: 'page',
    url,
    dom: makeDom(html, url, options),
    calls: [],
    closed: false,
    sockets: []
  }
  t.webSocketDebuggerUrl = `ws://127.0.0.1:${PORT}/devtools/page/${t.id}`
  targets.push(t)
  return t
}
const mainWindow = () => target(MAIN_URL, MAIN_HTML, { api: true })
const quickWindow = () => target(`${MAIN_URL}#quick`, '<div id="root"></div>', { api: true })
const browserPage = (url = 'file:///Users/moi/taches/maquettes/b.html') => target(url, BROWSER_HTML)

/** Onglet fermé : la cible disparaît de la liste, ses connexions se ferment. */
function closeTarget(t) {
  t.closed = true
  targets = targets.filter((x) => x !== t)
  for (const ws of t.sockets) ws.onclose?.()
}

/** Réponse du protocole DevTools d'une cible (ce que le pilote envoie). */
function answer(t, method, params) {
  t.calls.push(method)
  const doc = t.dom.window.document
  if (method === 'Runtime.evaluate') {
    try {
      const value = t.dom.window.eval(params.expression)
      return { result: { type: typeof value, value } }
    } catch (error) {
      return { exceptionDetails: { text: String(error) } }
    }
  }
  if (method === 'Input.insertText') {
    const box = doc.activeElement
    if (box && 'value' in box) box.value += params.text
  }
  if (method === 'Input.dispatchKeyEvent' && params.type === 'keyDown' && params.key === 'Enter') {
    const box = doc.querySelector('[data-testid=composer-input]')
    if (box && box.value) {
      const msg = doc.createElement('div')
      msg.className = 'msg-user'
      msg.textContent = box.value
      doc.querySelector('[data-testid=thread]').append(msg)
      box.value = ''
    }
  }
  if (method === 'Page.captureScreenshot') return { data: Buffer.from(t.id).toString('base64') }
  return {}
}

class FakeWebSocket {
  constructor(url) {
    this.target = targets.find((t) => t.webSocketDebuggerUrl === url)
    this.target?.sockets.push(this)
    setTimeout(() => (this.target && !this.target.closed ? this.onopen?.() : this.onerror?.()))
  }
  send(raw) {
    const { id, method, params } = JSON.parse(raw)
    const t = this.target
    if (t.closed) return
    const result = answer(t, method, params)
    setTimeout(() => this.onmessage?.({ data: JSON.stringify({ id, result }) }))
  }
  close() {}
}

beforeEach(() => {
  targets = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal('fetch', async (url) => {
    if (!String(url).startsWith(`http://127.0.0.1:${PORT}/json/list`)) throw new Error('refusé')
    // Comme Chromium : la page la plus récente en tête de liste.
    const list = [...targets].reverse().map(({ id, type, url, webSocketDebuggerUrl }) => ({
      id,
      type,
      url,
      webSocketDebuggerUrl
    }))
    list.push({ id: 'D', type: 'page', url: 'devtools://devtools/bundled/inspector.html' })
    return { json: async () => list }
  })
})
afterEach(() => vi.unstubAllGlobals())

/** `etat` tel que la commande l'écrit, lu par le pilote. */
async function etat() {
  const p = await connect(PORT)
  try {
    return formatState(await p.ev(READ_SCREEN))
  } finally {
    p.close()
  }
}

describe('cible DevTools : la fenêtre principale de Bobine, toujours (fiche 248)', () => {
  it('navigateur intégré ouvert : etat, envoyer et capture visent la fenêtre de Bobine', async () => {
    const main = mainWindow()
    quickWindow()
    const page = browserPage()
    const text = await etat()
    expect(text).toMatch(/^Bobine · Agent factice : Prêt \(ready\)/)
    expect(text).not.toContain('agent ?')

    const p = await connect(PORT)
    try {
      await sendMessage(p, 'Ajoute un bouton')
      expect(await p.screenshot()).toBe(Buffer.from(main.id).toString('base64'))
    } finally {
      p.close()
    }
    const sent = [...main.dom.window.document.querySelectorAll('.msg-user')].map(
      (m) => m.textContent
    )
    expect(sent).toEqual(['Bonjour', 'Ajoute un bouton'])
    // La page du navigateur n'a reçu ni frappe, ni clic, ni demande de capture.
    expect(page.calls.filter((m) => !m.startsWith('Runtime.'))).toEqual([])
  })

  it('page du navigateur sur localhost, ou qui ouvre le fichier du renderer : jamais choisie', async () => {
    browserPage('http://localhost:3000/')
    // Même URL que la fenêtre principale, mais sans le preload de Bobine.
    target(MAIN_URL, BROWSER_HTML)
    mainWindow()
    browserPage('http://localhost:3000/a.html')
    expect(await etat()).toMatch(/^Bobine · Agent factice : Prêt/)
  })

  it('onglet fermé : oublié ; la commande suivante relit la liste', async () => {
    mainWindow()
    const page = browserPage()
    expect(await etat()).toMatch(/^Bobine · Agent factice/)
    closeTarget(page)
    expect(await etat()).toMatch(/^Bobine · Agent factice/)
    // Encore listé par Chromium un instant, mais fermé : écarté, sans erreur.
    const ghost = browserPage('http://localhost:3000/a.html')
    ghost.closed = true
    expect(await etat()).toMatch(/^Bobine · Agent factice/)
  })

  it('cible fermée pendant une connexion : la commande échoue tout de suite, sans 30 s d’attente', async () => {
    const main = mainWindow()
    const p = await connect(PORT)
    closeTarget(main)
    const started = Date.now()
    await expect(p.ev('1 + 1')).rejects.toThrow('page fermée')
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('fenêtre absente ou ambiguë : erreur qui le dit, avec les pages vues', async () => {
    browserPage()
    await expect(connect(PORT)).rejects.toThrow(
      /fenêtre principale de Bobine introuvable parmi 1 page\(s\) : file:\/\/\/Users\/moi\/taches\/maquettes\/b\.html/
    )
    mainWindow()
    mainWindow()
    await expect(connect(PORT)).rejects.toThrow(/fenêtre principale de Bobine ambiguë : 2 pages/)
  })
})

describe('état ambigu : dit clairement, jamais « agent ? » (fiche 248)', () => {
  it('page qui n’est pas la fenêtre principale : etat le dit, attendre ne conclut pas « tour fini »', () => {
    const dom = makeDom(BROWSER_HTML, 'http://localhost:3000/')
    const shot = dom.window.eval(READ_SCREEN)
    expect(shot.main).toBe(false)
    const text = formatState(shot)
    expect(text).not.toContain('agent ?')
    expect(text).toBe(
      "État illisible : la page lue n'est pas la fenêtre principale de Bobine (http://localhost:3000/)"
    )
    expect(pendingReason(shot, shot)?.code).toBe('erreur')
    const watcher = new Watcher({ max: 60_000, calme: 30_000, now: 0 })
    expect(watcher.observe(shot, 10_000)?.code).toBe('erreur')
  })

  it('accueil ou barre latérale sans nom d’agent : la raison, pas « agent ? »', () => {
    const base = { main: true, agent: { name: '', status: '', dot: '' }, messages: 0 }
    expect(
      formatState({ ...base, onboarding: { step: 'Agent', title: 'Choisir', buttons: [] } })
    ).toMatch(/^Bobine · accueil du premier lancement/)
    expect(formatState(base)).toMatch(/^Bobine · agent non lu : /)
    expect(formatState(base)).not.toContain('agent ?')
  })
})

describe('cartes en attente (fiche 248)', () => {
  const read = (html) =>
    makeDom(`<div id="root">${html}</div>`, MAIN_URL, { api: true }).window.eval(READ_SCREEN)

  const memoryCard = `<div class="memory-card" data-testid="memory-card" data-action="remember">
    <div class="memory-card-title"><strong>Retenir ce souvenir ?</strong><span class="memory-card-who">proposé par OpenCode</span></div>
    <div class="memory-card-description">Commits en anglais</div>
    <div class="memory-body">Conventional Commits, en anglais.</div>
    <div class="memory-card-actions"><button data-testid="memory-accept">Retenir</button><button data-testid="memory-decline">Non</button></div>
  </div>`
  const proposals = (
    pending,
    rows
  ) => `<div class="permission-card proposals" data-testid="proposals" data-pending="${pending}">
    <div class="pc-head"><div class="pc-title">3 tâches proposées<span class="proposals-summary"> · ${pending ? `${pending} en attente` : '2 lancées, 1 faite ici'}</span></div></div>
    <div class="proposal-rows">${rows}</div>
    ${pending ? '<div class="pc-actions proposals-foot"><span class="question-hint">↑ ↓ pour choisir une ligne, Entrée pour la lancer</span></div>' : ''}</div>`
  const decidedRow = `<div class="proposal-row started" data-testid="proposal-row" data-outcome="start"><button class="proposal-title">API</button><span class="proposal-actions"><button data-testid="proposal-start">Lancer</button></span></div>`
  const pendingRow = `<div class="proposal-row" data-testid="proposal-row" data-outcome="pending"><button class="proposal-title">Web</button><span class="proposal-actions"><button data-testid="proposal-refuse">Refuser</button><button data-testid="proposal-here">Faire ici</button><button data-testid="proposal-start">Lancer</button></span></div>`

  it('carte « Retenir ce souvenir ? » : lue par etat, attendre rend « carte »', () => {
    const shot = read(memoryCard)
    expect(shot.cards).toEqual([
      expect.objectContaining({
        type: 'souvenir',
        title: 'Retenir ce souvenir ?',
        buttons: ['Retenir', 'Non']
      })
    ])
    expect(formatState(shot)).toContain(
      'Carte (souvenir) : Retenir ce souvenir ? — proposé par OpenCode'
    )
    expect(pendingReason(shot, read(''))).toEqual({
      code: 'carte',
      detail: 'Retenir ce souvenir ?'
    })
    // Décidé, le souvenir devient une ligne : plus en attente.
    const decided = read(
      `<div class="memory-decided memory-decided-kept" data-testid="memory-decided"><span>Commits en anglais</span><button class="link-button">Voir</button></div>`
    )
    expect(decided.cards).toEqual([])
  })

  it('« Tâches proposées » toute traitée : pas en attente, même avec son bouton « Lancer »', () => {
    const done = read(proposals(0, decidedRow + decidedRow))
    expect(done.cards).toEqual([])
    expect(pendingReason(done, read(''))).toBeUndefined()
  })

  it('« Tâches proposées » en attente : une carte, avec les boutons de la ligne en attente', () => {
    // Le pied de la carte ne porte que l'aide clavier : les boutons sont sur les lignes.
    const waiting = read(proposals(1, decidedRow + pendingRow))
    expect(waiting.cards).toEqual([
      expect.objectContaining({
        type: 'propositions',
        buttons: ['Refuser', 'Faire ici', 'Lancer']
      })
    ])
    expect(pendingReason(waiting, read(''))?.code).toBe('carte')
  })

  it('repondre vise la carte en attente, pas une carte « Tâches proposées » traitée plus bas', async () => {
    const dom = makeDom(`<div id="root">${memoryCard}${proposals(0, decidedRow)}</div>`, MAIN_URL, {
      api: true
    })
    const clicks = []
    const page = { ev: async (e) => dom.window.eval(e), mouse: async (x, y) => clicks.push([x, y]) }
    expect(await answerCard(page, 'Retenir')).toBe('Retenir')
    expect(clicks).toHaveLength(1)
  })
})
