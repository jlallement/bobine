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

/** Pages de l'app (sans les outils de développement), ou rien si le port ne répond pas. */
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

/** Fenêtre principale : ni la fenêtre rapide (fiche 062), ni l'aide, ni « À propos ». */
export const mainPage = (pages) =>
  pages.find((t) => !/#(quick|help|about)/.test(t.url) && !t.url.includes('about:blank'))

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
 * Se connecte à la fenêtre principale. Lève une erreur lisible si Bobine ne répond pas (arrêtée,
 * autre port).
 */
export async function connect(port) {
  const page = mainPage(await listPages(port))
  if (!page) throw new Error(`Bobine ne répond pas sur le port ${port} (arrêtée ?)`)
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await within(
    new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('connexion DevTools refusée'))
    }),
    JSON_TIMEOUT_MS,
    'connexion DevTools'
  )
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id) {
      pending.get(d.id)?.(d)
      pending.delete(d.id)
    }
  }
  const send = (method, params = {}) =>
    within(
      new Promise((resolve) => {
        const i = ++id
        pending.set(i, resolve)
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
  const key = async (name, { modifiers = 0 } = {}) => {
    const codes = { Enter: 13, Escape: 27, Tab: 9 }
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key: name,
        code: name,
        modifiers,
        windowsVirtualKeyCode: codes[name] ?? 0,
        ...(type === 'keyDown' && name === 'Enter' ? { text: '\r' } : {})
      })
    }
  }
  return {
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
    close: () => ws.close()
  }
}
