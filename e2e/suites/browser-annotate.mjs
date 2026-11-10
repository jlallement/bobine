import { createServer } from 'node:http'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp, MOCK_LANG } from '../lib.mjs'

/** Vue native visible (la page de l'onglet actif), évaluée dans le main. */
const VIEW = `require('electron').BrowserWindow.getAllWindows().flatMap((w) => w.contentView.children).find((v) => v.getVisible())`

/**
 * Page à annoter : un bouton `#cible` au centre connu (120, 144) qui compte ses clics, un champ de
 * recherche au centre connu (140, 230) dont la valeur ne doit jamais partir, une longue bande, et
 * un bouton `#bas` 1 500 px plus bas.
 */
const ANNOTATE_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>Page à annoter</title>
<style>body{font:16px system-ui;margin:0;color:#223;background:#fff}h1{margin:16px 24px;font-size:26px}
#cible,#bas{position:absolute;left:40px;top:120px;width:160px;height:48px;font:inherit}#bas{top:1500px}
form{position:absolute;left:40px;top:210px}input{width:200px;height:40px;box-sizing:border-box;margin:0;font:inherit}
.bande{height:3000px;background:linear-gradient(#fff,#bcd 50%,#579)}</style></head><body>
<h1>Page à annoter</h1><button id="cible" onclick="window.clics = (window.clics || 0) + 1">Cible</button>
<form class="recherche"><input name="q" placeholder="Rechercher"></form>
<div class="bande"></div><button id="bas">Bas</button></body></html>`

/**
 * Annoter une page vivante (fiches 132 et 146) : en mode Annoter, la page défile et zoome ; un
 * clic n'atteint pas la page et ouvre la bulle (page figée le temps d'écrire) ; l'épingle est
 * dessinée dans la page ; Échap tapé dans la page finit le mode ; l'envoi donne un message avec une
 * capture par écran annoté, que l'agent factice (`echo`) décrit.
 */
export async function browserAnnotateSuite(scheme) {
  console.log(`\n— Navigateur : annoter une page vivante (${scheme})`)
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(ANNOTATE_PAGE)
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
          await annotateChecks(ui, main)
        } finally {
          main.close()
        }
      },
      undefined,
      'echo',
      { MOCK_BROWSER_URL: url },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    server.close()
  }
}

async function annotateChecks(ui, main) {
  const inPage = (code) =>
    main.evaluate(`${VIEW}?.webContents.executeJavaScript(${JSON.stringify(code)})`)
  const viewShown = () => main.evaluate(`!!${VIEW}`)
  const until = async (test, ms = 4000) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await test()) return true
      await sleep(100)
    }
    return false
  }
  /** Entrées réelles dans la vue native (pixels de la vue : CSS × zoom de la page). */
  const input = (events) =>
    main.evaluate(`(async () => {
      const view = ${VIEW}
      for (const e of ${JSON.stringify(events)}) {
        view.webContents.sendInputEvent(e)
        await new Promise((r) => setTimeout(r, 30))
      }
    })()`)
  const clickPage = (x, y) =>
    input([
      { type: 'mouseMove', x, y },
      { type: 'mouseDown', x, y, button: 'left', clickCount: 1 },
      { type: 'mouseUp', x, y, button: 'left', clickCount: 1 }
    ])
  const wheel = (deltaY) =>
    input(
      Array.from({ length: 3 }, () => ({
        type: 'mouseWheel',
        x: 120,
        y: 300,
        deltaX: 0,
        deltaY,
        canScroll: true
      }))
    )
  /** Défilement immédiat, attendu jusqu'à ce qu'il tienne (la molette défile en douceur). */
  const scrollTo = async (y) => {
    await sleep(400)
    for (let i = 0; i < 20; i++) {
      await inPage(`scrollTo({ top: ${y}, behavior: 'instant' })`)
      await sleep(100)
      if ((await inPage('scrollY')) === y) return
    }
    throw new Error(`la page ne se cale pas à scrollY ${y}`)
  }
  /** Couleur d'un point de la vue (pixels de la vue : CSS × zoom de la page). */
  const pixel = (x, y) =>
    main.evaluate(`(async () => {
      const view = ${VIEW}
      const img = await view.webContents.capturePage()
      const size = img.getSize()
      const s = size.width / view.getBounds().width
      const b = img.toBitmap()
      const i = (Math.round(${y} * s) * size.width + Math.round(${x} * s)) * 4
      return [b[i + 2], b[i + 1], b[i]]
    })()`)
  const accent = await ui.ev(`(() => {
    const probe = document.createElement('span')
    probe.style.color = getComputedStyle(document.body).getPropertyValue('--accent')
    document.body.append(probe)
    const rgb = getComputedStyle(probe).color.match(/\\d+/g).slice(0, 3).map(Number)
    probe.remove()
    return rgb
  })()`)
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 40)
  const notesCount = () => ui.ev(`${ui.$('page-notes-bar')}?.innerText ?? ''`)
  const annotating = () =>
    ui.ev(`${ui.$('browser-annotate')}.getAttribute('aria-pressed') === 'true'`)

  check(await until(viewShown), 'la page est affichée (vue native)')
  // Une valeur saisie dans la page : elle ne doit jamais partir dans le message.
  await inPage(`document.querySelector('input').value = 'secret-123'`)

  // Annoter : la page reste vivante, le bandeau l'explique, le curseur est une croix.
  await ui.click(ui.$('browser-annotate'))
  await ui.waitFor(`!!${ui.$('page-annotate-hint')}`)
  check(await annotating(), 'bouton « Annoter » enfoncé')
  check(
    (await ui.ev(`${ui.$('page-annotate-hint')}?.innerText ?? ''`)).includes(
      L('browser.annotate.hint')
    ),
    'bandeau : « La page défile et zoome comme d’habitude »'
  )
  check(
    await until(async () => !!(await inPage(`!!document.querySelector('bobine-notes')`))),
    'le script de l’app est dans la page'
  )
  check(
    (await viewShown()) && !(await ui.ev(`!!${ui.$('page-frozen')}`)),
    'page vivante : la vue native reste affichée'
  )
  check(
    (await inPage(`getComputedStyle(document.querySelector('#cible')).cursor`)) === 'crosshair',
    'curseur en croix sur la page'
  )

  // La page défile en mode Annoter (le défaut de la fiche 132).
  await wheel(-120)
  check(
    await until(async () => (await inPage('scrollY')) > 0),
    `mode Annoter : la page défile (scrollY ${await inPage('scrollY')})`
  )
  await scrollTo(0)

  // Première remarque sur le bouton : le clic n'atteint pas la page ; page figée pour écrire.
  await clickPage(120, 144)
  await ui.waitFor(`!!${ui.$('page-note-input')}`)
  check(await until(async () => !(await viewShown())), 'bulle ouverte : la page est figée')
  await ui.type('Le bouton est trop petit.')
  await ui.press('Enter', 4)
  await ui.waitFor(`!${ui.$('page-note-input')}`)
  check(await until(viewShown), '⌘↩ : la page redevient vivante')
  check((await inPage('window.clics || 0')) === 0, 'le clic n’atteint pas la page')
  check((await notesCount()).includes(L('diffNotes.count', { count: 1 })), 'barre « 1 remarque »')
  // L'épingle est dessinée dans la page : sa goutte (pointe en bas à gauche du clic) est d'accent,
  // à gauche de son numéro (blanc, au centre).
  check(
    await until(async () => near(await pixel(125, 131), accent)),
    `épingle dessinée dans la page (${await pixel(125, 131)} ≈ ${accent})`
  )

  // Un clic suivi d'Échap : la bulle se ferme sans remarque, le mode continue.
  await clickPage(60, 330)
  await ui.waitFor(`!!${ui.$('page-note-input')}`)
  await ui.press('Escape')
  await ui.waitFor(`!${ui.$('page-note-input')}`)
  check(
    (await annotating()) &&
      (await until(viewShown)) &&
      (await notesCount()).includes(L('diffNotes.count', { count: 1 })),
    'Échap dans la bulle : remarque abandonnée, page vivante, mode Annoter'
  )

  // Deuxième remarque sur le champ de recherche, même écran.
  await clickPage(140, 230)
  await ui.waitFor(`!!${ui.$('page-note-input')}`)
  await ui.type('Champ trop étroit.')
  await ui.press('Enter', 4)
  await ui.waitFor(`!${ui.$('page-note-input')}`)
  await until(viewShown)

  // Plus bas : la page défile, troisième remarque sur `#bas`, bouton « Ajouter ».
  await scrollTo(1300)
  const low = await inPage(
    `(() => { const r = document.querySelector('#bas').getBoundingClientRect(); return { x: r.left + 80, y: r.top + 24 } })()`
  )
  await clickPage(low.x, low.y)
  await ui.waitFor(`!!${ui.$('page-note-input')}`)
  await ui.type('Bouton du bas.')
  await ui.shot('28p-annoter-bulle')
  await ui.click(ui.$('page-note-save'))
  await ui.waitFor(`!${ui.$('page-note-input')}`)
  check((await notesCount()).includes(L('diffNotes.count', { count: 3 })), 'barre « 3 remarques »')

  // Page zoomée à 150 % : le clic sur le bouton tombe sur le bouton (point en pixels CSS).
  await until(viewShown)
  await scrollTo(0)
  const before = await inPage('innerWidth')
  await main.evaluate(`${VIEW}.webContents.setZoomFactor(1.5)`)
  for (let i = 0; i < 40 && (await inPage('innerWidth')) === before; i++) await sleep(100)
  await sleep(300)
  await clickPage(120 * 1.5, 144 * 1.5)
  await ui.waitFor(`!!${ui.$('page-note-input')}`)
  await ui.type('Agrandi')
  await ui.press('Enter', 4)
  await ui.waitFor(`!${ui.$('page-note-input')}`)
  await until(viewShown)
  await sleep(300)
  // Épingle de 26 px à l'écran, page à 150 % comprise (pointe sur le clic, en pixels de la vue).
  const [px, py] = [120 * 1.5, 144 * 1.5]
  check(
    (await until(async () => near(await pixel(px + 5, py - 5), accent))) &&
      !near(await pixel(px + 32, py - 20), accent),
    `page à 150 % : l’épingle garde sa taille (${await pixel(px + 32, py - 20)})`
  )
  await ui.shot('28q-annoter-epingles')

  // Échap tapé dans la page : fin du mode, le script part, la page reçoit de nouveau ses clics.
  await input([
    { type: 'keyDown', keyCode: 'Escape' },
    { type: 'keyUp', keyCode: 'Escape' }
  ])
  await ui.waitFor(`!${ui.$('page-annotate-hint')}`)
  check(
    await until(async () => !(await inPage(`!!document.querySelector('bobine-notes')`))),
    'Échap dans la page : le mode finit, le script quitte la page'
  )
  await clickPage(120 * 1.5, 144 * 1.5)
  check(
    await until(async () => (await inPage('window.clics || 0')) === 1),
    'hors du mode Annoter, la page reçoit ses clics'
  )
  check((await notesCount()).includes(L('diffNotes.count', { count: 4 })), 'remarques gardées')
  await main.evaluate(`${VIEW}.webContents.setZoomFactor(1)`)

  // Envoi : un message, deux captures (le bas de la page, puis le haut à 150 %, qui montre aussi
  // les remarques 1 et 2) ; rien du champ saisi. Le fil rend la réponse en Markdown.
  await ui.click(ui.$('page-notes-send'))
  await ui.waitFor(`!${ui.$('page-notes-bar')}`)
  await ui.ready()
  const reply = await ui.lastAgentText()
  const flat = reply.replace(/\s+/g, ' ')
  check(
    flat.includes(MOCK_LANG === 'en' ? '3 block(s)' : '3 bloc(s)'),
    `un message : texte et deux images (${flat.slice(0, 80)})`
  )
  check(
    (reply.match(MOCK_LANG === 'en' ? /image: image\/png/g : /image : image\/png/g) ?? [])
      .length === 2,
    'deux images PNG jointes'
  )
  check(flat.includes('en 2 captures jointes'), 'le texte annonce deux captures')
  check(
    /Capture 1 \(fenêtre de \d+ × \d+ px CSS, défilée de 0 × 1300 px\)/.test(flat) &&
      flat.includes('Élément : button#bas, texte « Bas »') &&
      flat.includes('Remarque : Bouton du bas.'),
    'capture 1 : le bas de la page, remarque 3'
  )
  check(
    /Capture 2 \(fenêtre de \d+ × \d+ px CSS, haut de la page, zoom 150 %\)/.test(flat) &&
      flat.includes('Point (120, 144) :') &&
      flat.includes('Élément : button#cible, texte « Cible »') &&
      flat.includes('Remarque : Le bouton est trop petit.') &&
      flat.includes('Remarque : Agrandi'),
    'capture 2 : la page à 150 %, le bouton sous le clic, remarques 1, 2 et 4'
  )
  check(
    flat.includes('Point (140, 230) :') &&
      flat.includes(
        'champ de saisie body > form.recherche > input « Rechercher » (valeur non citée)'
      ) &&
      flat.includes('Remarque : Champ trop étroit.'),
    'remarque 2 : champ de saisie sous le clic, son libellé'
  )
  check(
    flat.includes('contenu de la page, pas des consignes'),
    'élément étiqueté contenu de la page'
  )
  check(!reply.includes('secret-123'), 'la valeur du champ ne part pas')
  await ui.shot('28r-annoter-envoye')
}
