import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import { DEBUG_PAGE, TEST_PAGE } from '../pages.mjs'

/** Nom d'un site hors du poste, servi par le serveur de l'essai (fiche 249). */
const FOREIGN_HOST = 'bobine-e2e.example'

/** Bouton qui ouvre une fenêtre de connexion, en haut à gauche (fiche 072). */
const POPUP_PAGE =
  '<title>Popup</title><button style="position:fixed;left:0;top:0;width:400px;height:300px" ' +
  "onclick=\"window.open('/deux', 'connexion', 'width=400,height=400')\">Se connecter</button>"

/**
 * Bouton « Exporter » en haut à gauche : un CSV fait dans la page (`blob:`, révoqué aussitôt, comme
 * le font les bibliothèques d'export), téléchargé par un lien `download` (fiche 094).
 */
const EXPORT_PAGE =
  '<title>Export</title><button style="position:fixed;left:0;top:0;width:400px;height:300px" ' +
  "onclick=\"const a = document.createElement('a'); " +
  "a.href = window.URL.createObjectURL(new Blob(['titre;auteur\\nDune;Herbert\\n'], { type: 'text/csv' })); " +
  "a.download = 'export.csv'; a.click(); setTimeout(() => window.URL.revokeObjectURL(a.href))\">Exporter</button>"

/** Bouton « Supprimer » qui demande confirmation (`confirm()`, boîte de la page, fiche 097). */
const CONFIRM_PAGE =
  '<title>Confirmer</title><button style="position:fixed;left:0;top:0;width:400px;height:300px" ' +
  "onclick=\"document.title = confirm('Supprimer « Dune » ?') ? 'oui' : 'non'\">Supprimer</button>"

/** Carré qui glisse en 0,8 s au premier clic (planche contact, fiche 075). */
const ANIM_PAGE =
  '<title>Anime</title><body style="margin:0;height:100vh;background:#fff">' +
  '<div id="carre" style="position:absolute;left:0;top:40px;width:120px;height:120px;' +
  'background:#c63;transition:left .8s linear"></div>' +
  '<script>addEventListener("click", () => { carre.style.left = "500px" })</script>'

/** Navigateur intégré piloté par l'agent (fiches 007, 031). */
export async function browserSuite(scheme) {
  console.log(`\n— Navigateur intégré (${scheme})`)
  const server = createServer((req, res) => {
    if (req.url === '/api') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end('{"erreur":"boum"}')
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      req.url === '/deux'
        ? '<title>Deux</title><h1>Page deux</h1>'
        : req.url === '/popup'
          ? POPUP_PAGE
          : req.url === '/debug'
            ? DEBUG_PAGE
            : req.url === '/anime'
              ? ANIM_PAGE
              : req.url === '/export'
                ? EXPORT_PAGE
                : req.url === '/confirm'
                  ? CONFIRM_PAGE
                  : TEST_PAGE
    )
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/`
  // Site « extérieur » servi par le même serveur (fiche 249) : un nom hors du poste, résolu vers
  // 127.0.0.1 par Chromium seulement (`--host-resolver-rules`), sans réseau.
  const foreign = `http://${FOREIGN_HOST}:${server.address().port}/`
  const out = mkdtempSync(join(tmpdir(), 'bob-e2e-telechargement-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Teste la page')
        await ui.ready()
        if (!(await ui.lastAgentText()).includes('Bonjour, Ada !')) {
          console.log('    réponse :', (await ui.lastAgentText()).slice(0, 300))
          console.log(
            '    outils :',
            await ui.ev(
              `[...document.querySelectorAll('[data-testid=tool]')].map((t) => t.innerText.replace(/\\s+/g, ' ').slice(0, 160)).join(' || ')`
            )
          )
          console.log(
            '    messages :',
            await ui.ev(
              `[...document.querySelectorAll('.msg-user')].map((m) => m.innerText).join(' | ')`
            )
          )
        }
        check(
          (await ui.lastAgentText()).includes('Bonjour, Ada !'),
          'l’agent a saisi, cliqué et lu le résultat dans la vraie page'
        )
        // « Joindre au message » (fiche 066) : l'image arrive dans la zone de saisie, puis retirée.
        await ui.click(ui.$('browser-attach'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=attachment]')].some((a) => a.querySelector('img') && a.title.startsWith('${L('browser.capture.untitled')}'))`
        )
        check(true, 'page du navigateur jointe au message (image nommée d’après la page)')
        // Le « × » n'apparaît qu'au survol : retrait déclenché directement.
        await ui.ev(
          `[...document.querySelectorAll('[data-testid=attachment]')].find((a) => a.title.startsWith('${L('browser.capture.untitled')}')).querySelector('.attachment-remove').click()`
        )
        await ui.waitFor(`!document.querySelector('[data-testid=attachment]')`)

        // Détail de la carte rendu à son premier dépliage (fiche 192) : on la déplie.
        const readCard = `[...document.querySelectorAll('[data-testid=tool]')].find((t) => t.textContent.includes('${L('appTools.browser_read_page.default')}'))`
        await ui.ev(`(() => { ${readCard}.querySelector('details').open = true; return true })()`)
        await ui.waitFor(`!!${readCard}.querySelector('.tool-output')`)
        const tree = await ui.ev(`${readCard}.querySelector('.tool-output')?.textContent ?? ''`)
        if (process.env.E2E_SHOW_TREE) console.log(tree)
        check(
          tree.includes('textbox "Nom"') &&
            tree.includes('button "Valider"') &&
            tree.includes('link "Page deux"'),
          'lecture de la page par l’arbre d’accessibilité de Chromium'
        )
        check(
          await ui.ev(
            `(() => { const img = document.querySelector('[data-testid=tool-images] img'); return !!img && img.naturalWidth > 100 })()`
          ),
          'capture de l’agent affichée dans sa carte d’outil'
        )
        await ui.shot('24-navigateur')
        await ui.ev(`${ui.$('browser-address')}.focus()`)
        await ui.ev(`${ui.$('browser-address')}.select()`)
        await ui.type(`${url}deux`)
        // Entrée « réelle » (avec son caractère) : c'est elle qui valide un formulaire.
        await ui.enter()
        await ui.waitFor(
          `${ui.$('browser-address')}.value.endsWith('/deux') && !${ui.$('browser-address')}.matches(':focus')`
        )
        await ui.waitFor(
          `!document.querySelector('.browser-bar [aria-label="${L('browser.back')}"]').disabled`
        )
        check(true, 'adresse saisie par l’utilisateur : page ouverte, « Précédent » actif')
        await ui.click(`document.querySelector('.browser-bar [aria-label="${L('browser.back')}"]')`)
        await ui.waitFor(`${ui.$('browser-address')}.value === '${url}'`)
        check(true, '« Précédent » revient à la page de l’agent')

        await ui.send('/scenario debogage-web')
        await ui.ready()
        await ui.shot('27-onglets')
        await ui.click(
          `document.querySelectorAll('[data-testid=browser-tab-chip]')[1].querySelector('.browser-tab-close')`
        )
        await ui.waitFor(`!${ui.$('browser-tabs')}`)

        // Planche contact (fiche 075) : le carré filmé pendant qu'il glisse, en une image.
        await ui.send('/scenario planche-contact')
        await ui.ready()
        const sheet = await ui.lastAgentText()
        const frames = Number(/: (\d+) frames, numbered/.exec(sheet)?.[1] ?? 0)
        check(
          frames >= 3 && /Times: 1 → \d+ ms, 2 → \d+ ms/.test(sheet),
          `planche contact : le carré filmé pendant le clic (${frames} images différentes)`
        )
        // L'image arrive après le texte : le fil la suit jusqu'en bas (Chromium décale le
        // défilement en la chargeant, ce qui ne doit pas arrêter le suivi).
        check(
          (await ui.ev(
            `(() => { const s = document.querySelector('.main > .scroll'); return s.scrollHeight - s.scrollTop - s.clientHeight < 2 })()`
          )) && !(await ui.ev(`!!${ui.$('scroll-to-bottom')}`)),
          'planche reçue : le fil reste en bas, pas de flèche « Aller en bas »'
        )
        await ui.shot('28-planche-contact')

        // Outils appelés par du code, comme OpenCode 2 (fiche 079) : une carte « execute » prend
        // les libellés de ses outils, à la suite, et leurs captures.
        await ui.send('/scenario outils-execute')
        await ui.ready()
        await ui.shot('28d-outils-execute')
        // Un outil appelé par le code en erreur (OpenCode le dit dans `toolCalls[]`, la carte
        // « completed ») : la carte est en échec (fiche 122).
        await ui.send('/scenario outils-execute-erreur')
        await ui.ready()
        const failedCard = `[...document.querySelectorAll('[data-testid=tool]')].at(-1)`
        await ui.ev(`${failedCard}?.scrollIntoView({ block: 'center' })`)
        await ui.shot('28e-outils-execute-echec')

        // Popups (fiche 072), comme Claude Code : celle d'une action de l'agent est bloquée et il
        // est prié de demander ; celle d'un clic de l'utilisateur s'ouvre, liée à sa page.
        await ui.send('/scenario popup')
        await ui.ready()
        const popupMain = await mainProcess()
        try {
          const popupState = () =>
            popupMain.evaluate(`(async () => {
              const { BrowserWindow } = require('electron')
              const popup = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/deux'))
              return popup ? { opener: await popup.webContents.executeJavaScript('!!window.opener') } : null
            })()`)
          check((await popupState()) === null, 'aucune fenêtre ouverte par l’action de l’agent')
          // Clic de l'utilisateur : évènement natif dans la page, pas le CDP de l'agent ; après la
          // fenêtre où ce qui s'ouvre est encore attribué à l'agent (1,5 s).
          await new Promise((r) => setTimeout(r, 2000))
          await popupMain.evaluate(`(() => {
            const page = require('electron').webContents.getAllWebContents().find((w) => w.getURL().endsWith('/popup'))
            for (const type of ['mouseDown', 'mouseUp']) page.sendInputEvent({ type, x: 60, y: 60, button: 'left', clickCount: 1 })
            return true
          })()`)
          let state = null
          for (let i = 0; i < 50 && !state; i++) {
            state = await popupState()
            if (!state) await new Promise((r) => setTimeout(r, 100))
          }
          check(
            state?.opener === true,
            'popup ouverte par un clic de l’utilisateur : vraie fenêtre, liée à sa page'
          )
          await popupMain.evaluate(
            `require('electron').BrowserWindow.getAllWindows().filter((w) => w.webContents.getURL().endsWith('/deux')).forEach((w) => w.close()); true`
          )
          // Fermeture asynchrone : la suite compte sur la seule fenêtre de l'app. Rien n'est évalué
          // dans une popup qui se ferme (la réponse ne viendrait jamais).
          const popups = () =>
            popupMain.evaluate(
              `require('electron').BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && w.webContents.getURL().endsWith('/deux')).length`
            )
          for (let i = 0; i < 50 && (await popups()) > 0; i++) {
            await new Promise((r) => setTimeout(r, 100))
          }
        } finally {
          popupMain.close()
        }

        await siteGuard(ui, foreign)
        await downloads(ui, url, out)
        // En dernier : la boîte native d'Electron reste affichée sur la fenêtre.
        await pageDialog(ui)

        // Une fenêtre de l'app ouverte : la vue native (par-dessus toute la page) se masque, sinon
        // elle prendrait les clics de la fenêtre ; elle revient quand la fenêtre se ferme.
        const main = await mainProcess()
        try {
          const shown = () =>
            main.evaluate(
              `require('electron').BrowserWindow.getAllWindows()[0].contentView.children.some((v) => v.getVisible())`
            )
          const before = await shown()
          await ui.click(ui.$('open-settings'))
          await ui.waitFor(`!!${ui.$('settings')}`)
          await new Promise((r) => setTimeout(r, 300))
          const during = await shown()
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('settings')}`)
          await new Promise((r) => setTimeout(r, 300))
          check(
            before && !during && (await shown()),
            'fenêtre de l’app ouverte : page native masquée, puis réaffichée'
          )

          // Menu « + » du panneau (fiche 082) : il passe sur la page, qui se masque le temps qu'il
          // reste ouvert.
          await ui.click(ui.$('panel-more'))
          await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
          await new Promise((r) => setTimeout(r, 300))
          const underMenu = await shown()
          await ui.key('Escape')
          await ui.waitFor(`!${ui.$('panel-more-menu')}`)
          await new Promise((r) => setTimeout(r, 300))
          check(
            !underMenu && (await shown()),
            'menu « + » ouvert : page native masquée, puis réaffichée'
          )

          // Agrandi : la page suit la zone du navigateur, sur toute la largeur du panneau.
          const pageWidth = () =>
            main.evaluate(
              `require('electron').BrowserWindow.getAllWindows()[0].contentView.children.find((v) => v.getVisible())?.getBounds().width ?? 0`
            )
          const area = () => ui.ev(`${ui.$('browser-page')}.getBoundingClientRect().width`)
          await ui.click(ui.$('panel-maximize'))
          await ui.waitFor(`${ui.$('side-panel')}.classList.contains('maximized')`)
          let widths = [0, 100]
          for (let i = 0; i < 30 && Math.abs(widths[0] - widths[1]) > 2; i++) {
            await new Promise((r) => setTimeout(r, 100))
            widths = [await pageWidth(), await area()]
          }
          const panelWidth = await ui.ev(`${ui.$('side-panel')}.getBoundingClientRect().width`)
          check(
            Math.abs(widths[0] - widths[1]) <= 2 && widths[0] > panelWidth - 40,
            `agrandi : la page native suit le panneau (${widths.join(' / ')}, panneau ${panelWidth})`
          )
          // La zone de saisie est cachée : « Joindre cette page » se signale dans l'en-tête, et un
          // clic dessus revient à la conversation, où la page est jointe (fiche 094).
          await ui.click(ui.$('browser-attach'))
          await ui.waitFor(
            `${ui.$('panel-attached')}?.innerText.includes('${L('sidePanel.attached.page')}')`
          )
          await ui.shot('28f-page-jointe-agrandi')
          await ui.click(ui.$('panel-attached'))
          await ui.waitFor(`!${ui.$('side-panel')}.classList.contains('maximized')`)
          const pageAttached = `[...document.querySelectorAll('[data-testid=attachment]')].find((a) => a.title.startsWith('${L('browser.capture.untitled')}'))`
          await ui.waitFor(`!!${pageAttached}`)
          await ui.ev(`${pageAttached}.querySelector('.attachment-remove').click()`)
          await ui.waitFor(`!document.querySelector('[data-testid=attachment]')`)
        } finally {
          main.close()
        }

        // « Repartir de ce message » (fiche 094) : la branche reprend la page de l'originale.
        const origin = await ui.ev(`${ui.$('browser-address')}.value`)
        const users = `[...document.querySelectorAll('[data-testid=user-message]')]`
        await ui.ev(`${users}[0].scrollIntoView({ block: 'center' })`)
        await ui.click(`${users}[0].querySelector('[data-testid=message-edit]')`)
        await ui.waitFor(`!!${ui.$('message-edit-input')}`)
        await ui.ev(`${ui.$('message-edit-input')}.select()`)
        await ui.type('/scenario echo')
        await ui.enter()
        // Sans fichier modifié depuis ce message, pas de dialogue à confirmer.
        await ui.waitFor(`!!${ui.$('branch-dialog')} || !!${ui.$('branch-banner')}`)
        if (await ui.ev(`!!${ui.$('branch-dialog')}`)) await ui.click(ui.$('branch-confirm'))
        await ui.waitFor(`!!${ui.$('branch-banner')}`)
        await ui.ready()
        const branchAddress = () => ui.ev(`${ui.$('browser-address')}?.value ?? '(pas d’onglet)'`)
        await ui
          .waitFor(`${ui.$('browser-address')}?.value === ${JSON.stringify(origin)}`, 10_000)
          .catch(() => {})
        const branchShown = await branchAddress()
        // Panneau resté vide (macOS CI 2026-11-24, une fois, cause non établie : `inherit` avale
        // ses erreurs) : l'état réel des pages du main est dit avec l'échec, pour la prochaine fois.
        let pages = ''
        if (branchShown !== origin) {
          const probe = await mainProcess()
          try {
            pages = JSON.stringify(
              await probe.evaluate(
                `require('electron').webContents.getAllWebContents().filter((w) => w.getType() !== 'window').map((w) => ({ url: w.getURL(), loading: w.isLoading(), debugger: w.debugger.isAttached(), back: w.navigationHistory.canGoBack() }))`
              )
            )
          } finally {
            probe.close()
          }
        }
        check(
          branchShown === origin,
          `branche : le navigateur reprend la page de l’originale (${branchShown}${pages && ` ; pages du main : ${pages}`})`
        )
        await ui.shot('28g-branche-navigateur')
      },
      undefined,
      'navigateur',
      { MOCK_BROWSER_URL: url, MOCK_FOREIGN_URL: `${foreign}deux` },
      [`--inspect=${MAIN_PORT}`, `--host-resolver-rules=MAP ${FOREIGN_HOST} 127.0.0.1`]
    )
  } finally {
    server.close()
    rmSync(out, { recursive: true, force: true })
  }
}

/**
 * Accord par site de bout en bout (fiche 249, audit SEC-1) : un `location = …` de l'agent vers un
 * site non accordé est arrêté et l'agent prévenu ; une page partie ailleurs hors d'une action de
 * l'agent ne lui est lisible qu'après la carte d'accord (refus : rien de lu ; accord : lu).
 */
async function siteGuard(ui, foreign) {
  await ui.send('/scenario changement-de-site')
  await ui.ready()
  const reply = await ui.lastAgentText()
  check(
    // La page dite par le dernier outil (les cartes des outils, elles, citent le code).
    reply.includes('Navigation arrêtée par Bobine') &&
      /Page : http:\/\/127\.0\.0\.1:\d+\//.test(reply),
    `location = … vers un site non accordé pendant l’action de l’agent : arrêté, l’agent prévenu (${reply.slice(0, 160)})`
  )
  const main = await mainProcess()
  try {
    const onForeign = () =>
      main.evaluate(
        `require('electron').webContents.getAllWebContents().filter((w) => w.getURL().includes(${JSON.stringify(FOREIGN_HOST)})).length`
      )
    // Au-delà du délai où ce qui arrive vient encore de l'agent (1,5 s) : toujours pas parti.
    await new Promise((r) => setTimeout(r, 2000))
    check((await onForeign()) === 0, 'la page n’est jamais allée sur le site non accordé')
    // Hors d'une action de l'agent, la page part ailleurs (comme un lien suivi par l'utilisateur) :
    // rien ne l'en empêche.
    const shown = await ui.ev(`${ui.$('browser-address')}.value`)
    await main.evaluate(`(() => {
      for (const w of require('electron').webContents.getAllWebContents()) {
        if (w.getURL() === ${JSON.stringify(shown)}) void w.loadURL(${JSON.stringify(`${foreign}deux`)}).catch(() => {})
      }
      return true
    })()`)
    await ui.waitFor(`${ui.$('browser-address')}.value.includes(${JSON.stringify(FOREIGN_HOST)})`)
  } finally {
    main.close()
  }
  const site = foreign.replace(/^http:\/\/|\/$/g, '')
  await ui.send('/scenario page-affichee')
  await ui.waitFor(`!!${ui.$('questions')}`)
  check(
    (await ui.ev(`${ui.$('questions')}.innerText`)).includes(
      L('approvals.site.questionShown', { site })
    ),
    'page affichée sur un site non accordé : carte d’accord avant que l’agent la lise'
  )
  await ui.shot('28h-site-affiche-accord')
  await ui.press('3')
  await ui.ready()
  await ui.send('/scenario page-affichee')
  await ui.waitFor(`!!${ui.$('questions')}`)
  await ui.press('1')
  await ui.ready()
}

/**
 * Bandeau de téléchargement lisible (fiche 145) : le texte garde au moins 6em, rien ne dépasse du
 * bandeau, qui reste bas. Sous Linux et Windows, « Afficher dans le gestionnaire de fichiers » ne
 * tient pas à côté : c'est le bouton qui passe à la ligne, pas le texte qui se réduit à une lettre.
 */
const downloadLayout = (ui) =>
  ui.ev(`(() => {
    const b = ${ui.$('browser-download')}
    if (!b) return null
    const box = b.getBoundingClientRect()
    const text = b.querySelector('.browser-download-text')
    const em = parseFloat(getComputedStyle(text).fontSize)
    const inside = [...b.children].every((c) => {
      const r = c.getBoundingClientRect()
      return r.left >= box.left - 0.5 && r.right <= box.right + 0.5
    })
    return {
      text: text.getBoundingClientRect().width,
      min: 6 * em,
      height: box.height,
      inside,
      panel: ${ui.$('side-panel')}.getBoundingClientRect().width
    }
  })()`)
const layoutOk = (l) => !!l && l.text >= l.min - 0.5 && l.inside && l.height < 100
const showLayout = (l) =>
  l
    ? `panneau ${Math.round(l.panel)} px, texte ${Math.round(l.text)} px (≥ ${Math.round(l.min)}), bandeau ${Math.round(l.height)} px de haut`
    : 'pas de bandeau'

/**
 * Téléchargements (fiche 094, ADR-0018) : « Enregistrer sous » à chaque fois. La fenêtre native ne
 * se pilote pas par le CDP : remplacée dans le main, elle note ce qui l'ouvre et ce qu'il y a sur
 * le disque à ce moment-là, puis répond comme l'utilisateur (enregistrer ou annuler).
 */
async function downloads(ui, url, out) {
  const main = await mainProcess()
  try {
    await main.evaluate(`(() => {
      const { app, dialog, shell } = require('electron')
      const fs = require('fs')
      const path = require('path')
      const pending = path.join(app.getPath('userData'), 'downloads-pending')
      const files = () => (fs.existsSync(pending) ? fs.readdirSync(pending, { recursive: true }) : [])
      globalThis.__downloads = { answer: 'save', asked: [], revealed: [], pending: files }
      dialog.showSaveDialog = async (a, b) => {
        const options = b ?? a
        // Le temps que la page envoie le fichier au dossier d'attente.
        for (let i = 0; i < 40 && !files().some((f) => String(f).endsWith('.csv')); i++) {
          await new Promise((r) => setTimeout(r, 50))
        }
        globalThis.__downloads.asked.push({
          message: options.message,
          defaultPath: options.defaultPath,
          downloads: app.getPath('downloads'),
          pending: files().map(String),
          out: fs.readdirSync(${JSON.stringify(out)})
        })
        if (globalThis.__downloads.answer === 'cancel') return { canceled: true, filePath: '' }
        // Laissée ouverte (fiche 097) : répond seulement quand l'essai la libère.
        if (globalThis.__downloads.answer === 'never') {
          return new Promise((resolve) => {
            globalThis.__downloads.release = () => resolve({ canceled: true, filePath: '' })
          })
        }
        // Un autre nom que celui de la page : le bandeau doit montrer celui choisi.
        return { canceled: false, filePath: path.join(${JSON.stringify(out)}, 'mon-export.csv') }
      }
      shell.showItemInFolder = (p) => globalThis.__downloads.revealed.push(p)
      return true
    })()`)
    const saved = join(out, 'mon-export.csv')
    const site = new URL(url).host

    // Action de l'agent, l'utilisateur enregistre.
    await ui.send('/scenario telechargement')
    await ui.ready()
    check(
      existsSync(saved) && readFileSync(saved, 'utf8') === 'titre;auteur\nDune;Herbert\n',
      'fichier enregistré à l’endroit choisi, contenu de la page (blob déjà révoqué)'
    )
    check(
      (await main.evaluate(`globalThis.__downloads.pending().length`)) === 0,
      'dossier d’attente vidé'
    )
    await ui.waitFor(
      `${ui.$('browser-download')}?.innerText.includes(${JSON.stringify(L('browser.download.saved', { name: 'mon-export.csv' }))})`
    )
    await ui.shot('28e-telechargement')
    const wide = await downloadLayout(ui)
    check(layoutOk(wide), `bandeau de téléchargement lisible (${showLayout(wide)})`)
    await ui.click(ui.$('browser-download-show'))
    await ui.click(
      `${ui.$('browser-download')}.querySelector('[aria-label="${L('common.close')}"]')`
    )
    await ui.waitFor(`!${ui.$('browser-download')}`)

    // Action de l'agent, l'utilisateur annule : rien sur le disque, rien d'affiché.
    rmSync(saved)
    await main.evaluate(`globalThis.__downloads.answer = 'cancel'`)
    await ui.send('/scenario telechargement')
    await ui.ready()

    // Fenêtre laissée ouverte (fiche 097, essai réel) : l'outil de l'agent revient quand même, son
    // outil suivant aussi ; la conversation attend l'utilisateur dans la liste.
    await main.evaluate(`globalThis.__downloads.answer = 'never'`)
    await ui.send('/scenario telechargement')
    await ui.ready()
    const waitingDot = `document.querySelector('.history-item.active .child-state[data-state=waiting]')`
    check(
      (await ui.lastAgentText()).includes('Pas encore de décision') &&
        (await ui.ev(`!!${waitingDot}`)),
      '« Enregistrer sous » laissé ouvert : l’agent n’attend pas la fenêtre, la conversation attend votre réponse'
    )
    await main.evaluate(`(globalThis.__downloads.release(), true)`)
    await ui.waitFor(`!${waitingDot}`)

    // Clic de l'utilisateur dans la page (après la fenêtre où ce qui arrive vient de l'agent),
    // panneau à sa largeur la plus étroite : le bandeau y reste lisible (fiche 145).
    const handle = await ui.ev(
      `(() => { const b = document.querySelector('.side-panel-resize').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + 200 } })()`
    )
    await ui.drag(handle, { x: handle.x + 400, y: handle.y })
    await ui.waitFor(`${ui.$('side-panel')}.getBoundingClientRect().width < 290`)
    await main.evaluate(`globalThis.__downloads.answer = 'save'`)
    await new Promise((r) => setTimeout(r, 2000))
    await main.evaluate(`(() => {
      const page = require('electron').webContents.getAllWebContents().find((w) => w.getURL().endsWith('/export'))
      for (const type of ['mouseDown', 'mouseUp']) page.sendInputEvent({ type, x: 60, y: 60, button: 'left', clickCount: 1 })
      return true
    })()`)
    await ui.waitFor(`!!${ui.$('browser-download')}`)
    const last = (await main.evaluate(`globalThis.__downloads.asked`)).at(-1)
    check(
      last?.message === L('browser.download.byPage', { site }) && existsSync(saved),
      '« Exporter » cliqué par l’utilisateur : même fenêtre, sans mention de l’agent'
    )
    const narrow = await downloadLayout(ui)
    await ui.shot('28e2-telechargement-etroit')
    check(
      layoutOk(narrow),
      `panneau le plus étroit : bandeau de téléchargement lisible (${showLayout(narrow)})`
    )
    // Largeur par défaut (double-clic sur la poignée) pour la suite.
    await ui.ev(
      `document.querySelector('.side-panel-resize').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`
    )
    await ui.waitFor(`${ui.$('side-panel')}.getBoundingClientRect().width > 300`)
  } finally {
    main.close()
  }
}

/**
 * Boîte JavaScript de la page (fiche 097, essai réel) : `confirm()` bloque la page jusqu'à la
 * réponse de l'utilisateur. L'outil de l'agent revient quand même, l'outil suivant aussi, et la
 * conversation attend dans la liste ; puis l'agent apprend la réponse. La boîte native d'Electron
 * ne se pilote pas par le CDP : la réponse passe par le protocole, depuis le main (Electron laisse
 * alors sa boîte affichée, d'où cette partie en dernier).
 */
async function pageDialog(ui) {
  const main = await mainProcess()
  const waitingDot = `document.querySelector('.history-item.active .child-state[data-state=waiting]')`
  try {
    await ui.send('/scenario boite-page')
    // Le texte arrive en morceaux : sa fin dit ce qu'a fait l'outil suivant.
    await ui.waitFor(
      `/outil suivant : .+\\.|Pas de boîte signalée/.test(document.body.innerText)`,
      30000
    )
    check(
      (await ui.ev(`document.body.innerText.includes('refusé tout de suite.')`)) &&
        (await ui.ev(`!!${waitingDot}`)),
      'boîte de la page : l’outil de l’agent revient, le suivant aussi ; la conversation attend votre réponse'
    )
    await main.evaluate(`(async () => {
      const page = require('electron').webContents.getAllWebContents().find((w) => w.getURL().endsWith('/confirm'))
      await page.debugger.sendCommand('Page.handleJavaScriptDialog', { accept: true })
      return true
    })()`)
    await ui.ready()
    const reply = await ui.lastAgentText()
    check(
      reply.includes('Réponse de l’utilisateur reçue') &&
        reply.includes('confirm dialog') &&
        reply.includes(': OK.') &&
        !(await ui.ev(`!!${waitingDot}`)),
      'la réponse de l’utilisateur arrive à l’agent ; la conversation n’attend plus'
    )
  } finally {
    main.close()
  }
}
