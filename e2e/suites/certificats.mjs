import { execFileSync } from 'node:child_process'
import { createHash, X509Certificate } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/** Vue native visible (la page de l'onglet actif), évaluée dans le main. */
const VIEW = `require('electron').BrowserWindow.getAllWindows().flatMap((w) => w.contentView.children).find((v) => v.getVisible())`

/**
 * Certificat auto-signé `CN=localhost`, comme celui d'un serveur de développement (Vite
 * `basic-ssl`, Webpack `server: 'https'`) : fait par `openssl` dans le dossier de l'essai, jamais
 * installé nulle part.
 */
function selfSigned(dir, name) {
  const key = join(dir, `${name}-key.pem`)
  const cert = join(dir, `${name}.pem`)
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'ec',
      '-pkeyopt',
      'ec_paramgen_curve:prime256v1',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '2',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1'
    ],
    { stdio: 'ignore' }
  )
  const pem = readFileSync(cert, 'utf8')
  return {
    key: readFileSync(key, 'utf8'),
    cert: pem,
    fingerprint: new X509Certificate(pem).fingerprint256.toUpperCase()
  }
}

/** Nom hors du poste, résolu vers 127.0.0.1 par Chromium seulement : un « site public ». */
const PUBLIC_HOST = 'bobine-e2e.example'
/** Nom en `.test` résolu vers 127.0.0.1 : l'adresse contactée est vérifiée, puis permise. */
const DEV_HOST = 'monapp.test'

/** Page du serveur de dev : une WebSocket `wss:` ouverte (rechargement à chaud), un bouton popup. */
const devPage = (port) =>
  '<title>Dev HTTPS</title><h1>Serveur de dev</h1>' +
  '<button style="position:fixed;left:0;top:80px;width:400px;height:200px" ' +
  "onclick=\"window.open('/deux', 'connexion', 'width=400,height=400')\">Popup</button>" +
  `<script>new WebSocket('wss://localhost:${port}/ws')</script>`

/** Poignée de main WebSocket minimale (RFC 6455) : la connexion reste ouverte, comptée. */
function acceptWebSocket(req, socket, sockets) {
  const accept = createHash('sha1')
    .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
  )
  sockets.add(socket)
  // Trame de fermeture du navigateur (opcode 8) : on répond et on ferme, comme un vrai serveur.
  socket.on('data', (frame) => {
    if ((frame[0] & 0x0f) === 8) socket.end(Buffer.from([0x88, 0]))
  })
  socket.on('close', () => sockets.delete(socket))
  socket.on('error', () => sockets.delete(socket))
}

/**
 * Navigateur intégré et certificat auto-signé (fiche 269, ADR-0064) : avertissement à la place de
 * la page, « Continuer » derrière « Avancé », « Non sécurisé » (même par une sous-ressource),
 * certificat changé redemandé, outils de l'agent refusés, popups sans exception, exception
 * révoquée (Réglages, puce) avec ses WebSocket fermées, site public sans « Continuer », nom en
 * `.test` vérifié ; le reste de l'app refuse toujours.
 */
export async function certificatsSuite(scheme) {
  console.log(`\n— Navigateur : certificats auto-signés (${scheme})`)
  const dir = mkdtempSync(join(tmpdir(), 'bob-e2e-certificats-'))
  const first = selfSigned(dir, 'premier')
  const second = selfSigned(dir, 'second')
  const sockets = new Set()
  const server = createServer({ key: first.key, cert: first.cert }, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      req.url === '/deux'
        ? '<title>Deux</title><h1>Page deux</h1>'
        : req.url === '/pixel'
          ? ''
          : devPage(server.address().port)
    )
  })
  server.on('upgrade', (req, socket) => acceptWebSocket(req, socket, sockets))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const url = `https://localhost:${port}/`
  // Page http ordinaire qui charge une image du serveur sous exception (sous-ressource seule).
  const plain = createHttpServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<title>Page http</title><img src="https://localhost:${port}/pixel" alt="">`)
  })
  await new Promise((r) => plain.listen(0, '127.0.0.1', r))
  const plainUrl = `http://127.0.0.1:${plain.address().port}/`
  try {
    await withApp(
      scheme,
      async (ui) => {
        const main = await mainProcess()
        try {
          const context = { url, port, server, first, second, sockets, plainUrl }
          await warningAndContinue(ui, main, context)
          await subresourceAndPopup(ui, main, context)
          await changedRememberedRevoked(ui, main, context)
          await chipRevokePublicAndDevName(ui, main, context)
        } finally {
          main.close()
        }
      },
      undefined,
      'demo',
      { MOCK_BROWSER_URL: url },
      [
        `--inspect=${MAIN_PORT}`,
        `--host-resolver-rules=MAP ${PUBLIC_HOST} 127.0.0.1, MAP ${DEV_HOST} 127.0.0.1`
      ]
    )
  } finally {
    for (const socket of sockets) socket.destroy()
    server.closeAllConnections()
    server.close()
    plain.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Attend une condition (fonction asynchrone), au plus `ms`. */
async function until(test, ms = 8000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (await test()) return true
    await sleep(100)
  }
  return false
}

/** Adresse tapée dans la barre du panneau, validée par Entrée. */
async function typeAddress(ui, address) {
  await ui.ev(`${ui.$('browser-address')}.focus()`)
  await ui.ev(`${ui.$('browser-address')}.select()`)
  await ui.type(address)
  await ui.enter()
}

const viewTitle = (main) => main.evaluate(`${VIEW}?.webContents.getTitle() ?? null`)

async function warningAndContinue(ui, main, { url, port, first, sockets }) {
  const warning = ui.$('certificate-warning')
  // L'agent ouvre la page : refusée, l'avertissement est dans le panneau, ses outils le disent.
  await ui.ready()
  await ui.send('/scenario certificat')
  await ui.ready()
  const refused = await ui.lastAgentText()
  check(
    refused.includes('ERR_CERT_AUTHORITY_INVALID') &&
      refused.includes('do not insist') &&
      !refused.includes('try again') &&
      !refused.includes('Serveur de dev'),
    `outils de l’agent refusés : ni navigation ni lecture, sans l’inviter à insister (${refused.slice(0, 160)})`
  )
  await ui.waitFor(`!!${warning}`)
  check(
    (await ui.ev(`${warning}.innerText`)).includes(L('browser.certificate.title')) &&
      (await ui.ev(`${warning}.innerText`)).includes(`localhost:${port}`) &&
      !(await ui.ev(`!!${ui.$('certificate-proceed')}`)),
    'avertissement à la place de la page (hôte et port), « Continuer » caché derrière « Avancé »'
  )
  check(
    await until(async () => (await main.evaluate(`!${VIEW}`)) === true),
    'vue native de la page masquée sous l’avertissement'
  )
  check(
    !(await ui.ev(`!!document.querySelector('.browser-error')`)),
    'plus de ligne rouge « ERR_CERT_AUTHORITY_INVALID (-202) » sous la barre'
  )
  await ui.shot('269-avertissement')

  // « Revenir en lieu sûr » sans page précédente : une page vide, rien d'accordé.
  await ui.click(ui.$('certificate-back'))
  await ui.waitFor(`!${warning} && !!document.querySelector('.browser-page .side-panel-empty')`)
  check(
    !(await ui.ev(`!!${ui.$('browser-insecure')}`)),
    '« Revenir en lieu sûr » sans page précédente : page vide, rien d’accordé'
  )
  await ui.shot('269-retour-page-vide')
  await ui.send('/scenario certificat')
  await ui.ready()
  await ui.waitFor(`!!${warning}`)

  await ui.click(ui.$('certificate-advanced'))
  await ui.waitFor(`!!${ui.$('certificate-proceed')}`)
  check(
    (await ui.ev(`${ui.$('certificate-fingerprint')}.textContent`)) === first.fingerprint &&
      (await ui.ev(`${ui.$('certificate-details')}.innerText`)).includes(`localhost:${port}`) &&
      (await ui.ev(`${ui.$('certificate-advanced')}.getAttribute('aria-expanded')`)) === 'true',
    'Avancé : hôte, port et empreinte SHA-256 exacte du certificat'
  )
  await ui.ev(`${ui.$('certificate-proceed')}.scrollIntoView({ block: 'end' })`)
  await ui.shot('269-avance-ouvert')

  // « Continuer » (pour la session) : la page s'affiche, « Non sécurisé » dans la barre.
  await ui.click(ui.$('certificate-proceed'))
  await ui.waitFor(`!${warning} && !!${ui.$('browser-insecure')}`)
  check(
    (await until(async () => (await viewTitle(main)) === 'Dev HTTPS')) &&
      (await ui.ev(`${ui.$('browser-address')}.value`)).startsWith(`localhost:${port}`),
    'Continuer : la page s’affiche, « Non sécurisé » et l’hôte et le port dans la barre'
  )
  check(
    await until(async () => sockets.size > 0),
    'la WebSocket wss: de la page (rechargement à chaud) passe sous l’exception'
  )
  await ui.shot('269-site-non-securise')

  // L'exception vaut pour le panneau seulement : une fenêtre de l'app et le réseau du main refusent.
  const elsewhere = await main.evaluate(`(async () => {
    const { BrowserWindow, net } = require('electron')
    const window = new BrowserWindow({ show: false })
    let page
    try {
      await window.loadURL(${JSON.stringify(url)})
      page = 'ouverte'
    } catch (error) {
      page = String(error.message)
    } finally {
      window.destroy()
    }
    let fetched
    try {
      await net.fetch(${JSON.stringify(url)})
      fetched = 'lue'
    } catch (error) {
      fetched = String(error.message)
    }
    return { page, fetched }
  })()`)
  check(
    /ERR_CERT/.test(elsewhere.page) && /ERR_CERT/.test(elsewhere.fetched),
    `ailleurs que dans le panneau, toujours refusé (fenêtre : ${elsewhere.page.slice(0, 60)} ; net : ${elsewhere.fetched.slice(0, 60)})`
  )

  // Accordée par l'utilisateur, l'exception vaut aussi pour l'agent, sur ce certificat.
  await ui.send('/scenario certificat')
  await ui.ready()
  check(
    (await ui.lastAgentText()).includes('Serveur de dev'),
    'après « Continuer » de l’utilisateur, l’agent lit la page'
  )
}

async function subresourceAndPopup(ui, main, { url, plainUrl, port }) {
  // Une page http qui ne charge qu'une image du site sous exception : « Non sécurisé » aussi.
  await typeAddress(ui, plainUrl)
  await until(async () => (await viewTitle(main)) === 'Page http')
  check(
    await until(async () => await ui.ev(`!!${ui.$('browser-insecure')}`)),
    'sous-ressource chargée sous l’exception : « Non sécurisé » sur une page http'
  )
  await typeAddress(ui, url)
  await until(async () => (await viewTitle(main)) === 'Dev HTTPS')
  await ui.waitFor(`!!${ui.$('browser-insecure')}`)

  // Popup de l'utilisateur vers le même site : aucune exception, un message clair.
  await sleep(2000)
  await main.evaluate(`(() => {
    const page = ${VIEW}.webContents
    for (const type of ['mouseDown', 'mouseUp']) page.sendInputEvent({ type, x: 60, y: 160, button: 'left', clickCount: 1 })
    return true
  })()`)
  const popupText = () =>
    main.evaluate(`(async () => {
      const { BrowserWindow } = require('electron')
      const popup = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('data:text/html'))
      return popup ? await popup.webContents.executeJavaScript('document.body.innerText') : null
    })()`)
  let text = null
  await until(async () => !!(text = await popupText()))
  const leaked = await main.evaluate(
    `require('electron').BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.webContents.getURL().endsWith('/deux'))`
  )
  check(
    !!text &&
      text.includes(L('browser.certificate.popupTitle')) &&
      text.includes(`localhost:${port}`) &&
      !leaked,
    `popup vers un site sous exception : refusée, avec un message (${String(text).slice(0, 80)})`
  )
  await main.evaluate(
    `require('electron').BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('data:text/html')).forEach((w) => w.close()); true`
  )
  await until(
    async () =>
      !(await main.evaluate(
        `require('electron').BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('data:'))`
      ))
  )
}

async function changedRememberedRevoked(ui, main, { port, server, second, sockets }) {
  const warning = ui.$('certificate-warning')
  // Certificat régénéré (serveur relancé) : redemandé, avec sa nouvelle empreinte.
  server.setSecureContext({ key: second.key, cert: second.cert })
  for (const socket of sockets) socket.destroy()
  server.closeAllConnections()
  await ui.click(`document.querySelector('.browser-bar [aria-label="${L('browser.reload')}"]')`)
  await ui.waitFor(`!!${warning}`)
  await ui.click(ui.$('certificate-advanced'))
  await ui.waitFor(`!!${ui.$('certificate-fingerprint')}`)
  check(
    (await ui.ev(`${ui.$('certificate-fingerprint')}.textContent`)) === second.fingerprint &&
      !(await ui.ev(`!!${ui.$('browser-insecure')}`)),
    'certificat changé : l’avertissement revient, avec la nouvelle empreinte'
  )

  // Retenu cette fois : écrit dans approvals.json, et listé dans les Réglages.
  await ui.click(ui.$('certificate-remember'))
  await ui.click(ui.$('certificate-proceed'))
  await ui.waitFor(`!${warning} && !!${ui.$('browser-insecure')}`)
  const approvalsFile = await main.evaluate(
    `require('node:path').join(require('electron').app.getPath('userData'), 'approvals.json')`
  )
  const stored = () =>
    main.evaluate(
      `(() => { try { return JSON.parse(require('node:fs').readFileSync(${JSON.stringify(approvalsFile)}, 'utf8')).certificates ?? [] } catch { return [] } })()`
    )
  const kept = await stored()
  check(
    kept.length === 1 &&
      kept[0].fingerprint === second.fingerprint &&
      kept[0].host === 'localhost' &&
      kept[0].port === port &&
      kept[0].error === 'net::ERR_CERT_AUTHORITY_INVALID',
    '« Se souvenir » : seul le certificat retenu est écrit (hôte, port, empreinte, code)'
  )
  check(await until(async () => sockets.size > 0), 'WebSocket rouverte sous le certificat retenu')

  await ui.click(ui.$('open-settings'))
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-privacy'))
  await ui.waitFor(`!!${ui.$('settings-accepted-certificates')}`)
  const rows = `[...document.querySelectorAll('[data-testid=forget-certificate]')].map((b) => b.closest('li'))`
  const listed = await ui.ev(
    `${rows}.map((li) => ({ text: li.innerText.replace(/\\s+/g, ' '), title: li.querySelector('.settings-list-side')?.title ?? '' }))`
  )
  const always = L('settings.privacy.certificates.remembered')
  const session = L('settings.privacy.certificates.session')
  check(
    listed.length === 2 &&
      listed[0].text.includes(always) &&
      listed[0].title.includes(second.fingerprint) &&
      listed[1].text.includes(session) &&
      listed[1].text.includes(L('settings.privacy.certificates.stale')) &&
      listed.every(
        (row) => row.text.includes(`localhost:${port}`) && !row.text.includes('SHA-256')
      ),
    `Réglages : « toujours » d’abord, puis l’ancien de la session ; empreinte en infobulle (${listed.map((r) => r.text).join(' | ')})`
  )
  await ui.shot('269-reglages-exceptions')

  // Révoquer le certificat retenu (celui du serveur) : WebSocket fermée, avertissement de retour.
  await ui.click(`${rows}[0].querySelector('[data-testid=forget-certificate]')`)
  await ui.waitFor(`!!${ui.$('confirm-row')}`)
  await ui.click(ui.$('confirm-row-confirm'))
  await ui.waitFor(`document.querySelectorAll('[data-testid=forget-certificate]').length === 1`)
  check((await stored()).length === 0, 'révoqué : plus rien dans approvals.json')
  check(
    await until(async () => sockets.size === 0),
    `révoqué : la WebSocket ouverte sous l’exception est fermée (${sockets.size} ouverte(s))`
  )
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
  await ui.waitFor(`!!${warning}`)
  check(
    !(await ui.ev(`!!${ui.$('browser-insecure')}`)) && sockets.size === 0,
    'révoqué : la page rechargée retombe sur l’avertissement, plus de « Non sécurisé »'
  )

  // « Revenir en lieu sûr » : la dernière page d'un autre site (la page http), rien d'accordé.
  await ui.click(ui.$('certificate-back'))
  await ui.waitFor(`!${warning}`)
  check(
    (await until(async () => (await viewTitle(main)) === 'Page http')) &&
      (await stored()).length === 0,
    '« Revenir en lieu sûr » : la dernière page d’un autre site, rien d’accordé'
  )
}

async function chipRevokePublicAndDevName(ui, main, { url, port, server, first, sockets }) {
  const warning = ui.$('certificate-warning')
  // Le premier certificat est encore accepté pour la session : le serveur le présente de nouveau.
  server.setSecureContext({ key: first.key, cert: first.cert })
  for (const socket of sockets) socket.destroy()
  server.closeAllConnections()
  await typeAddress(ui, url)
  await ui.waitFor(`!!${ui.$('browser-insecure')}`)
  // Puce « Non sécurisé » : son menu révoque l'exception de la page.
  await ui.click(ui.$('browser-insecure'))
  await ui.waitFor(`!!${ui.$('browser-insecure-menu')}`)
  check(
    (await ui.ev(`${ui.$('browser-insecure-menu')}.innerText`)).includes(
      L('browser.insecure.menuLabel', { site: `localhost:${port}` })
    ),
    'puce « Non sécurisé » : « Certificat accepté pour <site> »'
  )
  await ui.click(ui.$('browser-insecure-revoke'))
  await ui.waitFor(`!!${warning}`)
  check(
    !(await ui.ev(`!!${ui.$('browser-insecure')}`)),
    'puce : « Ne plus accepter » révoque, l’avertissement revient'
  )

  // Site public : refus dit d'emblée, pas de « Continuer », « Ouvrir dans le navigateur ».
  await typeAddress(ui, `https://${PUBLIC_HOST}:${port}/`)
  await ui.waitFor(`!!${ui.$('certificate-not-allowed')}`)
  await ui.click(ui.$('certificate-advanced'))
  await ui.waitFor(`!!${ui.$('certificate-details')}`)
  check(
    !(await ui.ev(`!!${ui.$('certificate-proceed')}`)) &&
      (await ui.ev(`!!${ui.$('certificate-open-external')}`)) &&
      (await ui.ev(`${ui.$('certificate-advanced')}.innerText`)).includes(
        L('browser.certificate.details')
      ),
    'site public : pas de « Continuer », « Ouvrir dans le navigateur », « Détails »'
  )
  await ui.shot('269-site-public')

  // Nom en `.test` : l'adresse que Chromium contacte est vérifiée (ici 127.0.0.1), puis permis.
  await typeAddress(ui, `https://${DEV_HOST}:${port}/`)
  await ui.waitFor(
    `!!${warning} && ${warning}.innerText.includes(${JSON.stringify(DEV_HOST)}) && !${ui.$('certificate-checking')}`
  )
  await ui.click(ui.$('certificate-advanced'))
  check(
    await until(async () => await ui.ev(`!!${ui.$('certificate-proceed')}`)),
    `nom en .test vers une IP locale : « Continuer » proposé après vérification de l’adresse`
  )
}
