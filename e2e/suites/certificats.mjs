import { execFileSync } from 'node:child_process'
import { X509Certificate } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

/**
 * Navigateur intégré et certificat auto-signé (fiche 269, ADR-0063) : avertissement à la place de
 * la page, « Continuer » derrière « Avancé », « Non sécurisé », certificat changé redemandé, outils
 * de l'agent refusés, exception révoquée dans les Réglages ; le reste de l'app refuse toujours.
 */
export async function certificatsSuite(scheme) {
  console.log(`\n— Navigateur : certificats auto-signés (${scheme})`)
  const dir = mkdtempSync(join(tmpdir(), 'bob-e2e-certificats-'))
  const first = selfSigned(dir, 'premier')
  const second = selfSigned(dir, 'second')
  const server = createServer({ key: first.key, cert: first.cert }, (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<title>Dev HTTPS</title><h1>Serveur de dev</h1>')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const url = `https://localhost:${port}/`
  try {
    await withApp(
      scheme,
      async (ui) => {
        const main = await mainProcess()
        try {
          await certificateChecks(ui, main, { url, port, server, first, second })
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
    server.closeAllConnections()
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

async function certificateChecks(ui, main, { url, port, server, first, second }) {
  const warning = ui.$('certificate-warning')
  const viewTitle = () => main.evaluate(`${VIEW}?.webContents.getTitle() ?? null`)
  const until = async (test, ms = 8000) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if (await test()) return true
      await sleep(100)
    }
    return false
  }

  // L'agent ouvre la page : refusée, l'avertissement est dans le panneau, ses outils le disent.
  await ui.ready()
  await ui.send('/scenario certificat')
  await ui.ready()
  const refused = await ui.lastAgentText()
  check(
    refused.includes('ERR_CERT_AUTHORITY_INVALID') &&
      refused.includes('Only the user can decide') &&
      !refused.includes('Serveur de dev'),
    `outils de l’agent refusés : ni navigation ni lecture, l’utilisateur seul décide (${refused.slice(0, 160)})`
  )
  await ui.waitFor(`!!${warning}`)
  check(
    (await ui.ev(`${warning}.innerText`)).includes(L('browser.certificate.title')) &&
      !(await ui.ev(`!!${ui.$('certificate-proceed')}`)),
    'avertissement à la place de la page, « Continuer » caché derrière « Avancé »'
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

  await ui.click(ui.$('certificate-advanced'))
  await ui.waitFor(`!!${ui.$('certificate-proceed')}`)
  check(
    (await ui.ev(`${ui.$('certificate-fingerprint')}.textContent`)) === first.fingerprint &&
      (await ui.ev(`${ui.$('certificate-details')}.innerText`)).includes(`localhost:${port}`),
    'Avancé : hôte, port et empreinte SHA-256 exacte du certificat'
  )
  await ui.ev(`${ui.$('certificate-proceed')}.scrollIntoView({ block: 'end' })`)
  await ui.shot('269-avance-ouvert')

  // « Continuer » (pour la session) : la page s'affiche, « Non sécurisé » dans la barre.
  await ui.click(ui.$('certificate-proceed'))
  await ui.waitFor(`!${warning} && !!${ui.$('browser-insecure')}`)
  check(
    await until(async () => (await viewTitle()) === 'Dev HTTPS'),
    'Continuer : la page du serveur auto-signé s’affiche, « Non sécurisé » dans la barre'
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

  // Certificat régénéré (serveur relancé) : redemandé, avec sa nouvelle empreinte.
  server.setSecureContext({ key: second.key, cert: second.cert })
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
      kept[0].port === port,
    '« Se souvenir » : seul le certificat retenu est écrit (hôte, port, empreinte)'
  )

  await ui.click(ui.$('open-settings'))
  await ui.waitFor(`!!${ui.$('settings')}`)
  await ui.click(ui.$('settings-privacy'))
  await ui.waitFor(`!!${ui.$('settings-accepted-certificates')}`)
  const rows = `[...document.querySelectorAll('[data-testid=forget-certificate]')].map((b) => b.closest('li'))`
  const listed = await ui.ev(`${rows}.map((li) => li.innerText.replace(/\\s+/g, ' '))`)
  check(
    listed.length === 2 &&
      listed.some((t) => t.includes(L('settings.privacy.certificates.remembered'))) &&
      listed.some((t) => t.includes(L('settings.privacy.certificates.session'))) &&
      listed.every((t) => t.includes(`localhost:${port}`)) &&
      listed.some((t) => t.includes(second.fingerprint.slice(0, 11))) &&
      listed.some((t) => t.includes(first.fingerprint.slice(0, 11))),
    `Réglages : les deux certificats acceptés, retenu et cette session (${listed.join(' | ')})`
  )
  await ui.shot('269-reglages-exceptions')

  // Révoquer le certificat retenu (celui du serveur) : la page retombe sur l'avertissement.
  await ui.click(
    `${rows}.find((li) => li.innerText.includes(${JSON.stringify(L('settings.privacy.certificates.remembered'))})).querySelector('[data-testid=forget-certificate]')`
  )
  await ui.waitFor(`!!${ui.$('confirm-row')}`)
  await ui.click(ui.$('confirm-row-confirm'))
  await ui.waitFor(`document.querySelectorAll('[data-testid=forget-certificate]').length === 1`)
  check((await stored()).length === 0, 'révoqué : plus rien dans approvals.json')
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
  await ui.waitFor(`!!${warning}`)
  check(
    !(await ui.ev(`!!${ui.$('browser-insecure')}`)),
    'révoqué : la page rechargée retombe sur l’avertissement, plus de « Non sécurisé »'
  )

  // « Retour » : l'avertissement se ferme sans rien accorder.
  await ui.click(ui.$('certificate-back'))
  await ui.waitFor(`!${warning}`)
  check(
    (await stored()).length === 0 && !(await ui.ev(`!!${ui.$('browser-insecure')}`)),
    '« Retour » : l’avertissement se ferme, rien d’accordé'
  )
}
