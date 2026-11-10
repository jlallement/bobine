import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Panneau latéral à onglets, onglet « Tâches » (fiches 029, 035). */
export async function panelSuite(scheme) {
  console.log(`\n— Panneau latéral (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      check(!(await ui.ev(`!!${ui.$('side-panel')}`)), 'panneau fermé au départ')
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${ui.$('session-tab')}`)
      check(true, 'panneau ouvert à la main : sur « Session », son premier onglet (fiche 166)')
      await ui.click(ui.$('panel-more'))
      await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
      await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=tasks]')`)
      await ui.waitFor(`!!${ui.$('tasks-empty')}`)
      check(true, 'onglet « Tâches » choisi dans « + » : pas encore de tâches')
      await ui.click(
        `${ui.$('side-panel')}.querySelector('[aria-label="${L('sidePanel.close')}"]')`
      )
      await ui.waitFor(`!${ui.$('side-panel')}`)
      await ui.send('Fais un plan')
      await ui.ready()
      check(
        (await ui.ev(`${ui.$('panel-toggle')}.innerText.trim()`)) === '3 / 3',
        'en-tête : progression du plan (3 / 3)'
      )
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${ui.$('tasks')}`)
      check(
        (await ui.ev(`${ui.$('tasks')}.querySelectorAll('li.completed').length`)) === 3 &&
          (await ui.ev(`${ui.$('tasks')}.innerText`)).includes(
            L('sidePanel.progress', { done: 3, count: 3 })
          ),
        'onglet « Tâches » : dernier plan de l’agent avec sa progression'
      )
      const width = () => ui.ev(`${ui.$('side-panel')}.getBoundingClientRect().width`)
      // Le panneau arrive en glissant (fiche 185, P1) : on le prend immobile.
      await ui.waitFor(`${ui.$('side-panel')}.getAnimations().length === 0`)
      const before = await width()
      const handle = await ui.ev(
        `(() => { const b = document.querySelector('.side-panel-resize').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + 200 } })()`
      )
      // Évènements de pointeur sur la poignée, montrés si la largeur ne suit pas : un échec rare
      // en parallèle (fiche 115, 1 sur ≈ 150 passages), non reproduit, perdait les derniers.
      await ui.ev(`(() => {
        window.__pointer = []
        const h = document.querySelector('.side-panel-resize')
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
          h.addEventListener(type, (e) => window.__pointer.push(type + ' ' + Math.round(e.clientX) + ' ' + e.buttons), true)
        }
        return true
      })()`)
      // 80 px de plus : dans la fenêtre de 1280 px, la conversation garde ses 500 px (fiche 173).
      await ui.drag(handle, { x: handle.x - 80, y: handle.y })
      // La largeur suit au rendu suivant : on l'attend plutôt que de la lire tout de suite.
      await ui
        .waitFor(
          `Math.abs(${ui.$('side-panel')}.getBoundingClientRect().width - ${before} - 80) < 4`,
          3000
        )
        .catch(() => {})
      const after = await width()
      if (Math.abs(after - before - 80) >= 4) {
        console.log(
          '    largeurs :',
          before,
          '→',
          after,
          'fenêtre',
          await ui.ev('window.innerWidth'),
          'poignée',
          JSON.stringify(handle),
          'pointeur',
          await ui.ev('window.__pointer.join(", ")')
        )
      }
      check(Math.abs(after - before - 80) < 4, 'panneau redimensionné à la souris')
      await ui.shot('23-panneau-taches')

      // Onglets nommés (fiche 082) : seulement les outils qui servent, les autres dans « + ».
      const panel = ui.$('side-panel')
      const tabs = () =>
        ui.ev(`[...${panel}.querySelectorAll('[role=tab]')].map((tab) => tab.dataset.tab).join()`)
      const tasksTab = await ui.ev(
        `document.querySelector('.side-panel-tab[data-tab=tasks]').innerText`
      )
      check(
        (await tabs()) === 'session,tasks' &&
          tasksTab.includes(L('panel.tab.tasks')) &&
          tasksTab.includes('3/3'),
        `onglets nommés : « Session » puis « Tâches 3/3 », aucun autre outil n’a servi (${await tabs()})`
      )
      await ui.click(ui.$('panel-more'))
      await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
      const offered = await ui.ev(
        `[...${ui.$('panel-more-menu')}.querySelectorAll('[role=menuitem]')].map((item) => item.dataset.tab).join()`
      )
      check(
        offered === 'browser,simulator,android,terminal,acp,changes',
        `menu « + » : les autres outils (${offered})`
      )
      await ui.shot('23b-panneau-autres-outils')
      await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=browser]')`)
      await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=browser]')`)
      check(
        (await tabs()) === 'session,tasks,browser',
        'outil choisi dans « + » : son onglet s’ajoute à droite, Tâches ne bouge pas (fiche 154)'
      )

      // Agrandi (fiche 082) : à la place de la conversation, la barre latérale reste.
      await ui.click(`document.querySelector('.side-panel-tab[data-tab=tasks]')`)
      const maximized = `${panel}.classList.contains('maximized')`
      await ui.click(ui.$('panel-maximize'))
      await ui.waitFor(maximized)
      check(
        await ui.ev(`(() => {
          const p = ${panel}.getBoundingClientRect()
          const s = document.querySelector('aside.sidebar').getBoundingClientRect()
          return Math.abs(p.right - window.innerWidth) < 2 && Math.abs(p.left - s.right) < 2 &&
            s.width > 100 && document.querySelector('main').inert
        })()`),
        'agrandi : le panneau prend la place de la conversation, la barre latérale reste, le fil est hors d’atteinte'
      )
      // macOS déplace la fenêtre au clic sur une zone .drag, même recouverte : rien de la
      // conversation, dessous, ne doit l'être sous le contenu du panneau (barre d'adresse…).
      check(
        await ui.ev(`(() => {
          const region = (el, pseudo) => getComputedStyle(el, pseudo).getPropertyValue('-webkit-app-region')
          return region(${panel}) === 'no-drag' &&
            region(${panel}.querySelector('.side-panel-body')) === 'no-drag' &&
            region(${panel}.querySelector('.side-panel-head')) === 'drag' &&
            region(document.querySelector('.main-header'), '::after') === 'no-drag'
        })()`),
        'agrandi : la barre de la conversation, dessous, ne déplace pas la fenêtre sous le panneau'
      )
      await ui.shot('23c-panneau-agrandi')
      const main = await mainProcess()
      try {
        await main.evaluate(
          `require('electron').Menu.getApplicationMenu().getMenuItemById('maximize-panel').click()`
        )
      } finally {
        main.close()
      }
      await ui.waitFor(`!${maximized}`)
      check(
        Math.abs((await width()) - after) < 4 &&
          !(await ui.ev(`document.querySelector('main').inert`)),
        'Affichage › Agrandir le panneau : réduit, à sa largeur d’avant'
      )
      await ui.ev(
        `document.querySelector('.side-panel-resize').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`
      )
      await ui.waitFor(maximized)
      check(true, 'double-clic sur la poignée : agrandi')
      // Barre latérale masquée : le panneau laisse la place des boutons de la fenêtre et offre de
      // la rouvrir.
      await ui.click(`document.querySelector('.sidebar-header .icon-button:last-of-type')`)
      const showSidebar = `${panel}.querySelector('[aria-label="${L('app.showSidebar')}"]')`
      await ui.waitFor(`!!${showSidebar}`)
      check(
        await ui.ev(`${panel}.querySelector('.side-panel-head').classList.contains('with-lights')`),
        'agrandi sans barre latérale : bouton pour la rouvrir, place des boutons de la fenêtre'
      )
      await ui.shot('23e-panneau-agrandi-sans-barre')
      await ui.click(showSidebar)
      await ui.waitFor(`!${showSidebar}`)
      await ui.click(ui.$('panel-maximize'))
      await ui.waitFor(`!${maximized}`)

      // Agrandi pendant une demande de l'agent : on le sait, un clic ramène au fil.
      const card = `document.querySelector('[data-testid=permission]')`
      await ui.send('/scenario liste-taches')
      await ui.waitFor(`!!${card}`)
      await ui.click(ui.$('panel-maximize'))
      await ui.waitFor(`!!${ui.$('panel-agent-status')}?.classList.contains('request')`)
      check(
        (await ui.ev(`${ui.$('panel-agent-status')}.innerText`)).includes(
          L('sidePanel.agent.request')
        ),
        'agrandi : « Attend votre réponse » pendant la demande d’autorisation'
      )
      await ui.shot('23d-panneau-agrandi-demande')
      await ui.click(ui.$('panel-agent-status'))
      await ui.waitFor(`!${maximized}`)
      check(
        await ui.ev(`!!${card}`),
        'clic sur l’état de l’agent : retour au fil, la demande est là'
      )
      await ui.click(`${card}.querySelector('button[data-kind=allow_once]')`)
      await ui.ready()

      // ✕ d'un onglet (fiche 082) : il quitte le panneau (l'outil continue), le voisin s'affiche,
      // et il revient dans « + » ; le dernier fermé ferme le panneau.
      const tab = (id) => `document.querySelector('.side-panel-tab[data-tab=${id}]')`
      const closeOf = (id) => `${tab(id)}.querySelector('[data-testid=panel-tab-close]')`
      await ui.click(tab('browser'))
      await ui.waitFor(`${tab('browser')}.classList.contains('active')`)
      await ui.click(closeOf('browser'))
      await ui.waitFor(`!${tab('browser')}`)
      check(
        (await tabs()) === 'session,tasks' &&
          (await ui.ev(`${tab('tasks')}.classList.contains('active')`)),
        `✕ sur l’onglet affiché : il disparaît, son voisin s’affiche (${await tabs()})`
      )
      await ui.click(ui.$('panel-more'))
      await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
      await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=browser]')`)
      await ui.waitFor(`!!${tab('browser')}?.classList.contains('active')`)
      check(
        (await tabs()) === 'session,tasks,browser',
        'onglet fermé : rouvert par le menu « + », il revient à droite'
      )
      await ui.shot('23f-panneau-onglets-fermer')
      await ui.ev(
        `${tab('tasks')}.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }))`
      )
      await ui.waitFor(`!${tab('tasks')}`)
      check((await tabs()) === 'session,browser', 'clic molette sur un onglet : il se ferme')
      await ui.click(closeOf('browser'))
      await ui.waitFor(`!${tab('browser')}`)
      // « Session » aussi se ferme (fiche 166) : il revient par « + ».
      await ui.click(closeOf('session'))
      await ui.waitFor(`!${panel}`)
      check(true, 'dernier onglet fermé : le panneau se ferme')
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${panel}`)
      check(
        // Rouvert par le compteur des tâches de l'en-tête : sur « Tâches ».
        (await tabs()) === 'tasks' &&
          (await ui.ev(`localStorage.getItem('bobine.panel.closedTabs') ?? ''`)).includes(
            'browser'
          ),
        `panneau rouvert : l’onglet fermé ne revient pas, et c’est retenu (${await tabs()})`
      )

      await ui.click(ui.$('panel-maximize'))
      await ui.waitFor(maximized)
      await ui.click(ui.$('new-conversation'))
      await ui.waitFor(`!${maximized}`)
      check(true, 'nouvelle conversation : le panneau se réduit')
    },
    undefined,
    'plan',
    {},
    // Process principal joignable : commande du menu Affichage.
    [`--inspect=${MAIN_PORT}`]
  )
}
