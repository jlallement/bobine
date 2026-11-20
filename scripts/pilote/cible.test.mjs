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
import { busy, pendingReason, Watcher } from './raison.mjs'

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
  // Carte de groupe (fiche 264) : ses lignes proposées, « Tout lancer » au pied tant qu'une attend.
  const proposals = (
    pending,
    rows
  ) => `<div class="work-group" data-testid="work-group" data-pending="${pending}" data-stage="${pending ? 'proposed' : 'decided'}">
    <div class="work-group-head"><strong data-testid="work-group-title">${pending ? '3 travaux proposés' : '3 travaux'}</strong>${pending ? '' : '<span data-testid="work-group-counts">· 2 lancés, 1 fait ici</span>'}</div>
    <div class="work-group-rows">${rows}</div>
    ${pending ? '<div class="work-group-foot"><span class="work-group-note">Chaque travail part du dernier commit.</span><button data-testid="work-group-start-all">Tout lancer</button></div>' : ''}</div>`
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

  it('carte de groupe toute décidée : pas en attente, même avec son bouton « Lancer »', () => {
    const done = read(proposals(0, decidedRow + decidedRow))
    expect(done.cards).toEqual([])
    expect(pendingReason(done, read(''))).toBeUndefined()
  })

  it('carte-réponse d’un rôle (fiche 263) : lue ; sa suite n’est pas un message du fil', () => {
    const shot = read(`<div data-testid="thread">
      <div class="msg-user">Bonjour</div>
      <div class="role-request-group">
        <div class="msg-user role-request-bubble">Expert UX/UI Propose une direction.</div>
        <div data-testid="work-card" data-role="ux-ui-expert" data-state="replied">
          <div data-testid="work-body">Direction calme.</div>
          <div class="work-follow-up"><div class="msg-user">Et les contrastes ?</div></div>
          <div data-testid="work-body">Contrastes AA.</div>
        </div>
      </div></div>`)
    expect(shot.messages).toBe(2)
    expect(shot.lastUser).toBe('Expert UX/UI Propose une direction.')
    expect(shot.works).toEqual([
      { role: 'ux-ui-expert', state: 'replied', answer: 'Contrastes AA.' }
    ])
  })

  it('carte de groupe en attente : une carte, les boutons de la ligne en attente et « Tout lancer »', () => {
    const waiting = read(proposals(1, decidedRow + pendingRow))
    expect(waiting.cards).toEqual([
      expect.objectContaining({
        type: 'propositions',
        title: '3 travaux proposés',
        buttons: ['Refuser', 'Faire ici', 'Lancer', 'Tout lancer']
      })
    ])
    expect(pendingReason(waiting, read(''))?.code).toBe('carte')
  })

  it('carte de groupe (fiche 264) : lignes, état, fusion ; une ligne en cours fait attendre', () => {
    const shot =
      read(`<div data-testid="thread"><div class="work-group" data-testid="work-group" data-pending="0" data-stage="working">
      <div class="work-group-head"><strong data-testid="work-group-title">2 travaux</strong><span data-testid="work-group-counts">· 1 en cours, 1 fini</span></div>
      <div class="work-group-rows">
        <div data-testid="work-row" data-state="running"><span data-testid="work-row-name">Expert UX/UI — Relire</span></div>
        <div data-testid="work-row" data-state="replied"><span data-testid="work-row-name">API</span><span data-testid="subtask-merge-state">fusionné</span></div>
      </div>
      <div class="work-group-merge"><div data-testid="subtasks-merge-result">1 fusionné dans main en 3 s.</div></div>
    </div></div>`)
    expect(shot.groups).toEqual([
      {
        title: '2 travaux',
        stage: 'working',
        counts: '1 en cours, 1 fini',
        rows: [
          { name: 'Expert UX/UI — Relire', state: 'running', merge: '' },
          { name: 'API', state: 'replied', merge: 'fusionné' }
        ],
        merge: '1 fusionné dans main en 3 s.',
        buttons: []
      }
    ])
    expect(shot.cards).toEqual([])
    expect(busy(shot)).toBe(true)
    expect(formatState(shot)).toContain('Carte de groupe : 2 travaux · 1 en cours, 1 fini')
    expect(formatState(shot)).toContain('  Fusion : 1 fusionné dans main en 3 s.')
  })

  it('fusion en cours dans une carte : `attendre` attend ; une carte dépliée n’est pas un travail de plus', () => {
    const shot =
      read(`<div data-testid="thread"><div class="work-group" data-testid="work-group" data-pending="0">
      <strong data-testid="work-group-title">1 travail</strong>
      <div data-testid="work-row" data-state="replied"><span data-testid="work-row-name">API</span>
        <div class="work-card in-group" data-testid="work-card" data-state="replied"><div data-testid="work-body">Fait.</div></div>
      </div>
      <div class="work-group-merge"><div class="subtasks-merge" data-testid="subtasks-merge" data-status="running"><div data-testid="subtasks-merge-progress">Fusion dans main : 0 sur 1…</div></div></div>
    </div></div>`)
    expect(shot.works).toBeUndefined()
    expect(shot.merging).toBe(true)
    expect(busy(shot)).toBe(true)
  })

  it('repondre vise la carte en attente, pas une carte de groupe décidée plus bas', async () => {
    const dom = makeDom(`<div id="root">${memoryCard}${proposals(0, decidedRow)}</div>`, MAIN_URL, {
      api: true
    })
    const clicks = []
    const page = { ev: async (e) => dom.window.eval(e), mouse: async (x, y) => clicks.push([x, y]) }
    expect(await answerCard(page, 'Retenir')).toBe('Retenir')
    expect(clicks).toHaveLength(1)
  })
})
