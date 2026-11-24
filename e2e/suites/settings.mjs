import { COMMAND, FEATURES, K, L, LANG, MAIN_PORT, check, withApp, mainProcess } from '../lib.mjs'
import { affirm, probes } from '../affirm.mjs'
import { tokensOf } from '../palette.mjs'

/**
 * Réglages, menu et raccourcis, recherche ⌘K (fiche 027). Le menu est cliqué depuis le main. Sa
 * forme et la notation des raccourcis suivent la plateforme (fiche 145) : macOS, ou Linux (sous
 * Docker, `pnpm e2e:linux`, ou `BOBINE_PLATFORM=linux`).
 */
export async function settingsSuite(scheme) {
  console.log(`\n— Réglages et raccourcis (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const main = await mainProcess()
      try {
        const menu = (id) =>
          main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById(${JSON.stringify(id)}).click(), true)`
          )
        if (!FEATURES.appMenu) {
          await appMenuLinux(ui, main, scheme)
        }
        // Puces de la barre latérale dans la notation de la plateforme (⌘1, ⇧⌘U ou Ctrl+1, Ctrl+Maj+U).
        const chips = await ui.ev(
          `[${ui.$('space-code')}?.querySelector('kbd')?.innerText, document.querySelector('.sidebar-kbd')?.innerText]`
        )
        check(
          chips[0] === K('⌘1') && chips[1] === K('⇧⌘U'),
          `barre latérale : raccourcis ${chips.join(', ')}`
        )
        await ui.shot('80a-barre-laterale-raccourcis')

        await ui.send('Plan de migration Postgres')
        await ui.ready()
        await menu('new-conversation')
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.ready()
        await ui.send('Écran de connexion')
        await ui.ready()
        await ui.waitFor(`document.querySelectorAll('.history-item').length === 2`)

        await menu('previous-conversation')
        await ui.waitFor(
          `document.querySelector('.history-item.active .label')?.innerText.startsWith('Plan')`
        )
        await menu('next-conversation')
        await ui.waitFor(
          `document.querySelector('.history-item.active .label')?.innerText.startsWith('Écran')`
        )
        check(true, '⌥⌘↑ / ⌥⌘↓ : conversation précédente, suivante')

        await menu('search')
        await ui.waitFor(`document.activeElement === ${ui.$('search-input')}`)
        await ui.type('postgres')
        await ui.waitFor(`document.querySelectorAll('[data-testid=search-result]').length === 1`)
        await ui.shot('80-recherche')
        await ui.enter()
        await ui.waitFor(`!${ui.$('search')}`)
        // La conversation choisie s'affiche après un aller-retour avec le main.
        await ui
          .waitFor(
            `document.querySelector('.history-item.active .label')?.innerText.startsWith('Plan de migration')`,
            5000
          )
          .catch(() => {})

        await menu('toggle-sidebar')
        await ui.waitFor(`!!document.querySelector('.sidebar.collapsed')`)
        await menu('toggle-sidebar')
        await ui.waitFor(`!document.querySelector('.sidebar.collapsed')`)
        await menu('focus-composer')
        await ui.waitFor(`document.activeElement === ${ui.$('composer-input')}`)
        check(true, '⌘B barre latérale, ⌘L zone de saisie')

        // Largeur de la barre latérale (fiche 113) : 300 px par défaut, poignée, double-clic.
        const sidebarWidth = (px) =>
          `Math.abs(document.querySelector('aside.sidebar').getBoundingClientRect().width - ${px}) < 2`
        const handle = `document.querySelector('[data-testid=sidebar-resize]')`
        // La barre revient de ⌘B en glissant (0,2 s) : la poignée se mesure une fois en place.
        await ui.waitFor(
          `document.querySelector('aside.sidebar').getBoundingClientRect().left === 0`
        )
        // Sous charge (suites en parallèle, fiche 115), l'appui sur la poignée est parfois perdu
        // et la barre ne bouge pas : le glisser est refait, depuis la poignée là où elle est.
        const dragSidebarTo = async (px) => {
          for (let attempt = 0; ; attempt++) {
            const from = await ui.ev(
              `(() => { const r = ${handle}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 200 } })()`
            )
            // La barre part du bord gauche : sa largeur est l'abscisse où la poignée est lâchée.
            await ui.drag(from, { x: px, y: from.y })
            try {
              await ui.waitFor(sidebarWidth(Math.min(px, 440)), 3000)
              return
            } catch (error) {
              if (attempt >= 2) throw error
            }
          }
        }
        await dragSidebarTo(380)
        await dragSidebarTo(800)
        await ui.shot('80b-barre-laterale-large')
        await ui.ev(`${handle}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
        await ui.waitFor(sidebarWidth(300))

        await menu('settings')
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.shot('81-general')
        // Apparence (fiche 136) : huit thèmes en deux rangées (Fjord, fiche 168 ; Aurore, fiche
        // 226), polices et tailles, aperçu.
        await ui.click(ui.$('settings-appearance'))
        await ui.waitFor(`!!${ui.$('appearance-preview')}`)
        await ui.shot('81-apparence')
        await ui.click(ui.$('theme-dark'))
        await ui.waitFor(`${ui.$('theme-dark')}.getAttribute('aria-checked') === 'true'`)
        // Le mode des essais est imposé à la page (`prefers-color-scheme`) : le thème de ce mode.
        const variant = scheme === 'dark' ? 'black' : 'aurora'
        await ui.click(ui.$(`theme-${variant}`))
        await ui.waitFor(`document.documentElement.dataset.palette === '${variant}'`)
        await ui.shot('81-apparence-variante')
        // Thème Fjord (fiche 168) : la variante de ce mode, cochée, posée et appliquée au fond.
        const fjord = scheme === 'dark' ? 'fjordNight' : 'fjord'
        await ui.click(ui.$(`theme-${fjord}`))
        await ui.waitFor(`document.documentElement.dataset.palette === '${fjord}'`)
        // Rendu réel (style calculé) : mesuré par la capture (plan de suppression, risque 2).
        await affirm(ui, '81-apparence-fjord', [
          probes.custom(
            `fond du thème ${fjord} (${tokensOf(fjord).bg})`,
            `const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim()
            return { ok: bg === ${JSON.stringify(tokensOf(fjord).bg)}, detail: bg }`
          )
        ])
        await ui.click(ui.$('theme-system'))
        await ui.waitFor(`document.documentElement.dataset.palette === ''`)
        // Police Serif (celle de l'app par défaut, fiche 070), texte plus petit, appliqués au fil.
        await ui.ev(`(() => {
          const select = ${ui.$('settings-conversation-font')}
          select.value = 'serif'
          select.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        })()`)
        await ui.click(ui.$('settings-conversation-size-less'))
        await ui.click(ui.$('settings-conversation-size-less'))
        await ui.waitFor(`${ui.$('settings-conversation-size')}.innerText === '14'`)
        await ui.waitFor(
          `getComputedStyle(document.querySelector('.msg-agent')).fontSize === '14px' && getComputedStyle(document.querySelector('.msg-agent')).fontFamily.includes('Georgia')`
        )
        await ui.click(ui.$('settings-terminal-size-more'))
        await ui.click(ui.$('settings-terminal-size-more'))
        await ui.waitFor(`${ui.$('settings-terminal-size')}.innerText === '13.5'`)
        await ui.ev(`${ui.$('settings-terminal-size')}.scrollIntoView({ block: 'end' }); true`)
        await ui.shot('83-apparence-code')

        // Confidentialité : navigateur intégré (fiche 072), cookies gardés par défaut, effaçables.
        await ui.click(ui.$('settings-privacy'))
        await ui.waitFor(`!!${ui.$('settings-browser-keep-cookies')}`)
        await main.evaluate(`(async () => {
          const s = require('electron').session.fromPartition('persist:bob-browser')
          await s.cookies.set({ url: 'https://exemple.test', name: 'essai', value: '1', expirationDate: Date.now() / 1000 + 3600 })
          return true
        })()`)
        await ui.click(ui.$('settings-clear-browser-data'))
        await ui.waitFor(`!!${ui.$('settings-clear-browser-data-note')}`)
        check(
          (await main.evaluate(
            `require('electron').session.fromPartition('persist:bob-browser').cookies.get({}).then((c) => c.length)`
          )) === 0,
          'navigateur : « Effacer » vide les cookies et le dit'
        )
        // Cookies plus gardés : ceux du disque partent tout de suite (fiche 072).
        const cookieCount = () =>
          main.evaluate(
            `require('electron').session.fromPartition('persist:bob-browser').cookies.get({}).then((c) => c.length)`
          )
        await main.evaluate(`(async () => {
          const s = require('electron').session.fromPartition('persist:bob-browser')
          await s.cookies.set({ url: 'https://exemple.test', name: 'essai', value: '2', expirationDate: Date.now() / 1000 + 3600 })
          return true
        })()`)
        await ui.click(ui.$('settings-browser-keep-cookies'))
        let left = await cookieCount()
        for (let i = 0; i < 30 && left !== 0; i++) {
          await new Promise((r) => setTimeout(r, 100))
          left = await cookieCount()
        }
        await ui.click(ui.$('settings-browser-keep-cookies'))
        await ui.waitFor(`${ui.$('settings-browser-keep-cookies')}.checked === true`)
        await ui.shot('81-confidentialite')

        // Notifications : rebond du Dock (fiche 101) activé par défaut, en retrait sous les
        // notifications, grisé quand elles sont coupées.
        await ui.click(ui.$('settings-notifications'))
        const bounce = ui.$('settings-dock-bounce')
        await ui.waitFor(`!!${bounce}`)
        await ui.click(bounce)
        await ui.waitFor(`${bounce}.checked === false`)
        await ui.click(bounce)
        await ui.waitFor(`${bounce}.checked === true`)
        await ui.shot('81-notifications')
        await ui.click(ui.$('settings-notifications-enabled'))
        await ui.waitFor(`${bounce}.disabled && ${bounce}.checked`)
        await ui.shot('81-notifications-grise')
        await ui.click(ui.$('settings-notifications-enabled'))
        await ui.waitFor(`!${bounce}.disabled`)

        // Conversations : nouvelle conversation, sous-tâches, « Avancé ».
        await ui.click(ui.$('settings-conversation'))
        await ui.waitFor(`!!${ui.$('new-conversation-agent')}`)
        // « Comme maintenant » en entier dans les deux listes (fiche 096) : texte du choix mesuré
        // dans la police de la liste, flèche comprise.
        const fits =
          await ui.ev(`['new-conversation-agent', 'new-conversation-folder'].every((id) => {
          const select = document.querySelector('[data-testid="' + id + '"]')
          const style = getComputedStyle(select)
          const ctx = document.createElement('canvas').getContext('2d')
          ctx.font = style.fontSize + ' ' + style.fontFamily
          const room = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20
          return ctx.measureText(select.options[0].text).width <= room
        })`)
        check(fits, 'réglages › conversations : « Comme maintenant » tient dans les listes')
        // Conversations gardées actives (fiche 102), dans « Avancé » : 6 par défaut, de 2 à 12.
        // Baissé à 2 avec trois agents vivants, la plus ancienne au repos est mise en veille.
        await ui.click(`${ui.$('settings-conversation-advanced')}.querySelector('summary')`)
        await ui.waitFor(`${ui.$('settings-conversation-advanced')}.open === true`)
        await ui.ev(`${ui.$('settings-max-live')}.scrollIntoView({ block: 'center' }), true`)
        await ui.waitFor(`${ui.$('settings-max-live')}.innerText === '6'`)
        await ui.shot('83-conversations')
        const statuses = `window.api.conversations.get().then((s) => s.conversations.map((c) => c.status).sort().join())`
        const shown = await ui.ev(`window.api.conversations.get().then((s) => s.activeId)`)
        await ui.ev(`window.api.conversations.create().then(() => true)`)
        await ui.waitFor(`${statuses}.then((s) => s === 'ready,ready,ready')`)
        for (let i = 0; i < 4; i++) await ui.click(ui.$('settings-max-live-less'))
        await ui.waitFor(`${ui.$('settings-max-live')}.innerText === '2'`)
        await ui.waitFor(`${statuses}.then((s) => s === 'ready,ready,stopped')`, 5000)
        for (let i = 0; i < 4; i++) await ui.click(ui.$('settings-max-live-more'))
        await ui.waitFor(`${ui.$('settings-max-live')}.innerText === '6'`)
        await ui.ev(`window.api.conversations.select(${JSON.stringify(shown)}).then(() => true)`)
        await ui.waitFor(
          `window.api.conversations.get().then((s) => s.conversations.find((c) => c.id === ${JSON.stringify(shown)})?.status === 'ready')`
        )

        // Agents : une ligne par agent, qui mène à sa page (fiche 136).
        await ui.click(ui.$('settings-agents'))
        const mock = L('profiles.mock.label')
        await ui.waitFor(`${ui.$('settings-agent-list')}?.innerText.includes('${mock}')`)
        await ui.shot('84-agents')
        // Ce que Bobine sait faire avec l'agent (fiche 054) : annonce retenue + profil.
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        await ui.waitFor(`!!${ui.$('settings-agent-page')}`)
        await ui.shot('84-agent-page')
        await ui.ev(`${ui.$('agent-specific')}.scrollIntoView({ block: 'end' }); true`)
        await ui.shot('84-agents-propre')
        await ui.click(ui.$('settings-agent-back'))
        await ui.waitFor(`!${ui.$('settings-agent-page')} && !!${ui.$('settings-agent-list')}`)
        await ui.click(ui.$('settings-shortcuts'))
        await ui.waitFor(`!!${ui.$('settings-shortcuts-table')}`)
        await ui.shot('82-raccourcis')
        // Nouveautés (fiches 133, 136, essai à la souris du 24/10) : l'app, puis une ligne par
        // version, la plus récente ouverte.
        await ui.click(ui.$('settings-about'))
        await ui.waitFor(`!!${ui.$('settings-changelog')}`)
        await ui.waitFor(`!!document.querySelector('.settings-about-version')`)
        await ui.shot('85-a-propos')

        // Recherche dans les réglages (fiche 051) : ⌘F, résultats, Entrée, réglage mis en avant.
        await ui.press('f', COMMAND)
        await ui.waitFor(`document.activeElement === ${ui.$('settings-search')}`)
        // Un mot du libellé « Empêcher la mise en veille », dans la langue des essais.
        const sleep = LANG === 'en' ? 'sleep' : 'veille'
        await ui.type(sleep)
        await ui.waitFor(`document.querySelectorAll('[data-testid=settings-result]').length >= 1`)
        await ui.shot('85-recherche-reglages')
        await ui.enter()
        await ui.waitFor(
          `${ui.$('settings-general')}?.getAttribute('aria-current') === 'true' && document.querySelector('.settings-flash')?.innerText.includes('${sleep}')`
        )
        // Fonctions propres à un agent (« Propre à … », fiche 126) : cherchables ; Entrée ouvre la
        // page de l'agent (fiche 136).
        await ui.ev(`${ui.$('settings-search')}.focus(); true`)
        await ui.type(L('capabilities.compactCommand.label'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=settings-result]')].some((r) => r.innerText.includes(${JSON.stringify(L('profiles.mock.label'))}))`
        )
        await ui.shot('85-recherche-propre-agent')
        await ui.enter()
        await ui.waitFor(
          `!!${ui.$('settings-agent-page')} && !!document.querySelector('.settings-flash')?.innerText.includes(${JSON.stringify(L('capabilities.compactCommand.label'))})`
        )
        // Un réglage d'« Avancé » : déplié pour le montrer (fiche 136).
        await ui.ev(`${ui.$('settings-search')}.focus(); true`)
        await ui.type(L('settings.network.proxy.label'))
        await ui.waitFor(`document.querySelectorAll('[data-testid=settings-result]').length >= 1`)
        await ui.enter()
        await ui.waitFor(
          `${ui.$('settings-agents-advanced')}?.open === true && !!document.querySelector('.settings-flash')`
        )
        // « Sans serif » / « Serif » (fiche 128) : l'ancien mot « empattements » trouve encore la police.
        if (LANG !== 'en') {
          await ui.ev(`${ui.$('settings-search')}.focus(); true`)
          await ui.type('empattements')
          await ui.waitFor(
            `[...document.querySelectorAll('[data-testid=settings-result]')].some((r) => r.innerText.includes(${JSON.stringify(L('settings.appearance.conversationFont.label'))}))`
          )
        }
        await ui.ev(`${ui.$('settings-search')}.focus(); true`)
        await ui.type('rien de tel')
        await ui.waitFor(`!!${ui.$('settings-no-result')}`)
        await ui.press('Escape')
        await ui.waitFor(`${ui.$('settings-search')}.value === '' && !!${ui.$('settings')}`)
        await ui.key('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)

        await menu('toggle-terminal')
        await ui.waitFor(`!!document.querySelector('.terminal-host .xterm-rows')`)
        await ui.waitFor(
          `getComputedStyle(document.querySelector('.terminal-host .xterm-rows')).fontSize === '13.5px'`
        )
        check(true, 'taille du texte du terminal appliquée')
        await menu('show-changes')
        await ui.waitFor(`!!${ui.$('changes-tab')}`)
        await menu('toggle-panel')
        await ui.waitFor(`!${ui.$('side-panel')}`)
        check(true, '⇧⌘D modifications, ⌘J panneau de droite')
      } finally {
        main.close()
      }
    },
    undefined,
    'streaming-texte',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}

/**
 * Menu ☰ de Bobine hors macOS (fiche 145, variante D) : la barre de menu d'Electron n'est jamais
 * montrée, pas même par Alt ; le bouton et Alt seul ouvrent le menu dessiné par Bobine, Échap le
 * ferme et rend le focus au bouton ; une entrée d'un sous-menu agit, depuis la barre latérale
 * comme depuis l'en-tête quand elle est repliée.
 */
async function appMenuLinux(ui, main, scheme) {
  const barShown = () =>
    main.evaluate(
      `require('electron').BrowserWindow.getAllWindows().some((w) => w.isMenuBarVisible())`
    )
  const content = ui.$('app-menu-content')
  const sidebarClosed = `!!document.querySelector('.sidebar.collapsed')`
  check(!(await barShown()), 'barre de menu d’Electron jamais montrée')

  await ui.click(ui.$('app-menu'))
  await ui.waitFor(`!!${content}`)
  const items = await ui.ev(
    `[...${content}.querySelectorAll(':scope > [role^=menuitem]')].map((i) => i.innerText.replace(/\\s+/g, ' ').trim())`
  )
  check(
    items[0]?.startsWith(L('shortcuts.menu.new-conversation')) &&
      items[0]?.endsWith(K('⌘N')) &&
      items.some((i) => i.startsWith(L('menu.edit'))) &&
      items.at(-1)?.startsWith(L('menu.quit', { app: 'Bobine' })) &&
      (await ui.ev(`${content}.getAttribute('role')`)) === 'menu',
    `bouton ☰ : menu de Bobine, raccourcis en Ctrl (${items.join(' | ')})`
  )
  await ui.shot('app-menu-ouvert')
  await ui.key('Escape')
  await ui.waitFor(`!${content}`)

  // Alt seul, puis relâché : le menu de Bobine, jamais la barre d'Electron.
  await ui.press('Alt', 1)
  await ui.waitFor(`!!${content}`)
  check(!(await barShown()), 'Alt seul : le menu ☰ s’ouvre, pas la barre d’Electron')
  await ui.press('Alt', 1)
  await ui.waitFor(`!${content}`)

  // Affichage › Barre latérale : une entrée d'un sous-menu passe par le main (`app:menuInvoke`).
  await ui.click(ui.$('app-menu'))
  await ui.waitFor(`!!${content}`)
  await ui.click(ui.$('app-menu-menu-view'))
  await ui.waitFor(`!!${ui.$('app-menu-menu-view-content')}`)
  await ui.shot('app-menu-sous-menu')
  await ui.click(ui.$('app-menu-toggle-sidebar'))
  await ui.waitFor(sidebarClosed)
  check(
    await ui.ev(`!!document.querySelector('.main-header [data-testid=app-menu]')`),
    'Affichage › Barre latérale depuis ☰ : barre repliée, ☰ dans l’en-tête'
  )
  // Retour par l'entrée du menu ☰ de l'en-tête. Les raccourcis Ctrl du menu sans barre (Ctrl+B…)
  // ne se vérifient qu'avec de vraies touches : le protocole DevTools ne passe pas par les
  // accélérateurs d'Electron (essayé avec xdotool dans le conteneur, fiche 145).
  await ui.click(ui.$('app-menu'))
  await ui.waitFor(`!!${content}`)
  await ui.click(ui.$('app-menu-menu-view'))
  await ui.waitFor(`!!${ui.$('app-menu-menu-view-content')}`)
  await ui.click(ui.$('app-menu-toggle-sidebar'))
  await ui.waitFor(`!${sidebarClosed}`)
  if (scheme === 'dark') await auroraNight(ui, content)
}

/** Capture du menu ☰ sur Aurore nuit (fiche 226), le thème essayé dans la VM. */
async function auroraNight(ui, content) {
  await ui.click(ui.$('open-settings'))
  await ui.click(ui.$('settings-appearance'))
  await ui.click(ui.$('theme-auroraNight'))
  await ui.waitFor(`document.documentElement.dataset.palette === 'auroraNight'`)
  await ui.key('Escape')
  await ui.waitFor(`!${ui.$('settings')}`)
  await ui.click(ui.$('app-menu'))
  await ui.waitFor(`!!${content}`)
  // Hors macOS, menu opaque et sans fondu, même sur le verre d'Aurore (fiche 145).
  const look = await ui.ev(`(() => {
    const style = getComputedStyle(${content})
    const channels = style.backgroundColor.match(/[\\d.]+/g) ?? []
    return {
      animation: style.animationName,
      background: style.backgroundColor,
      alpha: channels.length > 3 ? Number(channels[3]) : 1,
      blur: style.backdropFilter
    }
  })()`)
  check(
    look.animation === 'menu-in-opaque' && look.alpha === 1 && look.blur === 'none',
    `Aurore nuit : menu ☰ opaque, sans flou ni fondu (${JSON.stringify(look)})`
  )
  await ui.shot('app-menu-aurore-nuit')
  await ui.key('Escape')
  await ui.waitFor(`!${content}`)
  await ui.click(ui.$('open-settings'))
  await ui.click(ui.$('settings-appearance'))
  await ui.click(ui.$('theme-system'))
  await ui.key('Escape')
}
