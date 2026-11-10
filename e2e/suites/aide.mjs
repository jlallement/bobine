import { L, LANG, MAIN_PORT, attachPage, check, mainProcess, sleep, withApp } from '../lib.mjs'

/**
 * Aide intégrée (fiche 186) : fenêtre à part ouverte par Aide › Aide de Bobine (⌘?), posée à
 * côté de la fenêtre principale, une seule ; sommaire, page dans la langue de l'interface, images
 * du guide ; recherche pendant la frappe au clavier seul ; lien « ? » d'un écran qui mène à la
 * bonne section ; liens externes vers le navigateur du système (observés).
 */
export async function helpSuite(scheme) {
  console.log(`\n— Aide intégrée (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const main = await mainProcess()
      const menuHelp = () =>
        main.evaluate(
          `(require('electron').Menu.getApplicationMenu().getMenuItemById('help').click(), true)`
        )
      const windows = () =>
        main.evaluate(`require('electron').BrowserWindow.getAllWindows()
          .filter((w) => !w.isDestroyed() && w.webContents.getURL().includes('#help'))
          .map((w) => ({ bounds: w.getBounds(), modal: w.isModal(), parent: !!w.getParentWindow() }))`)
      try {
        await main.evaluate(
          `(globalThis.__opened = [], require('electron').shell.openExternal = async (u) => { globalThis.__opened.push(u) }, true)`
        )
        const mainBounds = await main.evaluate(
          `require('electron').BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.isVisible() && !w.webContents.getURL().includes('#')).getBounds()`
        )
        await menuHelp()
        const help = await attachPage('#help', scheme)
        try {
          await help.waitFor(`!!${help.$('help-toc')}?.querySelector('button')`)
          await menuHelp()
          await sleep(300)
          const [win, ...others] = await windows()
          const right = mainBounds.x + mainBounds.width
          check(
            win &&
              !win.modal &&
              !win.parent &&
              others.length === 0 &&
              win.bounds.x >= right - win.bounds.width,
            `menu Aide › ${L('shortcuts.menu.help')} : une fenêtre à part, non modale, à droite de la principale, une seule (${JSON.stringify(win)})`
          )
          check(
            (await help.ev(`document.title`)) === L('help.title') &&
              (await help.ev(`document.activeElement === ${help.$('help-search')}`)),
            `titre « ${L('help.title')} », curseur dans la recherche (⌘?)`
          )
          const home = await help.ev(`${help.$('help-page')}.innerText`)
          check(
            home.includes(LANG === 'fr' ? 'Guide de Bobine' : 'Bobine guide') ||
              home.includes(LANG === 'fr' ? 'Commencer' : 'Getting started'),
            `accueil du guide dans la langue de l’interface (${LANG})`
          )
          await help.shot('aide-0-accueil')

          check(
            !home.includes('README.md') && (LANG !== 'fr' || !/ [:;?!]/.test(home)),
            'accueil : pas de lien brut vers l’autre langue ; espaces insécables avant « : ; ? ! »'
          )

          // Une page avec une image du guide, embarquée.
          await help.click(help.$('help-toc-premiers-pas'))
          await help.waitFor(
            `${help.$('help-page')}.dataset.page === 'premiers-pas' && [...document.querySelectorAll('.help-markdown img')].some((i) => i.complete && i.naturalWidth > 0)`
          )
          check(true, 'page « Premiers pas » : image du guide chargée')

          // Recherche au clavier seul : frappe ; le résultat choisi est affiché, défilé au premier
          // mot surligné ; ↓ en change ; ↩ ouvre ; Échap efface. L'accueil n'est pas un résultat.
          await help.click(help.$('help-search'))
          await help.type('worktree')
          await help.waitFor(`document.querySelectorAll('[data-testid="help-result"]').length > 1`)
          const marked = await help.ev(
            `document.querySelector('[data-testid="help-result"] mark')?.textContent.toLowerCase()`
          )
          const pages = await help.ev(
            `[...document.querySelectorAll('[data-testid="help-result"]')].map((r) => r.dataset.page)`
          )
          check(
            marked === 'worktree' && !pages.includes('README'),
            `résultats pendant la frappe, mot souligné, sans l’accueil (${pages.join(', ')})`
          )
          const highlighted = () =>
            help.ev(`(() => {
              const h = CSS.highlights.get('help-search')
              if (!h || h.size === 0) return null
              const body = ${help.$('help-page')}.getBoundingClientRect()
              const visible = [...h].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= body.top && b.bottom <= body.bottom })
              return { page: ${help.$('help-page')}.dataset.page, size: h.size, visible: visible.length }
            })()`)
          await help.waitFor(`${help.$('help-page')}.dataset.page === ${JSON.stringify(pages[0])}`)
          const first = await highlighted()
          check(
            first?.page === pages[0] && first.visible > 0,
            `le premier résultat est affiché, mot surligné à l’écran (${JSON.stringify(first)})`
          )
          await help.shot('aide-1-recherche')
          const other = pages.findIndex((p) => p !== pages[0])
          if (other < 0) throw new Error(`une seule page dans les résultats : ${pages}`)
          for (let i = 0; i < other; i++) await help.press('ArrowDown')
          await help.waitFor(
            `${help.$('help-page')}.dataset.page === ${JSON.stringify(pages[other])}`
          )
          const second = await highlighted()
          check(
            second?.page === pages[other] && second.visible > 0,
            `↓ change le résultat ET la page, défilée au mot surligné (${JSON.stringify(second)})`
          )
          await help.shot('aide-1b-recherche-suivant')
          await help.press('Enter')
          await help.press('Escape')
          await help.waitFor(`!!${help.$('help-toc')} && ${help.$('help-search')}.value === ''`)
          check(
            (await help.ev(`${help.$('help-page')}.dataset.page`)) === pages[other],
            '↩ ouvre la section ; Échap efface la recherche, le sommaire revient'
          )

          // L'accueil répond par ses notes (« Voir aussi » : les astuces), pas par son sommaire.
          await help.click(help.$('help-search'))
          await help.type(LANG === 'fr' ? 'astuces' : 'tips')
          await help.waitFor(`document.querySelectorAll('[data-testid="help-result"]').length > 0`)
          const tips = await help.ev(
            `[...document.querySelectorAll('[data-testid="help-result"]')].map((r) => r.dataset.page)`
          )
          await help.waitFor(`${help.$('help-page')}.dataset.page === 'README'`)
          const tipsMark = await highlighted()
          check(
            tips.includes('README') && tipsMark?.page === 'README' && tipsMark.visible > 0,
            `« astuces » trouve l’accueil, mot surligné à l’écran (${tips.join(', ')})`
          )
          await help.shot('aide-1c-recherche-accueil')
          await help.press('Escape')
          await help.waitFor(`${help.$('help-search')}.value === ''`)

          // Bloc de code : style du fil et bouton Copier (page Premiers pas).
          await help.click(help.$('help-toc-premiers-pas'))
          await help.waitFor(`${help.$('help-page')}.dataset.page === 'premiers-pas'`)
          check(
            await help.ev(
              `!!document.querySelector('.help-markdown .code-block [data-testid="copy-code"]')`
            ),
            'blocs de code avec « Copier »'
          )

          // Lien externe d'une page : dans le navigateur du système.
          await help.ev(
            `(document.querySelector('.help-crumb-link') ?? document.body).click(), true`
          )
          await help.waitFor(`${help.$('help-page')}.dataset.page === 'README'`)
          await help.ev(
            `[...document.querySelectorAll('.help-markdown a[target="_blank"]')].find((a) => a.href.includes('installation'))?.click(), true`
          )
          await sleep(500)
          const opened = await main.evaluate(`globalThis.__opened.splice(0)`)
          check(
            opened.length === 1 &&
              opened[0].startsWith(
                'https://github.com/jlallement/bobine/blob/main/docs/installation.md'
              ),
            `lien hors du guide ouvert dans le navigateur du système (${opened})`
          )

          // Lien « ? » d'un écran : Réglages › Confidentialité → la bonne section.
          await main.evaluate(
            `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
          )
          await ui.waitFor(`!!${ui.$('settings-privacy')}`)
          await ui.click(ui.$('settings-privacy'))
          await ui.waitFor(`!!${ui.$('help-link-settingsPrivacy')}`)
          await ui.shot('aide-2-lien-reglages')
          await ui.click(ui.$('help-link-settingsPrivacy'))
          await help.waitFor(`${help.$('help-page')}.dataset.page === 'reglages'`)
          await help.waitFor(
            `(() => { const h = document.getElementById('autorisations'); const b = ${help.$('help-page')}.getBoundingClientRect(); return !!h && Math.abs(h.getBoundingClientRect().top - b.top) < 60 })()`
          )
          check(
            (await windows()).length === 1,
            '« ? » des Réglages : la même fenêtre d’aide, à la section « autorisations »'
          )
          await help.shot('aide-3-section')

          // « ? » de Réglages › Mémoire → la page de la mémoire commune.
          await ui.click(
            `[...document.querySelectorAll('.settings-nav-item')].find((b) => b.innerText.trim() === ${JSON.stringify(L('settings.section.memory'))})`
          )
          await ui.waitFor(`!!${ui.$('help-link-memory')}`)
          await ui.click(ui.$('help-link-memory'))
          await help.waitFor(`${help.$('help-page')}.dataset.page === 'memoire'`)
          // Seule l'ancre visée ressort ; jamais un titre de la page d'avant (« autorisations »).
          const flashed = await help.ev(
            `[...document.querySelectorAll('.help-markdown .settings-flash')].map((e) => e.id)`
          )
          check(
            flashed.every((id) => id === 'reglages'),
            `seule la section visée ressort (${JSON.stringify(flashed)})`
          )
          check(
            (await windows()).length === 1,
            '« ? » de Réglages › Mémoire : page « Mémoire commune »'
          )
          await help.shot('aide-4-memoire')
        } finally {
          help.close()
        }
      } finally {
        main.close()
      }
    },
    undefined,
    'demo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
