import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, M, MAIN_PORT, attachPage, check, mainProcess, sleep, withApp } from '../lib.mjs'
import {
  ROWS,
  activeId,
  day,
  newConversation,
  open,
  project,
  row,
  userCount
} from '../parcours.mjs'

const FIRST = '/scenario echo Le mot zanzibar marque cette conversation'
const PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Carnet</title>
<style>body{font:16px system-ui;margin:0;background:#fff;color:#223}h1{margin:16px 24px}
#cible{position:absolute;left:40px;top:120px;width:160px;height:48px;font:inherit}</style></head>
<body><h1>Carnet</h1><button id="cible" onclick="window.clics = (window.clics || 0) + 1">Cible</button></body></html>`
/** Vue native visible (la page de l'onglet actif du navigateur intégré), évaluée dans le main. */
const VIEW = `require('electron').BrowserWindow.getAllWindows().flatMap((w) => w.contentView.children).find((v) => v.getVisible())`
/** Lignes affichées du terminal de l'onglet visible. */
const TERMINAL_ROWS = `([...document.querySelectorAll('.terminal-host .xterm-rows')].find((e) => !e.closest('[hidden]'))?.innerText ?? '')`

/**
 * « Outils de l'app » (fiche 276) : dans une même session, le terminal à côté de la conversation
 * (à la main, puis par l'agent), le navigateur intégré (page annotée et envoyée), la fenêtre
 * rapide, la recherche dans l'historique, l'export d'une conversation ; les panneaux suivent la
 * conversation affichée.
 */
export async function parcoursOutilsSuite(scheme) {
  console.log(`\n— Parcours : outils de l’app (${scheme})`)
  const workspace = project('bob-e2e-outils-')
  const out = mkdtempSync(join(tmpdir(), 'bob-e2e-outils-export-'))
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PAGE)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}/`
  const journee = day('outils')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        const inPage = (code) =>
          main.evaluate(`${VIEW}?.webContents.executeJavaScript(${JSON.stringify(code)})`)
        const viewShown = () => main.evaluate(`!!${VIEW}`)
        const until = async (test, ms = 5000) => {
          const start = Date.now()
          while (Date.now() - start < ms) {
            if (await test()) return true
            await sleep(100)
          }
          return false
        }
        try {
          await journee.step('une conversation, puis le terminal à côté', async () => {
            await ui.ready()
            await ui.send(FIRST)
            await ui.ready()
            await ui.press('`', 2)
            await ui.waitFor(`!!${ui.$('terminal-tab')}`)
            await ui.waitFor(
              `document.activeElement?.classList.contains('xterm-helper-textarea') && ${TERMINAL_ROWS}.trim() !== ''`
            )
            await ui.type('echo parcours-$((2+3))')
            await ui.enter()
            await ui.waitFor(`${TERMINAL_ROWS}.includes('parcours-5')`)
            check(true, '⌃` : terminal ouvert dans le dossier, commande lancée à la main')
          })

          await journee.step('l’agent se sert du même terminal', async () => {
            await ui.send('/scenario terminal')
            // La commande est montrée avant de partir : « Lancer » (1).
            await ui.waitFor(`!!${ui.$('questions')}`)
            await ui.press('1')
            await ui.ready()
            await ui.waitFor(`${TERMINAL_ROWS}.includes('bonjour du terminal 42')`)
            check(
              (await ui.lastAgentText()).includes('bonjour du terminal 42'),
              'commande montrée puis lancée dans un onglet de l’agent, qui lit sa sortie'
            )
            await ui.shot('276-outils-terminal')
          })

          await journee.step('le navigateur intégré : annoter la page et l’envoyer', async () => {
            await ui.send('/scenario navigateur-vue')
            await ui.ready()
            await ui.waitFor(`${ui.$('browser-address')}?.value.endsWith('/vue')`)
            check(await until(viewShown), 'la page est affichée dans le navigateur intégré')
            await ui.click(ui.$('browser-annotate'))
            await ui.waitFor(`!!${ui.$('page-annotate-hint')}`)
            await until(async () => !!(await inPage(`!!document.querySelector('bobine-notes')`)))
            await main.evaluate(`(async () => {
              const view = ${VIEW}
              for (const e of [
                { type: 'mouseMove', x: 120, y: 144 },
                { type: 'mouseDown', x: 120, y: 144, button: 'left', clickCount: 1 },
                { type: 'mouseUp', x: 120, y: 144, button: 'left', clickCount: 1 }
              ]) {
                view.webContents.sendInputEvent(e)
                await new Promise((r) => setTimeout(r, 30))
              }
            })()`)
            await ui.waitFor(`!!${ui.$('page-note-input')}`)
            await ui.type('Le bouton est trop petit.')
            await ui.press('Enter', 4)
            await ui.waitFor(`!${ui.$('page-note-input')}`)
            await ui.waitFor(
              `${ui.$('page-notes-bar')}?.innerText.includes(${JSON.stringify(L('diffNotes.count', { count: 1 }))})`
            )
            const before = await userCount(ui)
            await ui.click(ui.$('page-notes-send'))
            await ui.waitFor(`!${ui.$('page-notes-bar')}`)
            await ui.waitFor(`document.querySelectorAll('.msg-user').length > ${before}`)
            await ui.ready()
            const reply = (await ui.lastAgentText()).replace(/\s+/g, ' ')
            check(
              reply.includes('Remarque : Le bouton est trop petit.') &&
                (await inPage('window.clics || 0')) === 0,
              'remarque envoyée avec sa capture ; le clic n’a pas atteint la page'
            )
            await ui.shot('276-outils-navigateur')
          })

          await journee.step(
            'une deuxième conversation, puis retour : les panneaux suivent',
            async () => {
              const first = await activeId(ui)
              await newConversation(ui)
              await ui.send('/scenario echo Une autre question')
              await ui.ready()
              await open(ui, FIRST)
              check(
                (await activeId(ui)) === first &&
                  (await ui.ev(`!!document.querySelector('.side-panel-tab[data-tab=terminal]')`)) &&
                  (await ui.ev(
                    `!!document.querySelector('.side-panel-tab.active[data-tab=browser]')`
                  )) &&
                  (await ui.ev(`${ui.$('browser-address')}?.value.endsWith('/vue')`)),
                'retour à la première : son terminal et son navigateur sont toujours là'
              )
            }
          )

          await journee.step(
            'la fenêtre rapide envoie dans une nouvelle conversation',
            async () => {
              const rows = await ui.ev(`${ROWS}.length`)
              await main.evaluate(
                `(require('electron').Menu.getApplicationMenu().getMenuItemById('quick-entry').click(), true)`
              )
              const quick = await attachPage('#quick', scheme)
              try {
                await quick.waitFor(`!!${quick.$('quick-input')}`)
                await quick.ev(`${quick.$('quick-input')}.focus()`)
                await quick.type('/scenario echo Question rapide')
                await quick.press('Enter')
              } finally {
                quick.close()
              }
              await ui.waitFor(`!!${row('/scenario echo Question rapide')}`)
              await ui.waitFor(
                `${row('/scenario echo Question rapide')}.classList.contains('active')`
              )
              await ui.ready()
              check(
                (await ui.ev(`${ROWS}.length`)) === rows + 1 &&
                  (await ui.lastAgentText()).includes('Question rapide'),
                'fenêtre rapide : nouvelle conversation affichée dans la fenêtre principale, réponse'
              )
            }
          )

          await journee.step('retrouver la première par la recherche', async () => {
            await ui.click(ui.$('open-search'))
            await ui.waitFor(`document.activeElement === ${ui.$('search-input')}`)
            await ui.type('zanzibar')
            await ui.waitFor(`!!${ui.$('search-snippet')}`)
            const results = await ui.ev(
              `[...document.querySelectorAll('[data-testid=search-result]')].map((r) => r.innerText)`
            )
            await ui.enter()
            await ui.waitFor(`${row(FIRST)}?.classList.contains('active')`)
            check(
              results.length === 1 && results[0].startsWith('/scenario echo Le mot zanzibar'),
              `recherche : une seule conversation trouvée, ouverte (${results.length})`
            )
            await ui.key('Escape')
          })

          await journee.step('exporter la conversation en Markdown', async () => {
            await main.evaluate(`(() => {
              const { dialog, shell } = require('electron')
              const path = require('path')
              dialog.showSaveDialog = async (a, b) => {
                const options = b ?? a
                return { canceled: false, filePath: path.join(${JSON.stringify(out)}, path.basename(options.defaultPath)) }
              }
              shell.showItemInFolder = () => {}
              return true
            })()`)
            await ui.click(`${row(FIRST)}.querySelector('[data-testid=history-more]')`)
            await ui.waitFor(`!!${ui.$('history-export-markdown')}`)
            await ui.click(ui.$('history-export-markdown'))
            await ui.waitFor(
              `document.body.innerText.includes(${JSON.stringify(Lpart('conversations.exported'))})`
            )
            const md = readdirSync(out).find((f) => f.endsWith('.md'))
            const text = md ? readFileSync(join(out, md), 'utf8') : ''
            check(
              text.includes('zanzibar') &&
                text.includes('/scenario navigateur-vue') &&
                text.includes(M('Je lance la commande dans le terminal.').trim()),
              `export : tout le fil de la journée (${md ?? 'aucun fichier'})`
            )
          })
        } finally {
          main.close()
        }
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace, MOCK_BROWSER_URL: url },
      [`--inspect=${MAIN_PORT}`]
    )
  } finally {
    server.close()
    rmSync(workspace, { recursive: true, force: true })
    rmSync(out, { recursive: true, force: true })
  }
}
