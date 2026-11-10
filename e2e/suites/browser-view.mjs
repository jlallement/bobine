import { createServer } from 'node:http'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'
import { VIEW_PAGE } from '../pages.mjs'

/** Vue native visible (la page de l'onglet actif), évaluée dans le main. */
const VIEW = `require('electron').BrowserWindow.getAllWindows().flatMap((w) => w.contentView.children).find((v) => v.getVisible())`
/** Fenêtre de l'app qui porte les pages. */
const WIN = `require('electron').BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0)`

/** Touche envoyée à la page comme par le clavier (Electron), avec ses modificateurs. */
const keyEvents = (keyCode, modifiers = []) => [
  { type: 'keyDown', keyCode, modifiers },
  ...(keyCode === 'Space' ? [{ type: 'char', keyCode: ' ' }] : []),
  { type: 'keyUp', keyCode, modifiers }
]

/**
 * La page du navigateur intégré défile, suit la colonne, le panneau agrandi et le zoom de
 * l'interface, a son propre zoom et ses raccourcis ; la taille imposée par l'agent tient dans le
 * panneau et s'annule à la fin de son tour (fiche 129). Molette et touches arrivent à la page par
 * `sendInputEvent`, comme celles de macOS ; l'essai à la vraie souris reste à faire à part.
 */
export async function browserViewSuite(scheme) {
  console.log(`\n— Navigateur : défilement, zoom, taille (${scheme})`)
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(req.url === '/deux' ? '<title>Deux</title><h1>Page deux</h1>' : VIEW_PAGE)
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
          await viewChecks(ui, main, url)
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

async function viewChecks(ui, main, url) {
  const inPage = (code) =>
    main.evaluate(`${VIEW}?.webContents.executeJavaScript(${JSON.stringify(code)})`)
  const input = (events) =>
    main.evaluate(`(async () => {
      const view = ${VIEW}
      for (const event of ${JSON.stringify(events)}) {
        view.webContents.sendInputEvent(event)
        await new Promise((r) => setTimeout(r, 40))
      }
      return true
    })()`)
  /** Attend une condition (fonction asynchrone), au plus `ms`. */
  const until = async (test, ms = 4000) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await test()) return true
      await sleep(100)
    }
    return false
  }
  const geometry = async () => ({
    view: await main.evaluate(`${VIEW}?.getBounds() ?? null`),
    uiZoom: await main.evaluate(`${WIN}.webContents.getZoomFactor()`),
    area: await ui.ev(
      `(() => { const r = ${ui.$('browser-page')}.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`
    ),
    inner: await inPage('innerWidth')
  })
  /** La vue couvre exactement la zone (pixels de la fenêtre = CSS × zoom de l'interface). */
  const exact = (g) =>
    !!g.view &&
    ['x', 'y', 'width', 'height'].every((k) => Math.abs(g.view[k] - g.area[k] * g.uiZoom) <= 1.5)
  const show = (g) =>
    `vue ${JSON.stringify(g.view)}, zone ${JSON.stringify(g.area)} × ${g.uiZoom}, innerWidth ${g.inner}`
  let g
  const settled = async (extra = () => true) =>
    until(async () => {
      g = await geometry()
      return exact(g) && extra(g)
    })
  const followsArea = (g) => Math.abs(g.inner - g.area.width * g.uiZoom) <= 1

  check(await settled(followsArea), `la page couvre la zone, innerWidth = sa largeur (${show(g)})`)

  // Défilement : molette (trackpad compris) et clavier, comme macOS les donne à la page.
  await input(
    [1, 2, 3].map(() => ({
      type: 'mouseWheel',
      x: 120,
      y: 200,
      deltaX: 0,
      deltaY: -120,
      canScroll: true
    }))
  )
  check(
    await until(async () => (await inPage('scrollY')) > 0),
    `molette : la page défile (scrollY ${await inPage('scrollY')})`
  )
  await ui.shot('28v-navigateur-defile')
  await inPage('scrollTo(0, 0)')
  await input([...keyEvents('Space'), ...keyEvents('Down')])
  check(
    await until(async () => (await inPage('scrollY')) > 0),
    `clavier (espace, flèche) : la page défile (scrollY ${await inPage('scrollY')})`
  )
  await inPage('scrollTo(0, 0)')

  // Colonne élargie à la poignée : la page se remet en page à la nouvelle largeur.
  const handle = await ui.ev(
    `(() => { const b = document.querySelector('.side-panel-resize').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + 200 } })()`
  )
  const before = g.area.width
  await ui.drag(handle, { x: handle.x - 140, y: handle.y })
  check(
    await settled((g) => followsArea(g) && g.area.width > before + 60),
    `colonne élargie : innerWidth suit (${before} → ${show(g)})`
  )

  // Panneau agrandi, puis réduit : la page suit.
  await ui.click(ui.$('panel-maximize'))
  await ui.waitFor(`${ui.$('side-panel')}.classList.contains('maximized')`)
  check(
    await settled((g) => followsArea(g) && g.area.width > before + 200),
    `panneau agrandi : la page prend toute la largeur (${show(g)})`
  )
  await ui.shot('28w-navigateur-agrandi')
  await ui.click(ui.$('panel-maximize'))
  await ui.waitFor(`!${ui.$('side-panel')}.classList.contains('maximized')`)
  check(await settled(followsArea), `panneau réduit : la page suit (${show(g)})`)

  // Interface zoomée de 80 à 150 % : la vue reste exactement sur la zone.
  for (const zoom of [0.8, 1.5]) {
    await main.evaluate(`(${WIN}.webContents.setZoomFactor(${zoom}), true)`)
    if (zoom === 1.5) {
      // Fenêtre de 853 px CSS : le panneau ne laisse plus 500 px à la conversation, il se replie
      // (fiche 173) ; rouvert à la main, il reste ouvert (choix de l'utilisateur).
      await ui.waitFor(`!${ui.$('side-panel')}`)
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${ui.$('browser-page')}`)
    }
    check(
      await settled((g) => Math.abs(g.uiZoom - zoom) < 0.01 && followsArea(g)),
      `interface à ${zoom * 100} % : vue exacte (${show(g)})`
    )
    if (zoom === 1.5) await ui.shot('28x-interface-150')
  }
  // « Taille réelle » du menu, clavier dans l'interface : c'est elle qui revient à 100 %.
  await main.evaluate(`(() => {
    ${WIN}.webContents.focus()
    require('electron').Menu.getApplicationMenu().getMenuItemById('reset-zoom').click()
    return true
  })()`)
  check(
    await settled((g) => Math.abs(g.uiZoom - 1) < 0.01 && followsArea(g)),
    `menu « Taille réelle », interface au focus : l’interface revient à 100 % (${show(g)})`
  )

  // Zoom de la page : ⌘+ tapé dans la page, puce dans le champ d'adresse.
  const chip = () => ui.ev(`${ui.$('browser-zoom')}?.innerText ?? ''`)
  await input(keyEvents('=', ['meta']))
  await ui.waitFor(`!!${ui.$('browser-zoom')}`)
  check(
    (await chip()) === L('browser.zoom.chip', { percent: 110 }) &&
      (await settled((g) => Math.abs(g.inner - Math.floor(g.view.width / 1.1)) <= 1)) &&
      (await main.evaluate(`${WIN}.webContents.getZoomFactor()`)) === 1,
    `⌘+ dans la page : la page seule à 110 %, puce « ${await chip()} » (${show(g)})`
  )
  await input(keyEvents('-', ['meta']))
  await ui.waitFor(`!${ui.$('browser-zoom')}`)
  check(true, '⌘− dans la page : retour à 100 %, plus de puce')
  // Le menu Présentation, page au focus : c'est la page qui zoome. Le focus natif n'existe que si
  // l'app est au premier plan (pas toujours vrai en parallèle) : sinon, ⌘+ et l'essai à la souris.
  const pageFocused = await main.evaluate(`(() => {
    const { Menu, webContents } = require('electron')
    const page = ${VIEW}.webContents
    page.focus()
    if (webContents.getFocusedWebContents() !== page) return false
    Menu.getApplicationMenu().getMenuItemById('zoom-in').click()
    return true
  })()`)
  if (pageFocused) {
    await ui.waitFor(`!!${ui.$('browser-zoom')}`)
    check(
      (await chip()) === L('browser.zoom.chip', { percent: 110 }) &&
        (await main.evaluate(`${WIN}.webContents.getZoomFactor()`)) === 1,
      `menu « Zoom avant », page au focus : la page zoome, pas l’interface (« ${await chip()} »)`
    )
  } else {
    console.log('    (app au second plan : menu « Zoom avant » page au focus non essayé ici)')
    await input(keyEvents('=', ['meta']))
    await ui.waitFor(`!!${ui.$('browser-zoom')}`)
  }
  await input([...keyEvents('=', ['meta']), ...keyEvents('=', ['meta'])])
  await ui.waitFor(
    `${ui.$('browser-zoom')}?.innerText === ${JSON.stringify(L('browser.zoom.chip', { percent: 150 }))}`
  )
  await ui.shot('28y-page-150')

  // L'agent clique au bon endroit sur la page zoomée à 150 % (coordonnées CSS).
  await ui.send('/scenario navigateur-clic')
  await ui.ready()
  await settled()
  const css = Math.floor(g.view.width / 1.5)
  const reply = await ui.lastAgentText()
  check(
    reply.includes('Clics : 1') && reply.includes(`fenêtre : ${css}×`),
    `page à 150 % : l’agent clique juste, en pixels CSS (${reply.replace(/\s+/g, ' ').slice(0, 160)})`
  )
  await ui.click(ui.$('browser-zoom'))
  await ui.waitFor(`!${ui.$('browser-zoom')}`)
  check(await settled(followsArea), `clic sur la puce : la page revient à 100 % (${show(g)})`)

  await shortcuts(ui, inPage, input, url)
  await agentResize(ui, { inPage, input, until, geometry, settled, followsArea, show })
}

/** ⌘L, ⌘R, ⌘[ et ⌘] tapés dans la page. */
async function shortcuts(ui, inPage, input, url) {
  await input(keyEvents('L', ['meta']))
  check(
    await ui
      .waitFor(`document.activeElement === ${ui.$('browser-address')}`, 3000)
      .catch(() => false),
    '⌘L dans la page : le champ d’adresse prend le clavier'
  )
  await ui.ev(`${ui.$('browser-address')}.blur()`)
  const loads = Number(await inPage('sessionStorage.n'))
  await input(keyEvents('R', ['meta']))
  let reloaded = false
  for (let i = 0; i < 40 && !reloaded; i++) {
    await sleep(100)
    reloaded = Number(await inPage('sessionStorage.n').catch(() => 0)) === loads + 1
  }
  check(reloaded, '⌘R dans la page : elle se recharge')
  await ui.ev(`${ui.$('browser-address')}.focus()`)
  await ui.ev(`${ui.$('browser-address')}.select()`)
  await ui.type(`${url}deux`)
  await ui.enter()
  await ui.waitFor(`${ui.$('browser-address')}.value.endsWith('/deux')`)
  await input(keyEvents('[', ['meta']))
  const back = await ui
    .waitFor(`${ui.$('browser-address')}.value.endsWith('/vue')`, 5000)
    .catch(() => false)
  await input(keyEvents(']', ['meta']))
  const forward = await ui
    .waitFor(`${ui.$('browser-address')}.value.endsWith('/deux')`, 5000)
    .catch(() => false)
  check(back && forward, '⌘[ et ⌘] dans la page : précédent, suivant')
  await input(keyEvents('[', ['meta']))
  await ui.waitFor(`${ui.$('browser-address')}.value.endsWith('/vue')`)
}

/** `browser_resize` de l'agent : la page tient entière, et la taille s'annule en fin de tour. */
async function agentResize(ui, { inPage, input, until, geometry, settled, followsArea, show }) {
  const card = `document.querySelector('[data-testid=permission]')`
  const emulationChip = `${ui.$('browser-emulation')}?.innerText ?? ''`
  await ui.send('/scenario navigateur-mobile')
  await ui.waitFor(`!!${card}`)
  const text = await ui.lastAgentText()
  check(
    text.includes('Mobile : 375×812 · clics : 1 · défilé : true') &&
      text.includes('Shown at') &&
      text.includes('reset at the end of your turn'),
    `taille mobile : l’agent clique juste et fait défiler (${text.replace(/\s+/g, ' ').slice(0, 200)})`
  )
  await ui.waitFor(`!!${ui.$('browser-emulation')}`)
  // La page entière tient dans la zone : réduite à l'échelle, jamais coupée, centrée en haut.
  let g
  const fits = await until(async () => {
    g = await geometry()
    return (
      !!g.view &&
      g.view.height <= g.area.height * g.uiZoom + 1.5 &&
      g.view.width <= g.area.width * g.uiZoom + 1.5 &&
      Math.abs(g.view.width / g.view.height - 375 / 812) < 0.02 &&
      Math.abs(g.view.y - g.area.y * g.uiZoom) <= 1.5
    )
  })
  check(
    fits &&
      (await ui.ev(emulationChip)) === L('browser.emulation.chip', { width: 375, height: 812 }),
    `taille imposée : l’écran 375 × 812 tient entier dans la zone, puce affichée (${show(g)})`
  )
  // Défilement doux de l'agent fini avant de repartir du haut (machine chargée, fiche 115).
  await sleep(800)
  await inPage('scrollTo(0, 0)')
  await input([{ type: 'mouseWheel', x: 60, y: 200, deltaX: 0, deltaY: -240, canScroll: true }])
  const scrolled = await until(async () => (await inPage('scrollY')) > 0, 6000)
  const wheelY = await inPage('scrollY')
  await sleep(800)
  const bottom = await until(() =>
    inPage(
      `(scrollTo(0, 1e6), Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 2)`
    )
  )
  check(
    scrolled && bottom,
    `taille imposée : la page défile à la molette (scrollY ${wheelY}), et jusqu’en bas`
  )
  // Défilement doux de la molette fini, puis deux images : `capturePage` rend la dernière dessinée.
  await sleep(800)
  await inPage('scrollTo(0, 0)')
  await inPage('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
  await ui.shot('28z-navigateur-mobile')
  await ui.click(`${card}.querySelector('button[data-kind=allow_once]')`)
  await ui.ready()
  check(
    (await settled(followsArea)) && !(await ui.ev(`!!${ui.$('browser-emulation')}`)),
    `fin du tour : la page a repris la largeur du panneau (${show(await geometry())})`
  )

  // La puce rend sa largeur à la page sans attendre la fin du tour.
  await ui.send('/scenario navigateur-mobile')
  await ui.waitFor(`!!${card}`)
  await ui.waitFor(`!!${ui.$('browser-emulation')}`)
  await ui.click(ui.$('browser-emulation'))
  await ui.waitFor(`!${ui.$('browser-emulation')}`)
  check(
    await settled(followsArea),
    `clic sur la puce de taille : la page reprend la largeur du panneau (${show(await geometry())})`
  )
  await ui.click(`${card}.querySelector('button[data-kind=allow_once]')`)
  await ui.ready()
}
