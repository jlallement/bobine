import { createServer } from 'node:http'
import { MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'
import { VIEW_PAGE } from '../pages.mjs'

/** Vue native visible (la page de l'onglet actif), évaluée dans le main. */
const VIEW = `require('electron').BrowserWindow.getAllWindows().flatMap((w) => w.contentView.children).find((v) => v.getVisible())`
/** Fenêtre de l'app qui porte les pages. */
const WIN = `require('electron').BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0)`

/** Ce que la page mesure d'elle-même : taille, thème, tactile, défilement. */
const MEASURE = `({
  w: innerWidth, h: innerHeight,
  dark: matchMedia('(prefers-color-scheme: dark)').matches,
  coarse: matchMedia('(pointer: coarse)').matches,
  hoverNone: matchMedia('(hover: none)').matches,
  touchPoints: navigator.maxTouchPoints,
  ontouchstart: 'ontouchstart' in window,
  loads: Number(sessionStorage.n),
  path: location.pathname
})`

const IPHONE_14 = { kind: 'preset', id: 'iphone-14', landscape: false, colorScheme: 'dark' }
const IPAD_PRO = { kind: 'preset', id: 'ipad-pro', landscape: false, colorScheme: null }

/**
 * Moteur du réglage de taille et de thème par l'utilisateur (fiche 295, lot 1, sans interface) :
 * le canal `browser:setDevice` appelé par le preload, comme le fera la barre « Appareil », sur une
 * page locale servie par l'essai (jamais un vrai site), avec l'agent factice. Ce que la sonde du
 * lot 0 a montré décisif : taille, tactile et thème vraiment pris par la page, gardés au
 * rechargement et à la navigation ; page réduite (clics de l'agent, molette jusqu'en bas, capture
 * figée d'Annoter) ; zoom de l'interface à 80 et 150 % ; essai de l'agent devant pendant son tour,
 * « Reprendre la main », réglage rendu exact à la fin du tour ; nouvel onglet ; refus du main.
 */
export async function browserDeviceSuite(scheme) {
  console.log(`\n— Navigateur : taille et thème réglés par l’utilisateur (${scheme})`)
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(VIEW_PAGE)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario navigateur-vue')
        await ui.ready()
        await ui.waitFor(`${ui.$('browser-address')}?.value.endsWith('/vue')`)
        const main = await mainProcess()
        try {
          await deviceChecks(ui, main, url)
        } finally {
          main.close()
        }
      },
      undefined,
      'demo',
      { MOCK_BROWSER_URL: url },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    server.close()
  }
}

async function deviceChecks(ui, main, url) {
  const id = await ui.ev(`window.api.conversations.get().then((s) => s.activeId)`)
  const state = () => ui.ev(`window.api.browser.getState(${JSON.stringify(id)})`)
  /** Réglage par le canal de l'interface ; rend « ok » ou le message du refus. */
  const setDevice = async (device, tabId) => {
    const tab = tabId ?? (await state()).activeTab
    return ui.ev(
      `window.api.browser.setDevice(${JSON.stringify(id)}, ${JSON.stringify(tab)}, ${JSON.stringify(device)}).then(() => 'ok', (e) => String(e.message))`
    )
  }
  const inPage = (code) =>
    main.evaluate(`${VIEW}?.webContents.executeJavaScript(${JSON.stringify(code)})`)
  const measure = () => inPage(MEASURE).catch(() => null)
  /** Attend un fait (fonction asynchrone vraie), au plus `ms` ; jamais une durée devinée. */
  const until = async (test, ms = 8000) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await test().catch(() => false)) return true
      await sleep(100)
    }
    return false
  }
  const systemDark = () => main.evaluate(`require('electron').nativeTheme.shouldUseDarkColors`)
  const geometry = async () => ({
    view: await main.evaluate(`${VIEW}?.getBounds() ?? null`),
    uiZoom: await main.evaluate(`${WIN}.webContents.getZoomFactor()`),
    area: await ui.ev(
      `(() => { const r = ${ui.$('browser-page')}.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`
    )
  })
  /**
   * La vue native est l'écran réduit pour tenir dans la zone (pixels de la fenêtre = CSS × zoom),
   * centrée en haut, jamais agrandie, et l'état annonce la même réduction (± 1 %).
   */
  const framed = (g, s, w, h) => {
    if (!g.view || !s?.emulation) return false
    const z = g.uiZoom
    const scale = Math.min(1, (g.area.width * z) / w, (g.area.height * z) / h)
    const width = w * scale
    const x = g.area.x * z + (g.area.width * z - width) / 2
    return (
      s.emulation.width === w &&
      s.emulation.height === h &&
      Math.abs(s.emulation.scale - scale) <= 0.01 &&
      Math.abs(g.view.width - width) <= 2 &&
      Math.abs(g.view.height - h * scale) <= 2 &&
      Math.abs(g.view.x - x) <= 2 &&
      Math.abs(g.view.y - g.area.y * z) <= 1.5
    )
  }
  const show = (m, s, g) =>
    `page ${JSON.stringify(m)}, état ${JSON.stringify({ emulation: s?.emulation, colorScheme: s?.colorScheme, control: s?.control })}${g ? `, vue ${JSON.stringify(g.view)}, zone ${JSON.stringify(g.area)} × ${g.uiZoom}` : ''}`
  let m, s, g
  /** Attend que la page, l'état et la vue disent `want` (taille, thème, qui a la main). */
  const settledOn = async (want, ms) =>
    until(async () => {
      m = await measure()
      s = await state()
      g = await geometry()
      if (!m || m.w !== want.w || m.h !== want.h || m.dark !== want.dark) return false
      if (s.control !== want.control) return false
      return want.panel ? !s.emulation : framed(g, s, want.w, want.h)
    }, ms)

  // Défaut : rien de réglé, la page suit le panneau.
  s = await state()
  check(
    !s.device && !s.control && !s.emulation && !s.agent,
    `sans réglage : ni réglage, ni essai, ni taille posée (${JSON.stringify(s)})`
  )

  // iPhone 14, sombre : taille, thème et tactile pris par la page, sans recharger (sonde S2).
  check((await setDevice(IPHONE_14)) === 'ok', 'réglage « iPhone 14 », sombre : accepté')
  check(
    (await settledOn({ w: 390, h: 844, dark: true, control: 'user' })) &&
      m.coarse &&
      m.hoverNone &&
      m.touchPoints >= 1 &&
      s.colorScheme === 'dark' &&
      JSON.stringify(s.device) === JSON.stringify(IPHONE_14),
    `iPhone 14 : 390 × 844, sombre, pointeur grossier, sans survol, tactile ; vue centrée en haut (${show(m, s, g)})`
  )
  await ui.shot('29a-reglage-iphone-14')

  // Rechargement : tout est gardé, et la page voit maintenant `ontouchstart` (sonde S3).
  const loads = m.loads
  await ui.ev(`window.api.browser.go(${JSON.stringify(id)}, 'reload')`)
  check(
    (await until(async () => (await measure())?.loads === loads + 1)) &&
      (await settledOn({ w: 390, h: 844, dark: true, control: 'user' })) &&
      m.ontouchstart,
    `rechargée : réglage gardé, \`ontouchstart\` présent (${show(m, s)})`
  )

  // Navigation vers une autre page : gardé (sonde S11).
  await ui.ev(`window.api.browser.navigate(${JSON.stringify(id)}, ${JSON.stringify(`${url}deux`)})`)
  check(
    (await until(async () => (await measure())?.path === '/deux')) &&
      (await settledOn({ w: 390, h: 844, dark: true, control: 'user' })),
    `autre page : réglage gardé (${show(m, s)})`
  )
  await ui.ev(`window.api.browser.go(${JSON.stringify(id)}, 'back')`)
  await until(async () => (await measure())?.path === '/vue')

  // Paysage : largeur et hauteur échangées.
  await setDevice({ ...IPHONE_14, landscape: true })
  check(
    await settledOn({ w: 844, h: 390, dark: true, control: 'user' }),
    `iPhone 14, paysage : 844 × 390 (${show(m, s, g)})`
  )

  // iPad Pro dans une zone plus petite : page entière, réduite, échelle juste ; thème Auto.
  await setDevice(IPAD_PRO)
  const dark = await systemDark()
  check(
    (await settledOn({ w: 1032, h: 1376, dark, control: 'user' })) &&
      s.emulation.scale < 1 &&
      !s.colorScheme,
    `iPad Pro : réduit à ${Math.round((s?.emulation?.scale ?? 0) * 100)} % pour tenir, thème du système (${show(m, s, g)})`
  )
  await ui.shot('29b-reglage-ipad-reduit')
  await wheelToBottom(ui, main, inPage, until)

  // L'agent clique juste sur la page réduite par le réglage de l'utilisateur (coordonnées CSS).
  await inPage(`scrollTo({ top: 0, behavior: 'instant' }); window.clics = 0`)
  await ui.send('/scenario navigateur-clic')
  await ui.ready()
  const reply = await ui.lastAgentText()
  check(
    reply.includes('Clics : 1') && reply.includes('fenêtre : 1032×1376'),
    `page réduite par le réglage : l’agent clique juste (${reply.replace(/\s+/g, ' ').slice(0, 160)})`
  )
  check(
    await settledOn({ w: 1032, h: 1376, dark, control: 'user' }),
    `fin de ce tour : le réglage reste (${show(m, s)})`
  )

  // Capture figée d'Annoter (fiches 132, 146) : fenêtre en pixels CSS de la taille réglée.
  const frozen = await ui.ev(
    `window.api.browser.freeze(${JSON.stringify(id)}).then((f) => f && { width: f.width, height: f.height, emulated: f.emulated })`
  )
  check(
    frozen?.width === 1032 && frozen?.height === 1376 && frozen?.emulated === true,
    `capture figée (Annoter) : fenêtre 1032 × 1376, émulée (${JSON.stringify(frozen)})`
  )

  await uiZoom(ui, main, settledOn, () => show(m, s, g), dark)
  await agentTurns(ui, setDevice, settledOn, () => show(m, s, g))
  await newTab(ui, main, id, url, state, measure, until)

  // Refus du main, par le vrai canal : rien ne change.
  const refusals = [
    await setDevice({ kind: 'custom', width: 199, height: 844, mobile: true, colorScheme: null }),
    await setDevice({ kind: 'custom', width: 390.5, height: 844, mobile: true, colorScheme: null }),
    await setDevice({ kind: 'preset', id: 'iphone-99', landscape: false, colorScheme: null }),
    await setDevice({ ...IPHONE_14, scale: 0.5 }),
    await setDevice(IPHONE_14, 'onglet-999')
  ]
  check(
    refusals.slice(0, 4).every((r) => r.includes('device')) &&
      refusals[4].includes('onglet-999') &&
      (await settledOn({ w: 390, h: 844, dark: true, control: 'user' })),
    `refus du main (199 px, décimale, appareil inconnu, échelle, onglet d’ailleurs) : réglage inchangé (${refusals.join(' | ')})`
  )

  // Barre fermée : largeur du panneau, thème Auto, plus de tactile.
  await setDevice(null)
  const closed = await until(async () => {
    m = await measure()
    s = await state()
    g = await geometry()
    return (
      !s.emulation &&
      !s.device &&
      !s.control &&
      !s.colorScheme &&
      Math.abs(m.w - g.area.width * g.uiZoom) <= 1 &&
      !m.coarse &&
      m.dark === (await systemDark())
    )
  })
  check(
    closed,
    `barre fermée : la page suit le panneau, thème du système, pointeur fin (${show(m, s, g)})`
  )
}

/** Molette native sur la page réduite, jusqu'en bas (fiche 129, sonde S15). */
async function wheelToBottom(ui, main, inPage, until) {
  await inPage(`scrollTo({ top: 0, behavior: 'instant' })`)
  const bottom = async () =>
    inPage(`Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 2`)
  const reached = await until(async () => {
    await main.evaluate(`(() => {
      const view = ${VIEW}
      view.webContents.sendInputEvent({ type: 'mouseMove', x: 40, y: 80 })
      view.webContents.sendInputEvent({ type: 'mouseWheel', x: 40, y: 80, deltaX: 0, deltaY: -1200, canScroll: true })
      return true
    })()`)
    return bottom()
  }, 15000)
  check(
    reached,
    `page réduite : la molette la fait défiler jusqu’en bas (scrollY ${await inPage('scrollY')})`
  )
}

/** Interface zoomée à 80 et 150 % avec une taille réglée : vue exacte, réglage inchangé. */
async function uiZoom(ui, main, settledOn, show, dark) {
  for (const zoom of [0.8, 1.5]) {
    await main.evaluate(`(${WIN}.webContents.setZoomFactor(${zoom}), true)`)
    if (zoom === 1.5) {
      // Fenêtre trop étroite : le panneau se replie (fiche 173) ; rouvert à la main, il reste.
      await ui.waitFor(`!${ui.$('side-panel')}`)
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${ui.$('browser-page')}`)
    }
    check(
      await settledOn({ w: 1032, h: 1376, dark, control: 'user' }),
      `interface à ${zoom * 100} % : vue posée sur l’écran réduit, réglage inchangé (${show()})`
    )
    if (zoom === 1.5) await ui.shot('29c-reglage-interface-150')
  }
  await main.evaluate(`(${WIN}.webContents.setZoomFactor(1), true)`)
  check(
    await settledOn({ w: 1032, h: 1376, dark, control: 'user' }),
    `interface à 100 % : la réduction suit (${show()})`
  )
}

/** Essai de l'agent pendant un réglage (fiche 295) : devant pendant le tour, réglage rendu. */
async function agentTurns(ui, setDevice, settledOn, show) {
  const card = `document.querySelector('[data-testid=permission]')`
  const allow = `${card}.querySelector('button[data-kind=allow_once]')`
  await setDevice(IPHONE_14)
  check(
    await settledOn({ w: 390, h: 844, dark: true, control: 'user' }),
    `iPhone 14 réglé avant le tour de l’agent (${show()})`
  )
  await ui.send('/scenario navigateur-mobile')
  await ui.waitFor(`!!${card}`)
  const text = await ui.lastAgentText()
  check(
    text.includes('Mobile : 375×812') &&
      text.includes("The user's own screen size and theme settings") &&
      !text.includes('The size is reset'),
    `l’agent essaie 375 × 812 et apprend que le réglage reviendra (${text.replace(/\s+/g, ' ').slice(0, 260)})`
  )
  check(
    await settledOn({ w: 375, h: 812, dark: true, control: 'agent' }),
    `pendant son tour : l’essai de l’agent s’applique, le thème de l’utilisateur reste (${show()})`
  )
  // « Reprendre la main » : le réglage de l'utilisateur, renvoyé tel quel, efface l'essai tout de suite.
  await setDevice(IPHONE_14)
  check(
    await settledOn({ w: 390, h: 844, dark: true, control: 'user' }),
    `« Reprendre la main » pendant le tour : le réglage revient tout de suite (${show()})`
  )
  await ui.click(allow)
  await ui.ready()
  check(
    await settledOn({ w: 390, h: 844, dark: true, control: 'user' }),
    `fin du tour : le réglage est toujours là (${show()})`
  )

  // Sans reprendre la main : la fin du tour rend le réglage exact.
  await ui.send('/scenario navigateur-mobile')
  await ui.waitFor(`!!${card}`)
  check(
    await settledOn({ w: 375, h: 812, dark: true, control: 'agent' }),
    `second tour : l’essai de l’agent s’applique (${show()})`
  )
  await ui.shot('29d-essai-agent-pendant-reglage')
  await ui.click(allow)
  await ui.ready()
  check(
    await settledOn({ w: 390, h: 844, dark: true, control: 'user' }),
    `fin du second tour : le réglage de l’utilisateur revient exactement (${show()})`
  )
}

/** Un onglet ouvert ensuite (lien « nouvel onglet ») prend le réglage de la conversation. */
async function newTab(ui, main, id, url, state, measure, until) {
  const before = (await state()).tabs.length
  await main.evaluate(
    `${VIEW}.webContents.executeJavaScript(${JSON.stringify(`window.open(${JSON.stringify(`${url}deux`)}); true`)}, true)`
  )
  let m
  const opened = await until(async () => {
    const s = await state()
    m = await measure()
    return (
      s.tabs.length === before + 1 && m?.path === '/deux' && m.w === 390 && m.h === 844 && m.dark
    )
  })
  check(opened, `nouvel onglet : il prend le réglage de la conversation (${JSON.stringify(m)})`)
  const s = await state()
  await ui.ev(`window.api.browser.closeTab(${JSON.stringify(id)}, ${JSON.stringify(s.activeTab)})`)
  await until(async () => (await state()).tabs.length === before)
}
