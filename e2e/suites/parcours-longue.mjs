import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import { day, newConversation, open, project, quitApp, row, userCount } from '../parcours.mjs'

const FIRST = 'Question 1 : par où commencer ?'
/** Messages de la longue conversation (questions et réponses riches mêlées). */
const QUESTIONS = 36
const RICH = { 8: 'streaming-texte', 16: 'tableaux', 24: 'code-colore', 30: 'plan' }
const THREAD = `document.querySelector('.main > .scroll')`
/** Le message `index` (0 = premier) de l'utilisateur est-il dans la partie visible du fil ? */
const shown = (index) =>
  `(() => {
    const m = document.querySelectorAll('[data-testid=user-message]')[${index}]
    if (!m) return false
    const s = ${THREAD}.getBoundingClientRect(), r = m.getBoundingClientRect()
    return r.bottom > s.top && r.top < s.bottom
  })()`
/** Le bas du fil est à l'écran (à quelques pixels près). */
const atBottom = `(() => { const s = ${THREAD}; return s.scrollHeight - s.scrollTop - s.clientHeight < 80 })()`
/** Rien ne déborde en largeur : ni la page, ni le fil. */
const noOverflow = `(() => document.documentElement.scrollWidth <= innerWidth + 1 && ${THREAD}.scrollWidth <= ${THREAD}.clientWidth + 1)()`

/** Attend que le fil ne bouge plus (défilement doux). */
const settle = (ui) =>
  ui.ev(`new Promise((resolve) => {
    const s = ${THREAD}
    let last = -1, still = 0
    const tick = () => {
      if (s.scrollTop === last) still++
      else { still = 0; last = s.scrollTop }
      if (still >= 6) resolve(true)
      else requestAnimationFrame(tick)
    }
    tick()
  })`)

/**
 * « Longue session » (fiche 277) : une conversation de plusieurs dizaines d'échanges (réponses en
 * Markdown, tableaux, code, plan), le sommaire, un ancien message retrouvé, un message envoyé
 * depuis le haut du fil, une fenêtre étroite puis large, le panneau ouvert et refermé, une autre
 * conversation et retour ; puis l'app relancée rouvre le long fil, en bas.
 */
export async function parcoursLongueSuite(scheme) {
  console.log(`\n— Parcours : longue session (${scheme})`)
  const workspace = project('bob-e2e-longue-')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-longue-data-'))
  const journee = day('longue')
  let total = 0
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        await journee.step(`${QUESTIONS} échanges dans la même conversation`, async () => {
          await ui.ready()
          for (let i = 1; i <= QUESTIONS; i++) {
            const text =
              i === 1
                ? FIRST
                : RICH[i]
                  ? `/scenario ${RICH[i]} Question ${i}`
                  : `Question ${i} : et l’étape ${i} ?`
            await ui.send(text)
            await ui.ready()
          }
          total = await userCount(ui)
          check(
            total === QUESTIONS && (await ui.ev(atBottom)),
            `${QUESTIONS} messages, le fil suit le dernier`
          )
        })

        await journee.step('le sommaire, et retour à un ancien message', async () => {
          await ui.closePanel()
          await ui.waitFor(`!!document.querySelector('[data-testid=outline-bars]')`)
          check(
            (await ui.ev(`document.querySelectorAll('[data-testid=outline-item]').length`)) ===
              total,
            'le sommaire a tous les messages'
          )
          await ui.ev(
            `document.querySelector('.outline').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`
          )
          await ui.hover(await ui.center(`document.querySelector('[data-testid=outline-bars]')`))
          await ui.waitFor(
            `getComputedStyle(document.querySelector('[data-testid=outline-list]')).display === 'block'`
          )
          await ui.click(`document.querySelectorAll('[data-testid=outline-item]')[2]`)
          await ui.hover({ x: 900, y: 500 })
          await settle(ui)
          check(
            (await ui.ev(shown(2))) && !(await ui.ev(atBottom)),
            'le troisième message est à l’écran, le fil n’est plus en bas'
          )
          await ui.waitFor(`!!${ui.$('scroll-to-bottom')}`)
          await ui.shot('276-longue-ancien-message')
        })

        await journee.step('envoyer depuis le haut du fil : retour en bas', async () => {
          await ui.send('Et maintenant, la suite ?')
          await ui.ready()
          await settle(ui)
          total++
          check(
            (await ui.ev(shown(total - 1))) && (await ui.ev(atBottom)),
            'le message envoyé et sa réponse sont à l’écran'
          )
        })

        await journee.step('fenêtre étroite, puis large', async () => {
          await ui.viewport(640, 760)
          await settle(ui)
          const narrow = {
            overflow: await ui.ev(noOverflow),
            input: await ui.ev(`${ui.$('composer-input')}.getBoundingClientRect().width > 200`),
            last: await ui.ev(shown(total - 1))
          }
          await ui.shot('276-longue-etroite')
          await ui.viewport(1600, 900)
          await settle(ui)
          check(
            narrow.overflow &&
              narrow.input &&
              narrow.last &&
              (await ui.ev(noOverflow)) &&
              (await ui.ev(shown(total - 1))),
            `étroite puis large : rien ne déborde, la saisie et le dernier message restent visibles (${JSON.stringify(narrow)})`
          )
          await ui.viewport()
        })

        await journee.step('le panneau ouvert puis refermé', async () => {
          await ui.click(ui.$('panel-toggle'))
          await ui.waitFor(`!!${ui.$('side-panel')}`)
          await settle(ui)
          const open = {
            last: await ui.ev(shown(total - 1)),
            overflow: await ui.ev(noOverflow)
          }
          await ui.closePanel()
          await settle(ui)
          check(
            open.last && open.overflow && (await ui.ev(shown(total - 1))),
            `panneau ouvert puis fermé : le fil garde son dernier message à l’écran (${JSON.stringify(open)})`
          )
        })

        await journee.step('une autre conversation, puis retour au long fil', async () => {
          await newConversation(ui)
          await ui.send('/scenario echo Petite question à part')
          await ui.ready()
          await open(ui, FIRST)
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=user-message]').length === ${total}`
          )
          await settle(ui)
          check(
            await ui.ev(shown(total - 1)),
            'retour : le long fil entier, son dernier message à l’écran'
          )
        })

        await journee.step(
          'quitter l’app',
          async () => {
            await quitApp(main, MAIN_PORT)
            check(true, 'app quittée')
          },
          { closing: true }
        )
      },
      userData,
      'echo',
      { BOBINE_WORKSPACE: workspace },
      [`--inspect=${MAIN_PORT}`]
    )

    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        await journee.step('relancer : le long fil rouvert, en bas', async () => {
          await ui.waitFor(`${row(FIRST)}?.classList.contains('active')`, 20000)
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=user-message]').length === ${total}`,
            20000
          )
          await ui.ready()
          await settle(ui)
          check(
            (await ui.ev(shown(total - 1))) && (await ui.ev(atBottom)),
            'relance : tous les messages, le dernier à l’écran'
          )
          await ui.send('On reprend la longue session')
          await ui.ready()
          check(
            (await userCount(ui)) === total + 1 && (await ui.ev(atBottom)),
            'relance : le long fil continue'
          )
          await ui.shot('276-longue-relance')
        })
      },
      userData,
      'echo',
      { BOBINE_AGENT_PROFILE: '', BOBINE_MOCK_AGENT: '1' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
