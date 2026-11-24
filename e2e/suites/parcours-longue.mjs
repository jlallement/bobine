import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { affirm, probes } from '../affirm.mjs'
import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import {
  day,
  eventually,
  newConversation,
  open,
  project,
  quitApp,
  row,
  userCount
} from '../parcours.mjs'

const FIRST = 'Question 1 : par où commencer ?'
/** Messages de la longue conversation (questions et réponses riches mêlées). */
const QUESTIONS = 36
const RICH = { 8: 'streaming-texte', 12: 'mermaid', 16: 'tableaux', 24: 'code-colore', 30: 'plan' }
/** Morceaux de Mermaid importés : Vite les annonce par des liens `modulepreload` (fiche 063). */
const MERMAID_LOADED = `[...document.querySelectorAll('link[rel=modulepreload]')].some((l) => /Diagram/.test(l.href))`
const MERMAID_BLOCKS = `[...document.querySelectorAll('[data-testid=mermaid-block]')]`
/** Le haut du message `index` de l'utilisateur est sous le bas du fondu de la barre de titre. */
const clearOfFade = (index) =>
  probes.custom(
    `le message ${index + 1} commence sous le fondu de la barre de titre`,
    `const header = document.querySelector('.main-header')
    const fade = Math.round(header.getBoundingClientRect().bottom + parseFloat(getComputedStyle(header, '::after').height))
    const top = Math.round(document.querySelectorAll('[data-testid=user-message]')[${index}].getBoundingClientRect().top)
    return { ok: top >= fade, detail: 'haut ' + top + ' px, fondu jusqu’à ' + fade + ' px' }`
  )
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
          // Inventaire `mermaid` n° 1 : rien de Mermaid chargé avant le premier diagramme.
          const loadedEarly = await ui.ev(MERMAID_LOADED)
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
          // Inventaire `mermaid` n° 1-2 : chargé à l'arrivée du diagramme, organigramme et
          // séquence dessinés, le bloc invalide reste en code.
          const drawn = await eventually(
            ui,
            `${MERMAID_BLOCKS}.length === 3 && ${MERMAID_BLOCKS}.every((b) => b.dataset.state !== 'pending')`,
            15000
          )
          const states = await ui.ev(`${MERMAID_BLOCKS}.map((b) => b.dataset.state).join(' ')`)
          check(
            !loadedEarly &&
              drawn &&
              states === 'drawn drawn error' &&
              (await ui.ev(MERMAID_LOADED)),
            `Mermaid chargé seulement au premier diagramme, diagrammes dessinés (${states}, chargé avant : ${loadedEarly})`
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
          // Inventaire `sommaire` n° 4 : en bas du fil, le dernier trait est le courant.
          const lastIsCurrent = `(() => {
            const all = [...document.querySelectorAll('[data-testid=outline-bars] .outline-bar')]
            const current = document.querySelector('[data-testid=outline-bars] .outline-bar.current')
            return !!current && all.indexOf(current) === all.length - 1 && Number(current.dataset.last) === ${total - 1}
          })()`
          check(
            await eventually(ui, lastIsCurrent, 3000),
            'en bas du fil : le dernier trait du sommaire est le courant'
          )
          await ui.ev(
            `document.querySelector('.outline').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`
          )
          await ui.hover(await ui.center(`document.querySelector('[data-testid=outline-bars]')`))
          await ui.waitFor(
            `getComputedStyle(document.querySelector('[data-testid=outline-list]')).display === 'block'`
          )
          // Inventaire `sommaire` n° 7 (capture) : la liste s'ouvre sur le message lu.
          await affirm(ui, '277-longue-sommaire-liste', [
            probes.custom(
              'la liste du sommaire montre le message lu',
              `const list = document.querySelector('[data-testid=outline-list]')
              const current = list.querySelector('.current')
              if (!current) return { ok: false, detail: 'aucun élément courant' }
              const b = current.getBoundingClientRect(), l = list.getBoundingClientRect()
              return { ok: b.top >= l.top - 1 && b.bottom <= l.bottom + 1, detail: Math.round(b.top) + '…' + Math.round(b.bottom) + ' dans ' + Math.round(l.top) + '…' + Math.round(l.bottom) }`
            )
          ])
          await ui.click(`document.querySelectorAll('[data-testid=outline-item]')[2]`)
          await ui.hover({ x: 900, y: 500 })
          await settle(ui)
          check(
            (await ui.ev(shown(2))) && !(await ui.ev(atBottom)),
            'le troisième message est à l’écran, le fil n’est plus en bas'
          )
          await ui.waitFor(`!!${ui.$('scroll-to-bottom')}`)
          // Inventaire `degrade-haut` n° 3, `worktree-cycle` n° 3 : amené sous le fondu, jamais dessous.
          await affirm(ui, '276-longue-ancien-message', [clearOfFade(2)])
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
          // Inventaire `debordements` n° 7-10, `tables` n° 2-3 (captures) : mesurées, pas seulement
          // photographiées. Le tableau large (8 colonnes) et le code défilent dans leur cadre.
          // Le plus large des tableaux du fil (celui de huit colonnes du scénario `tableaux`).
          const table = `[...document.querySelectorAll('[data-testid=markdown-table]')].sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth))[0]`
          await ui.ev(`${table}?.scrollIntoView({ block: 'center' }), true`)
          await affirm(ui, '276-longue-etroite', [
            probes.threadFits({ framed: 1 }),
            probes.computed(
              '[data-testid=markdown-table] td',
              'border-left-width',
              '0px',
              'tableau sans grille (pas de filet vertical)'
            ),
            probes.custom(
              'tableau large : reste dans la colonne, défile dans son cadre',
              `const wrap = ${table}
              if (!wrap) return { ok: false, detail: 'aucun tableau' }
              const column = wrap.closest('.markdown').clientWidth
              return { ok: wrap.clientWidth <= column && wrap.scrollWidth > wrap.clientWidth, detail: wrap.clientWidth + ' ≤ ' + column + ' px, contenu ' + wrap.scrollWidth + ' px' }`
            )
          ])
          await ui.ev(`${THREAD}.scrollTop = ${THREAD}.scrollHeight`)
          await settle(ui)
          await ui.viewport(1600, 900)
          await settle(ui)
          await affirm(ui, '277-longue-large', [probes.threadFits()])
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
