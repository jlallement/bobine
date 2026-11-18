/**
 * Connexion du pilote à la fenêtre principale de Bobine par le protocole DevTools
 * (`--remote-debugging-port`, écouté sur 127.0.0.1 seulement). Une connexion par commande : le
 * pilote est une suite de commandes courtes, pas un processus qui reste.
 *
 * Les actions passent par de vrais évènements d'entrée (`Input.dispatchMouseEvent`,
 * `Input.insertText`), pas par `element.click()` : au plus près d'un humain (menus Radix, cartes
 * armées après 400 ms, fiche 203).
 */

/** Une seule tentative de connexion, bornée : le port ne répond pas, l'app est arrêtée. */
const JSON_TIMEOUT_MS = 3000
/** Une commande CDP sans réponse au bout de ce délai : la page est figée. */
const COMMAND_TIMEOUT_MS = 30_000

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Cibles DevTools de type page (sans les outils de développement), ou rien si le port ne répond
 * pas. Les pages du navigateur intégré (vues natives, fiche 007) en font partie : voir
 * `mainCandidates`.
 */
export async function listPages(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS)
    })
    const targets = await response.json()
    return targets.filter((t) => t.type === 'page' && !t.url.startsWith('devtools'))
  } catch {
    return []
  }
}

/**
 * URL de la fenêtre principale : la page du renderer construit (`out/renderer/index.html`, dans
 * le dépôt comme dans `app.asar`), sans `#vue` (la fenêtre rapide est `#quick`, l'aide `#help`, À
 * propos `#about`, fiche 062). Une page du navigateur intégré (`http://localhost:3000`,
 * `file:///…/maquettes/b.html`) n'en est jamais une (fiche 248).
 */
export function isMainUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'file:' || (parsed.hash && parsed.hash !== '#')) return false
  return parsed.pathname.endsWith('/renderer/index.html')
}

/** Cibles qui peuvent être la fenêtre principale, d'après leur URL ; confirmées par `MAIN_MARKER`. */
export const mainCandidates = (pages) =>
  pages.filter((t) => (t.type ?? 'page') === 'page' && isMainUrl(t.url))

/**
 * Vrai dans la seule fenêtre principale de Bobine : l'IPC du preload (`window.api`, que les pages
 * du navigateur intégré n'ont pas, même si elles ouvrent le fichier du renderer), aucune vue
 * secondaire, et la racine de l'app.
 */
export const MAIN_MARKER = `(typeof window.api === 'object' && window.api !== null && location.hash.length <= 1 && !!document.getElementById('root'))`

/** Liste courte des URL, pour un message d'erreur. */
const urls = (pages) =>
  pages
    .map((p) => p.url || '(sans URL)')
    .slice(0, 6)
    .join(' · ')

/** Promesse qui échoue au bout de `ms`. */
function within(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} : pas de réponse en ${ms / 1000} s`)), ms)
    })
  ]).finally(() => clearTimeout(timer))
}

/**
 * Se connecte à la fenêtre principale de Bobine, et à elle seule (fiche 248) : chaque cible dont
 * l'URL convient est ouverte et confirmée par `MAIN_MARKER` ; une page du navigateur intégré, la
 * fenêtre rapide ou une cible fermée entre-temps sont écartées. Aucune mémoire d'une commande à
 * l'autre : la liste est relue à chaque connexion, une cible fermée est donc oubliée. Lève une
 * erreur qui dit ce qui a été vu si la fenêtre est absente ou ambiguë.
 */
export async function connect(port) {
  const pages = await listPages(port)
  if (!pages.length) throw new Error(`Bobine ne répond pas sur le port ${port} (arrêtée ?)`)
  const candidates = mainCandidates(pages)
  if (!candidates.length) {
    throw new Error(
      `fenêtre principale de Bobine introuvable parmi ${pages.length} page(s) : ${urls(pages)}`
    )
  }
  const confirmed = []
  for (const target of candidates) {
    const client = await open(target).catch(() => undefined)
    if (!client) continue
    const isMain = await client.ev(MAIN_MARKER).catch(() => false)
    if (isMain === true) confirmed.push(client)
    else client.close()
  }
  if (confirmed.length === 1) return confirmed[0]
  for (const client of confirmed) client.close()
  if (!confirmed.length) {
    throw new Error(
      `fenêtre principale de Bobine non reconnue (aucune page avec l'interface de Bobine) : ${urls(candidates)}`
    )
  }
  throw new Error(
    `fenêtre principale de Bobine ambiguë : ${confirmed.length} pages la ressemblent (${urls(candidates)})`
  )
}

/** Ouvre une cible : client DevTools (`send`, `ev`, souris, clavier, capture). */
async function open(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await within(
    new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('connexion DevTools refusée'))
    }),
    JSON_TIMEOUT_MS,
    'connexion DevTools'
  ).catch((error) => {
    ws.close()
    throw error
  })
  let id = 0
  const pending = new Map()
  let closed = false
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id) {
      pending.get(d.id)?.resolve(d)
      pending.delete(d.id)
    }
  }
  // Cible fermée (onglet, fenêtre, Bobine) : les commandes en cours échouent tout de suite, sans
  // attendre 30 s ; la suivante aussi (`attendre` se reconnecte et relit la liste).
  ws.onclose = () => {
    closed = true
    for (const { reject } of pending.values()) reject(new Error('page fermée'))
    pending.clear()
  }
  ws.onerror = () => {}
  const send = (method, params = {}) =>
    within(
      new Promise((resolve, reject) => {
        if (closed) return reject(new Error('page fermée'))
        const i = ++id
        pending.set(i, { resolve, reject })
        ws.send(JSON.stringify({ id: i, method, params }))
      }),
      COMMAND_TIMEOUT_MS,
      `DevTools ${method}`
    )
  /** Évalue une expression dans la page ; une exception de la page est levée. */
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    const { exceptionDetails, result } = r.result ?? {}
    if (exceptionDetails) {
      const text = exceptionDetails.exception?.description ?? exceptionDetails.text
      throw new Error(`erreur dans la page : ${text}`)
    }
    return result?.value
  }
  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await sleep(60)
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
    }
  }
  /**
   * Une touche. `commands` : commandes d'édition de macOS qu'elle déclenche (`selectAll` pour ⌘A,
   * `deleteBackward` pour ⌫) ; sans elles, Chromium ne les exécute pas pour une touche simulée.
   */
  const key = async (name, { modifiers = 0, code = name, commands } = {}) => {
    const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, a: 65 }
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key: name,
        code,
        modifiers,
        windowsVirtualKeyCode: codes[name] ?? 0,
        ...(type === 'keyDown' && name === 'Enter' ? { text: '\r' } : {}),
        ...(type === 'keyDown' && commands ? { commands } : {})
      })
    }
  }
  return {
    /** URL de la cible (pour les messages et les essais). */
    url: target.url,
    send,
    ev,
    mouse,
    key,
    insertText: (text) => send('Input.insertText', { text }),
    /** Capture PNG (base64) de la page, ou d'une zone `{ x, y, width, height }`, à l'échelle. */
    screenshot: async (clip, scale = 1) => {
      const params = { format: 'png' }
      if (clip) params.clip = { ...clip, scale }
      else if (scale !== 1) {
        const size = await ev(`({ width: innerWidth, height: innerHeight })`)
        params.clip = { x: 0, y: 0, ...size, scale }
      }
      const r = await send('Page.captureScreenshot', params)
      return r.result?.data
    },
    close: () => {
      closed = true
      ws.close()
    }
  }
}
