import { L, LANG, MAIN_PORT, check, withApp, mainProcess } from '../lib.mjs'
import { tokensOf } from '../palette.mjs'

/** Réglages, menu macOS et raccourcis, recherche ⌘K (fiche 027). Le menu est cliqué depuis le main. */
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
        // Deux conversations, pour la recherche et la navigation.
        await ui.send('Plan de migration Postgres')
        await ui.ready()
        await menu('new-conversation')
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.ready()
        await ui.send('Écran de connexion')
        await ui.ready()
        const active = () =>
          ui.ev(`document.querySelector('.history-item.active .label')?.innerText`)
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
        check(
          (await active())?.startsWith('Plan de migration'),
          '⌘K : recherche sans accents, Entrée ouvre'
        )

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
        check(await ui.ev(sidebarWidth(300)), 'barre latérale : 300 px par défaut')
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
        check(true, 'barre latérale : réglée à la poignée, 440 px au plus')
        await ui.shot('80b-barre-laterale-large')
        await ui.ev(`${handle}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
        await ui.waitFor(sidebarWidth(300))
        check(true, 'double-clic sur la poignée : 300 px')

        await menu('settings')
        await ui.waitFor(`!!${ui.$('settings')}`)
        // Trois groupes, quatorze onglets (fiches 136, 144 : la consommation est une page à part ;
        // fiche 182 : Mémoire ; fiche 223 : Rôles).
        check(
          (await ui.ev(
            `document.querySelectorAll('.settings-nav-item').length === 14 && document.querySelectorAll('.settings-nav-gap').length === 2`
          )) === true,
          'réglages : quatorze onglets en trois groupes'
        )
        await ui.shot('81-general')
        // Apparence (fiche 136) : sept thèmes en une rangée (Fjord, fiche 168), polices et tailles, aperçu.
        await ui.click(ui.$('settings-appearance'))
        await ui.waitFor(`!!${ui.$('appearance-preview')}`)
        await ui.shot('81-apparence')
        await ui.click(ui.$('theme-dark'))
        await ui.waitFor(`${ui.$('theme-dark')}.getAttribute('aria-checked') === 'true'`)
        check(
          (await main.evaluate(`require('electron').nativeTheme.themeSource`)) === 'dark',
          'mode « Sombre » appliqué à toute l’app (nativeTheme)'
        )
        // Le mode des essais est imposé à la page (`prefers-color-scheme`) : le thème de ce mode.
        const variant = scheme === 'dark' ? 'black' : 'sepia'
        await ui.click(ui.$(`theme-${variant}`))
        await ui.waitFor(`document.documentElement.dataset.palette === '${variant}'`)
        check(
          (await ui.ev(`${ui.$(`theme-${variant}`)}.getAttribute('aria-checked')`)) === 'true' &&
            !(await ui.ev(`!!${ui.$('accent-system')}`)),
          `thème ${variant} coché et appliqué ; plus d’accent « Comme le Mac »`
        )
        await ui.shot('81-apparence-variante')
        // Thème Fjord (fiche 168) : la variante de ce mode, cochée, posée et appliquée au fond.
        const fjord = scheme === 'dark' ? 'fjordNight' : 'fjord'
        await ui.click(ui.$(`theme-${fjord}`))
        await ui.waitFor(`document.documentElement.dataset.palette === '${fjord}'`)
        check(
          (await ui.ev(`${ui.$(`theme-${fjord}`)}.getAttribute('aria-checked')`)) === 'true' &&
            (await ui.ev(`getComputedStyle(document.body).getPropertyValue('--bg').trim()`)) ===
              tokensOf(fjord).bg,
          `thème ${fjord} coché et appliqué (fond ${tokensOf(fjord).bg})`
        )
        await ui.shot('81-apparence-fjord')
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
        check(true, 'apparence : police et taille du fil appliquées')
        await ui.click(ui.$('settings-terminal-size-more'))
        await ui.click(ui.$('settings-terminal-size-more'))
        await ui.waitFor(`${ui.$('settings-terminal-size')}.innerText === '13.5'`)
        await ui.ev(`${ui.$('settings-terminal-size')}.scrollIntoView({ block: 'end' }); true`)
        await ui.shot('83-apparence-code')

        // Confidentialité : navigateur intégré (fiche 072), cookies gardés par défaut, effaçables.
        await ui.click(ui.$('settings-privacy'))
        await ui.waitFor(`!!${ui.$('settings-browser-keep-cookies')}`)
        check(
          (await ui.ev(`${ui.$('settings-browser-keep-cookies')}.checked`)) === true,
          'navigateur : cookies gardés par défaut'
        )
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
        check(left === 0, 'navigateur : cookies plus gardés → ceux du disque effacés aussitôt')
        await ui.click(ui.$('settings-browser-keep-cookies'))
        await ui.waitFor(`${ui.$('settings-browser-keep-cookies')}.checked === true`)
        await ui.shot('81-confidentialite')

        // Notifications : rebond du Dock (fiche 101) activé par défaut, en retrait sous les
        // notifications, grisé quand elles sont coupées.
        await ui.click(ui.$('settings-notifications'))
        const bounce = ui.$('settings-dock-bounce')
        await ui.waitFor(`!!${bounce}`)
        check((await ui.ev(`${bounce}.checked`)) === true, 'rebond du Dock : activé par défaut')
        check(
          (await ui.ev(`${bounce}.closest('.settings-row').classList.contains('sub')`)) === true,
          'rebond du Dock : en retrait sous « Notifications »'
        )
        await ui.click(bounce)
        await ui.waitFor(`${bounce}.checked === false`)
        await ui.click(bounce)
        await ui.waitFor(`${bounce}.checked === true`)
        check(true, 'rebond du Dock : le réglage s’enregistre')
        await ui.shot('81-notifications')
        await ui.click(ui.$('settings-notifications-enabled'))
        await ui.waitFor(`${bounce}.disabled && ${bounce}.checked`)
        check(true, 'notifications coupées : rebond du Dock grisé, sa valeur gardée')
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
        check(
          (await ui.ev(`${ui.$('settings-max-live-less')}.disabled`)) === true,
          'conversations gardées actives : de 6 à 2, pas en dessous'
        )
        await ui.waitFor(`${statuses}.then((s) => s === 'ready,ready,stopped')`, 5000)
        check(true, 'conversations gardées actives baissées : la plus ancienne au repos en veille')
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
        // « Relire le PATH » n'est plus ici (fiche 133) : il reste dans Diagnostic.
        check(
          !(await ui.ev(`!!${ui.$('settings-reload-path')}`)),
          'réglages › agents : « Relire le PATH » n’est plus qu’au Diagnostic'
        )
        await ui.shot('84-agents')
        // Ce que Bobine sait faire avec l'agent (fiche 054) : annonce retenue + profil.
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        await ui.waitFor(`!!${ui.$('settings-agent-page')}`)
        const page = await ui.ev(`${ui.$('settings-agent-page')}.innerText`)
        check(
          page.includes('0.1.0') &&
            page.includes(L('settings.agents.capabilities.title')) &&
            page.includes(L('capabilities.reopen.label')) &&
            page.includes(L('settings.agents.capabilities.specific', { agent: mock })) &&
            page.includes(L('capabilities.license.label')) &&
            (await ui.ev(`${ui.$('settings-heading')}.innerText`)) === mock,
          'page de l’agent : version, ce qu’il annonce, ce qui lui est propre'
        )
        await ui.shot('84-agent-page')
        await ui.ev(`${ui.$('agent-specific')}.scrollIntoView({ block: 'end' }); true`)
        await ui.shot('84-agents-propre')
        await ui.click(ui.$('settings-agent-back'))
        await ui.waitFor(`!${ui.$('settings-agent-page')} && !!${ui.$('settings-agent-list')}`)
        check(true, 'page de l’agent : « ‹ Agents » ramène à la liste')
        await ui.click(ui.$('settings-shortcuts'))
        await ui.waitFor(`!!${ui.$('settings-shortcuts-table')}`)
        const table = await ui.ev(`${ui.$('settings-shortcuts-table')}.innerText`)
        check(
          table.includes(L('shortcuts.menu.new-conversation')) &&
            table.includes('⌘N') &&
            table.includes('⌃`'),
          'réglages : apparence, agents, liste des raccourcis'
        )
        await ui.shot('82-raccourcis')
        // Nouveautés (fiches 133, 136, essai à la souris du 24/10) : l'app, puis une ligne par
        // version, la plus récente ouverte.
        await ui.click(ui.$('settings-about'))
        await ui.waitFor(`!!${ui.$('settings-changelog')}`)
        await ui.waitFor(`!!document.querySelector('.settings-about-version')`)
        check(
          await ui.ev(`(() => {
            const open = [...document.querySelectorAll('.settings-version')].map((d) => d.open)
            return !!${ui.$('app-icon')} && open.length > 3 && open[0] && !open.slice(1).some(Boolean) &&
              ${ui.$('settings-heading')}.innerText === ${JSON.stringify(L('settings.section.about'))}
          })()`),
          'réglages › nouveautés : icône et version, versions repliées sauf la plus récente'
        )
        await ui.shot('85-a-propos')

        // Recherche dans les réglages (fiche 051) : ⌘F, résultats, Entrée, réglage mis en avant.
        await ui.press('f', 4)
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
        check(true, 'recherche dans les réglages : ⌘F, « veille », Entrée → réglage mis en avant')
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
        check(true, 'recherche : une fonction propre à l’agent trouvée, sa page ouverte')
        // Un réglage d'« Avancé » : déplié pour le montrer (fiche 136).
        await ui.ev(`${ui.$('settings-search')}.focus(); true`)
        await ui.type(L('settings.network.proxy.label'))
        await ui.waitFor(`document.querySelectorAll('[data-testid=settings-result]').length >= 1`)
        await ui.enter()
        await ui.waitFor(
          `${ui.$('settings-agents-advanced')}?.open === true && !!document.querySelector('.settings-flash')`
        )
        check(true, 'recherche : un réglage d’« Avancé » déplié et mis en avant')
        // « Sans serif » / « Serif » (fiche 128) : l'ancien mot « empattements » trouve encore la police.
        if (LANG !== 'en') {
          await ui.ev(`${ui.$('settings-search')}.focus(); true`)
          await ui.type('empattements')
          await ui.waitFor(
            `[...document.querySelectorAll('[data-testid=settings-result]')].some((r) => r.innerText.includes(${JSON.stringify(L('settings.appearance.conversationFont.label'))}))`
          )
          check(true, 'recherche : « empattements » trouve encore la police des réponses')
        }
        await ui.ev(`${ui.$('settings-search')}.focus(); true`)
        await ui.type('rien de tel')
        await ui.waitFor(`!!${ui.$('settings-no-result')}`)
        await ui.press('Escape')
        await ui.waitFor(`${ui.$('settings-search')}.value === '' && !!${ui.$('settings')}`)
        check(true, 'Échap vide d’abord la recherche, les réglages restent ouverts')
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
        const saved = JSON.parse(
          await main.evaluate(
            `require('node:fs').readFileSync(require('electron').app.getPath('userData') + '/settings.json', 'utf8')`
          )
        )
        check(
          saved.theme === 'system' &&
            saved.terminalFontSize === 13.5 &&
            saved.conversationFont === 'serif' &&
            saved.conversationFontSize === 14 &&
            saved.maxLive === 6,
          'réglages enregistrés'
        )
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
