import { MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Messages envoyés : plus de 120 éléments, le fil rouvert n'est rendu qu'en partie (fiche 193). */
const MESSAGES = 64

/**
 * Dégradé du haut et racine immobile (fiche 270).
 *
 * - Un défilement automatique vers un message (sommaire, message pas encore rendu, recherche dans
 *   le fil, `scrollIntoView`, focus) l'amène sous le fondu de la barre de titre, jamais dessous.
 * - Rien au-dessus des zones qui défilent ne défile (D26) : ni `html`, ni `body`, ni `#root`, ni la
 *   fenêtre des Réglages ; aucun en-tête n'est rogné. Vérifié sur chaque page principale (accueil,
 *   fil, côte à côte, panneau de droite, Mon activité, Tâches planifiées, Réglages et chacune de
 *   ses rubriques, Nouveautés), après ouverture, navigation au clavier, défilement, fenêtre étroite,
 *   et avec un contenu qui dépasse de la fenêtre (ce qui, avant, laissait la racine défiler).
 */
export async function topFadeSuite(scheme) {
  console.log(`\n— Dégradé du haut et racine immobile (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await expectStill(ui, 'accueil')
      await tabThrough(ui, 'accueil', 20)

      for (let i = 1; i <= MESSAGES; i++) {
        await ui.send(`Question ${i} : où en est l’étape ${i} ?`)
        await ui.ready()
      }
      await ui.closePanel()
      await ui.waitFor(`!!document.querySelector('[data-testid=outline-bars]')`)

      // 1. Sommaire, messages déjà rendus.
      for (const index of [40, 55]) {
        await goOutline(ui, index)
        await expectClear(ui, `sommaire, message ${index + 1}`, messageAt(index))
      }
      await ui.shot('270-sommaire')

      // 2. Sommaire, message pas encore rendu (fil rouvert par la fin : élément à rendre puis à
      // montrer, fiche 193).
      const longTitle = await ui.ev(
        `document.querySelector('.history-item.active .label').innerText`
      )
      await ui.click(ui.$('new-conversation'))
      await ui.waitFor(`!document.querySelector('.history-item.active')`)
      await ui.send('Une autre conversation')
      await ui.ready()
      await ui.click(itemNamed(longTitle))
      await ui.waitFor(`document.querySelectorAll('[data-testid=user-message]').length > 0`)
      await ui.closePanel()
      await ui.waitFor(`!!document.querySelector('[data-testid=outline-bars]')`)
      check(
        !(await ui.ev(`!!${messageAt(0)}`)),
        'fil rouvert par la fin : le premier message n’est pas encore rendu'
      )
      await goOutline(ui, 0)
      await ui.waitFor(`!!${messageAt(0)}`)
      await settle(ui)
      await expectClear(ui, 'sommaire, message à rendre (1)', messageAt(0))

      // 3. `scrollIntoView({ block: 'start' })` (outil, focus) : sous le fondu ; le dernier
      // message, que le fil ne peut pas amener en haut, ne fait rien défiler autour (D26).
      await intoView(ui, messageAt(20))
      await expectClear(ui, 'scrollIntoView, message 21', messageAt(20))
      await intoView(ui, `[...document.querySelectorAll('[data-testid=user-message]')].at(-1)`)
      await expectStill(ui, 'scrollIntoView, dernier message')

      // 4. Recherche dans le fil : le résultat, centré, hors du fondu.
      await openFind(ui)
      await ui.type('Question 30 ')
      await ui.waitFor(`CSS.highlights.get('thread-find-current')?.size === 1`)
      await settle(ui)
      const hit = await ui.ev(
        `Math.round([...CSS.highlights.get('thread-find-current')][0].getBoundingClientRect().top)`
      )
      const fade = await fadeBottom(ui)
      check(hit >= fade, `recherche : le résultat (${hit} px) sous le bas du fondu (${fade} px)`)
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('find-bar')}`)

      // 5. Un contenu qui dépasse de la fenêtre, amené à l'écran (focus) : la racine ne bouge pas.
      await expectOverflowIgnored(ui, 'fil')
      await tabThrough(ui, 'fil', 30)

      // 6. Fenêtre étroite, panneau de droite ouvert.
      await ui.viewport(760, 620)
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${ui.$('side-panel')}`)
      await intoView(ui, messageAt(50))
      await expectClear(ui, 'fenêtre étroite, panneau ouvert, message 51', messageAt(50))
      await ui.shot('270-etroite')
      await tabThrough(ui, 'panneau de droite, fenêtre étroite', 30)
      await ui.viewport()
      await tabThrough(ui, 'panneau de droite', 30)
      await ui.closePanel()

      // 7. Côte à côte : la conversation courte à côté, le long fil au centre.
      await ui.click(
        `${itemNamed('Une autre conversation')}.querySelector('[data-testid=history-more]')`
      )
      await ui.waitFor(`!!${ui.$('history-open-beside')}`)
      await ui.click(ui.$('history-open-beside'))
      await ui.waitFor(`!!${ui.$('beside')}`)
      await intoView(ui, messageAt(30))
      await expectClear(ui, 'côte à côte, message 31', messageAt(30))
      await intoView(ui, `${ui.$('beside')}.querySelector('[data-testid=user-message]')`)
      await expectStill(ui, 'côte à côte')
      await tabThrough(ui, 'côte à côte', 20)
      await ui.click(ui.$('beside-close'))
      await ui.waitFor(`!${ui.$('beside')}`)

      // 8. Mon activité : ouverture, Semaine / Mois / Année, grille défilée, clavier, fenêtre
      // étroite, contenu qui dépasse.
      await ui.click(ui.$('open-activity'))
      await ui.waitFor(`!!${ui.$('activity-title')}`)
      await expectStill(ui, 'Mon activité ouverte')
      for (const scope of ['month', 'year', 'week']) {
        await ui.click(ui.$(`activity-scope-${scope}`))
        await frame(ui)
        await expectStill(ui, `Mon activité, ${scope}`)
      }
      await ui.ev(
        `(() => { const h = document.querySelector('.activity-heat-scroll'); if (h) h.scrollLeft = 0; return true })()`
      )
      await expectStill(ui, 'Mon activité, grille défilée')
      await tabThrough(ui, 'Mon activité', 40)
      await expectOverflowIgnored(ui, 'Mon activité', '270-mon-activite-debord')
      await ui.viewport(640, 520)
      await tabThrough(ui, 'Mon activité, fenêtre étroite', 40)
      await ui.ev(
        `(() => { document.querySelector('.activity-scroll').scrollTop = 0; return true })()`
      )
      await frame(ui)
      await ui.shot('270-mon-activite-etroite')
      await ui.viewport()
      await frame(ui)
      await ui.shot('270-mon-activite')

      // 9. Tâches planifiées.
      await ui.click(ui.$('open-scheduled'))
      await frame(ui)
      await expectStill(ui, 'Tâches planifiées')
      await tabThrough(ui, 'Tâches planifiées', 30)
      await expectOverflowIgnored(ui, 'Tâches planifiées')

      // 10. Réglages, chaque rubrique, fenêtre haute puis basse : la liste des rubriques défile
      // dans sa colonne, la fenêtre des Réglages jamais sous son en-tête.
      for (const [width, height] of [
        [1280, 820],
        [760, 520]
      ]) {
        await ui.viewport(width, height)
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!document.querySelector('.settings-dialog')`)
        for (const id of SECTIONS) {
          await ui.click(ui.$(`settings-${id}`))
          await frame(ui)
          await tabThrough(ui, `Réglages › ${id} (${width} px)`, 30)
        }
        if (height < 600) {
          await ui.click(ui.$('settings-data'))
          await ui.ev(
            `(() => { const n = document.querySelector('.settings-nav'); n.scrollTop = n.scrollHeight; return true })()`
          )
          await frame(ui)
          check(
            await ui.ev(
              `(() => { const n = document.querySelector('.settings-nav'); const b = ${ui.$('settings-about')}.getBoundingClientRect(); return n.scrollHeight > n.clientHeight && b.bottom <= n.getBoundingClientRect().bottom + 1 })()`
            ),
            'Réglages, fenêtre basse : la liste des rubriques défile dans sa colonne, « Nouveautés » à l’écran'
          )
          await expectStill(ui, 'Réglages, fenêtre basse')
          await ui.shot('270-reglages-bas')
        }
        await ui.key('Escape')
        await ui.waitFor(`!document.querySelector('.settings-dialog')`)
      }
      await ui.viewport()
    },
    undefined,
    'echo',
    {},
    // Recherche dans le fil ouverte par la commande de menu, comme ⌘F.
    [`--inspect=${MAIN_PORT}`]
  )
}

const SECTIONS = [
  'general',
  'appearance',
  'notifications',
  'shortcuts',
  'conversation',
  'agents',
  'roles',
  'memory',
  'mcp',
  'commands',
  'privacy',
  'data',
  'diagnostics',
  'about'
]

const messageAt = (index) =>
  `[...document.querySelectorAll('[data-testid=user-message]')].find((m) => m.innerText.includes('Question ${index + 1} '))`

const itemNamed = (title) =>
  `[...document.querySelectorAll('[data-testid=history-item]')].find((i) => i.querySelector('.label')?.innerText.startsWith(${JSON.stringify(title)}))`

/** Deux images : le défilement et la mise en page appliqués. */
const frame = (ui) =>
  ui.ev(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`)

async function intoView(ui, element) {
  await ui.ev(`(() => { (${element}).scrollIntoView({ block: 'start' }); return true })()`)
  await frame(ui)
}

/** Va au message `index` par la liste du sommaire (au survol), et attend la fin du défilement. */
async function goOutline(ui, index) {
  await ui.ev(
    `document.querySelector('.outline').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`
  )
  await ui.hover(await ui.center(`document.querySelector('[data-testid=outline-bars]')`))
  await ui.waitFor(
    `getComputedStyle(document.querySelector('[data-testid=outline-list]')).display === 'block'`
  )
  await ui.click(`document.querySelectorAll('[data-testid=outline-item]')[${index}]`)
  await ui.hover({ x: 900, y: 500 })
  await settle(ui)
}

/** Attend que le fil ne bouge plus (défilement doux du sommaire). */
async function settle(ui) {
  await ui.ev(`new Promise((resolve) => {
    const s = document.querySelector('.main > .scroll')
    let last = -1, still = 0
    const tick = () => {
      if (s.scrollTop === last) still++
      else { still = 0; last = s.scrollTop }
      if (still >= 6) resolve(true)
      else requestAnimationFrame(tick)
    }
    tick()
  })`)
}

/** Bas du fondu sous la barre de titre de la conversation (px depuis le haut de la fenêtre). */
const fadeBottom = (ui) =>
  ui.ev(`(() => {
    const header = document.querySelector('.main-header')
    return Math.round(header.getBoundingClientRect().bottom + parseFloat(getComputedStyle(header, '::after').height))
  })()`)

/** L'élément commence sous le bas du fondu de la barre de titre ; et rien n'a bougé autour. */
async function expectClear(ui, label, element) {
  const fade = await fadeBottom(ui)
  const top = await ui.ev(`Math.round((${element}).getBoundingClientRect().top)`)
  check(top >= fade, `${label} : le haut du message (${top} px) sous le bas du fondu (${fade} px)`)
  await expectStill(ui, label, true)
}

/** Ce qui a bougé : racine, conteneurs de la page, fenêtre des Réglages ; en-têtes rognés. */
const MOVED = `(() => {
  const name = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map((c) => '.' + c).join('')
  const out = []
  const roots = [document.scrollingElement, document.documentElement, document.body, document.getElementById('root'), ...document.querySelectorAll('.app, .workarea, .main, .side-panel, .beside, .settings-dialog, .settings-main, .search-dialog')]
  for (const el of new Set(roots)) if (el.scrollTop || el.scrollLeft) out.push(name(el) + ' ' + el.scrollTop)
  const app = document.querySelector('.app').getBoundingClientRect()
  if (app.top !== 0 || app.left !== 0) out.push('.app à ' + app.top + ',' + app.left)
  for (const h of document.querySelectorAll('.main-header, .side-panel-head, .beside-head, .sidebar-header, .settings-header')) {
    const r = h.getBoundingClientRect()
    const box = (h.closest('.settings-dialog') ?? document.documentElement).getBoundingClientRect()
    if (r.height && r.top < box.top - 0.5) out.push('en-tête rogné ' + name(h) + ' ' + Math.round(r.top))
  }
  return out
})()`

/** Rien ne défile hors des zones prévues pour, aucun en-tête rogné ; `quiet` : rien dit si vert. */
async function expectStill(ui, label, quiet = false) {
  const moved = await ui.ev(MOVED)
  if (quiet && moved.length === 0) return
  check(
    moved.length === 0,
    `${label} : la racine et les en-têtes n’ont pas bougé (${moved.join(', ') || 'scrollTop 0'})`
  )
}

/** Tab dans toute la page (jusqu'au bas) : rien ne bouge à chaque pas. */
async function tabThrough(ui, label, steps) {
  let failure = ''
  for (let i = 0; i < steps && !failure; i++) {
    await ui.press('Tab')
    const moved = await ui.ev(MOVED)
    if (moved.length) {
      const focus = await ui.ev(
        `(() => { const e = document.activeElement; return e ? (e.getAttribute('aria-label') || e.innerText || e.tagName).slice(0, 30) : '' })()`
      )
      failure = `Tab ${i + 1} (« ${focus} ») : ${moved.join(', ')}`
    }
  }
  check(
    !failure,
    `${label}, ${steps} Tab : la racine et les en-têtes n’ont pas bougé${failure ? ` — ${failure}` : ''}`
  )
}

/**
 * Contenu qui dépasse de 12 px le bas de la fenêtre (dans la barre de titre), amené à l'écran
 * par le focus et par `scrollIntoView` : la racine n'a rien à faire défiler. Simule tout
 * débordement (menu, avis, élément mal dimensionné) qui laissait la racine défiler (D26).
 */
async function expectOverflowIgnored(ui, label, shot) {
  await ui.ev(`(() => {
    const host = document.querySelector('.main-header')
    const probe = document.createElement('div')
    probe.id = 'e2e-270-overflow'
    probe.style.cssText = 'position:absolute;top:0;left:0;width:10px;height:calc(100vh + 12px);pointer-events:none'
    const tail = document.createElement('button')
    tail.style.cssText = 'position:absolute;bottom:0;left:0'
    probe.append(tail)
    host.append(probe)
    tail.focus()
    tail.scrollIntoView({ block: 'end' })
    return true
  })()`)
  await frame(ui)
  const moved = await ui.ev(MOVED)
  if (shot) await ui.shot(shot)
  await ui.ev(`(() => { document.getElementById('e2e-270-overflow').remove(); return true })()`)
  check(
    moved.length === 0,
    `${label}, contenu qui dépasse amené à l’écran : la racine n’a pas bougé (${moved.join(', ') || 'scrollTop 0'})`
  )
  // Avant le correctif, la racine restait décalée : la remettre pour que la suite reste lisible.
  await ui.ev(
    `(() => { for (const e of [document.scrollingElement, document.body, document.getElementById('root')]) { e.scrollTop = 0 } return true })()`
  )
}

/** « Rechercher dans la conversation » (commande de menu, comme ⌘F). */
async function openFind(ui) {
  const main = await mainProcess()
  try {
    await main.evaluate(
      `require('electron').BrowserWindow.getAllWindows()[0].webContents.send('app:command', 'find'); true`
    )
  } finally {
    main.close()
  }
  await ui.waitFor(`document.activeElement === ${ui.$('find-input')}`)
}
