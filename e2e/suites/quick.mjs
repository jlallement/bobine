import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { L, Lpart, MAIN_PORT, attachPage, check, mainProcess, sleep, withApp, M } from '../lib.mjs'

const FIXTURE = fileURLToPath(new URL('../fixtures/capture.png', import.meta.url))

/**
 * Fenêtre rapide et capture d'écran (fiche 062) : ouverte par le menu (le raccourci global ne se
 * presse pas depuis un essai, on vérifie qu'il est enregistré), capture simulée, envoi dans une
 * nouvelle conversation ; capture depuis la zone de saisie ; réglage du raccourci ; agent qui
 * attend une action : le message reste dans la zone de saisie. Capture impossible (fiche 124) :
 * refus de macOS après la sélection, autorisation refusée (rien n'est lancé), dits avec le réglage
 * à ouvrir, dans la fenêtre rapide et sous la zone de saisie.
 */
export async function quickSuite(scheme) {
  console.log(`\n— Fenêtre rapide (${scheme})`)
  const bin = mkdtempSync(join(tmpdir(), 'bob-e2e-capture-'))
  const cancel = join(bin, 'annuler')
  const refuse = join(bin, 'refuser')
  const calls = join(bin, 'appels')
  const screencapture = join(bin, 'screencapture')
  // Appelée comme `screencapture -i -x -t png <fichier>`, comme le vrai (essayé sur macOS 27) :
  // « annuler » présent : Échap (code 0, pas de fichier) ; « refuser » : zone choisie sans
  // l'autorisation (code 1, message, pas de fichier). Chaque appel laisse une ligne dans « appels ».
  writeFileSync(
    screencapture,
    [
      '#!/bin/sh',
      'for last; do :; done',
      `echo appel >> "${calls}"`,
      `[ -e "${cancel}" ] && exit 0`,
      `[ -e "${refuse}" ] && { echo 'could not create image from rect' >&2; exit 1; }`,
      `cp "${FIXTURE}" "$last"`,
      ''
    ].join('\n')
  )
  const callCount = () =>
    existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').length - 1 : 0
  /** Autorisation « Enregistrement de l'écran » vue par l'app (lue à chaque capture). */
  const setAccess = (main, access) =>
    main.evaluate(
      access
        ? `(process.env.BOBINE_SCREEN_ACCESS = ${JSON.stringify(access)}, true)`
        : `(delete process.env.BOBINE_SCREEN_ACCESS, true)`
    )
  chmodSync(screencapture, 0o755)
  const env = { BOBINE_SCREENCAPTURE: screencapture }
  const args = [`--inspect=${MAIN_PORT}`]
  const menuItem = (main, id) =>
    main.evaluate(
      `(require('electron').Menu.getApplicationMenu().getMenuItemById('${id}').click(), true)`
    )
  const quickVisible = (main) =>
    main.evaluate(
      `require('electron').BrowserWindow.getAllWindows().some((w) => w.isVisible() && w.webContents.getURL().includes('#quick'))`
    )
  /**
   * Attend que la fenêtre rapide soit (ou ne soit plus) visible, au lieu d'un délai fixe : sous
   * charge (suites en parallèle, fiche 115), masquer la fenêtre, lancer la capture et la remontrer
   * prend parfois plus que les 600 ms d'autrefois. Rend `false` si l'état n'est pas atteint.
   */
  const waitQuick = async (main, visible, ms) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      if ((await quickVisible(main)) === visible) return true
      await sleep(50)
    }
    return false
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          check(
            await main.evaluate(`require('electron').globalShortcut.isRegistered('Alt+Command+B')`),
            'raccourci global ⌥⌘B enregistré'
          )
          await menuItem(main, 'quick-entry')
          const quick = await attachPage('#quick', scheme)
          try {
            await quick.waitFor(
              `${quick.$('quick-target')}?.innerText.startsWith(${JSON.stringify(Lpart('quick.target', { agent: M('Agent factice') }))})`
            )
            // Montrée une fois sa page prête : sous charge, un peu après le texte.
            check(
              await waitQuick(main, true, 5000),
              'Fichier › Fenêtre rapide : ouverte, rappelle où part le message'
            )

            // Échap pendant la sélection : rien n'est joint.
            writeFileSync(cancel, '')
            await quick.click(quick.$('quick-capture'))
            // La fenêtre se masque pendant la capture, puis revient quand elle est annulée. Une
            // capture trop rapide pour être vue masquée compte aussi : on attend seulement le retour.
            await waitQuick(main, false, 2000)
            check(
              (await waitQuick(main, true, 15000)) &&
                !(await quick.ev(`!!${quick.$('quick-images')}`)),
              'capture annulée : rien de joint, la fenêtre revient'
            )
            rmSync(cancel)
            check(
              !(await quick.ev(`!!${quick.$('capture-problem')}`)),
              'capture annulée : aucun message (Échap n’est pas un échec)'
            )

            // Zone choisie, mais macOS refuse l'image (autorisation jamais accordée) : dit.
            writeFileSync(refuse, '')
            await quick.click(quick.$('quick-capture'))
            await quick.waitFor(`${quick.$('capture-problem')}?.dataset.reason === 'failed'`)
            await waitQuick(main, true, 15000)
            check(
              !(await quick.ev(`!!${quick.$('quick-images')}`)) &&
                (await quick.ev(`${quick.$('capture-problem')}.innerText`)).includes(
                  L('composer.capture.unavailable.failed')
                ),
              'capture refusée par macOS après la sélection : rien de joint, le dit, réglage à ouvrir'
            )
            await quick.shot('l0a-capture-sans-image')
            rmSync(refuse)

            // Autorisation refusée : rien n'est lancé, la fenêtre reste, le message dit pourquoi.
            await setAccess(main, 'denied')
            const before = callCount()
            await quick.click(quick.$('quick-capture'))
            await quick.waitFor(`${quick.$('capture-problem')}?.dataset.reason === 'denied'`)
            check(
              callCount() === before &&
                (await quickVisible(main)) &&
                (await quick.ev(`${quick.$('capture-problem')}.innerText`)).includes(
                  L('composer.capture.unavailable.denied')
                ),
              'autorisation refusée : pas de screencapture, fenêtre gardée, message et raison'
            )
            await quick.shot('l0b-capture-autorisation-refusee')
            // « Ouvrir les Réglages Système » : l'adresse du Diagnostic (ouverture simulée).
            await main.evaluate(`(() => {
              const { shell } = require('electron')
              globalThis.__opened = []
              globalThis.__openExternal ??= shell.openExternal
              shell.openExternal = async (url) => { globalThis.__opened.push(url) }
              return true
            })()`)
            await quick.click(quick.$('capture-settings'))
            await sleep(200)
            const opened = await main.evaluate(`globalThis.__opened`)
            await main.evaluate(
              `(require('electron').shell.openExternal = globalThis.__openExternal, true)`
            )
            check(
              opened.length === 1 && opened[0].includes('Privacy_ScreenCapture'),
              `bouton : ouvre Réglages Système › Enregistrement de l’écran (${opened[0] ?? 'rien'})`
            )
            await setAccess(main, null)

            await quick.click(quick.$('quick-capture'))
            await quick.waitFor(`document.querySelectorAll('.quick-images img').length === 1`)
            check(
              !(await quick.ev(`!!${quick.$('capture-problem')}`)),
              'autorisation rendue : capture jointe, le message s’en va'
            )
            check(true, 'capture jointe comme image')
            await quick.ev(`${quick.$('quick-input')}.focus()`)
            await quick.type('Que montre cette capture ?')
            await quick.shot('l0-fenetre-rapide')
            await quick.press('Enter')
          } finally {
            quick.close()
          }
          await ui.waitFor(
            `[...document.querySelectorAll('[data-testid=user-message]')].some((m) => m.innerText.includes('Que montre cette capture') && m.querySelector('.msg-attachments img'))`
          )
          await ui.ready()
          const reply = await ui.lastAgentText()
          check(
            !(await quickVisible(main)) &&
              (await ui.ev(`document.querySelectorAll('.history-item').length`)) === 1 &&
              (reply.match(/Voici un exemple/g) ?? []).length === 1,
            'Entrée : nouvelle conversation dans la fenêtre principale, image comprise, réponse (sans doublon)'
          )
          await ui.shot('l1-message-de-la-fenetre-rapide')

          // Capture depuis la zone de saisie.
          await ui.click(ui.$('capture'))
          await ui.waitFor(`document.querySelectorAll('[data-testid=attachment] img').length === 1`)
          check(true, 'zone de saisie : capture jointe')
          await ui.shot('l2-capture-zone-de-saisie')

          // Autorisation refusée : dit sous la zone de saisie, avec le réglage à ouvrir.
          await setAccess(main, 'denied')
          await ui.click(ui.$('capture'))
          await ui.waitFor(`${ui.$('capture-problem')}?.dataset.reason === 'denied'`)
          check(
            (await ui.ev(`document.querySelectorAll('[data-testid=attachment] img').length`)) ===
              1 && (await ui.ev(`!!${ui.$('capture-settings')}`)),
            'zone de saisie, autorisation refusée : message sous la zone de saisie, rien de plus joint'
          )
          await ui.shot('l2b-capture-refusee-zone-de-saisie')
          await setAccess(main, null)
          await ui.click(ui.$('capture-problem-close'))
          await ui.waitFor(`!${ui.$('capture-problem')}`)

          // Réglage : raccourci désactivé, puis remis.
          const setShortcut = async (value) => {
            await ui.ev(`(() => {
              const select = document.querySelector('[data-testid=settings-quick-shortcut]')
              const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
              set.call(select, ${JSON.stringify(value)})
              select.dispatchEvent(new Event('change', { bubbles: true }))
            })()`)
          }
          await ui.click(ui.$('open-settings'))
          await ui.waitFor(`!!${ui.$('settings-quick-shortcut')}`)
          await setShortcut('off')
          await ui.waitFor(`${ui.$('settings-quick-shortcut')}.value === 'off'`)
          await sleep(300)
          const off = await main.evaluate(
            `require('electron').globalShortcut.isRegistered('Alt+Command+B')`
          )
          await setShortcut('alt-cmd-b')
          await sleep(300)
          check(
            !off &&
              (await main.evaluate(
                `require('electron').globalShortcut.isRegistered('Alt+Command+B')`
              )),
            'réglage : raccourci désactivé, puis remis'
          )
          await ui.key('Escape')

          // Échap dans la fenêtre rapide : refermée.
          await menuItem(main, 'quick-entry')
          const again = await attachPage('#quick', scheme)
          try {
            await again.waitFor(`document.hasFocus() || true`)
            await again.press('Escape')
            check(await waitQuick(main, false, 5000), 'Échap : fenêtre rapide refermée')
          } finally {
            again.close()
          }
        } finally {
          main.close()
        }
      },
      undefined,
      'streaming-texte',
      env,
      args
    )

    // Agent qui attend une action : le message attend dans la zone de saisie.
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-auth')}`, 15_000)
        const main = await mainProcess()
        try {
          await menuItem(main, 'quick-entry')
          const quick = await attachPage('#quick', scheme)
          try {
            await quick.waitFor(`!!${quick.$('quick-input')}`)
            await quick.ev(`${quick.$('quick-input')}.focus()`)
            await quick.type('Message gardé pour plus tard')
            await quick.click(quick.$('quick-capture'))
            await quick.waitFor(`document.querySelectorAll('.quick-images img').length === 1`)
            await quick.press('Enter')
          } finally {
            quick.close()
          }
        } finally {
          main.close()
        }
        await ui.waitFor(
          `${ui.$('composer-input')}.value === 'Message gardé pour plus tard' && document.querySelectorAll('[data-testid=attachment] img').length === 1`
        )
        check(
          await ui.ev(`!!${ui.$('blocker-auth')}`),
          'agent qui attend une connexion : message et image dans la zone de saisie, sous son panneau'
        )
        await ui.shot('l3-message-en-attente')
      },
      undefined,
      'bob-auth-requise',
      env,
      args
    )
  } finally {
    rmSync(bin, { recursive: true, force: true })
  }
}
