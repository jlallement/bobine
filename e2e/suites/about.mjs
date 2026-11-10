import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  L,
  LANG,
  MAIN_PORT,
  attachPage,
  check,
  mainProcess,
  root,
  sleep,
  withApp
} from '../lib.mjs'

const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const REPOSITORY = 'https://github.com/jlallement/bobine'

/**
 * Fenêtre « À propos de Bobine » (fiche 116) : ouverte par le menu de l'app (cliqué depuis le
 * main), une seule à la fois, attachée à la fenêtre principale ; rien de technique affiché ;
 * « Copier les infos techniques », liens et « Signaler un problème » (ouvertures observées en
 * remplaçant `shell.openExternal`), « Nouveautés » vers Réglages › À propos, Échap.
 */
export async function aboutSuite(scheme) {
  console.log(`\n— Fenêtre À propos (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const main = await mainProcess()
      const openAbout = () =>
        main.evaluate(
          `(require('electron').Menu.getApplicationMenu().getMenuItemById('about').click(), true)`
        )
      const windows = () =>
        main.evaluate(`require('electron').BrowserWindow.getAllWindows()
          .filter((w) => !w.isDestroyed() && w.webContents.getURL().includes('#about'))
          .map((w) => ({
            visible: w.isVisible(),
            child: !!w.getParentWindow(),
            resizable: w.isResizable(),
            minimizable: w.isMinimizable(),
            size: w.getSize().join('x')
          }))`)
      const opened = () => main.evaluate(`globalThis.__opened.splice(0)`)
      const saved = await main.evaluate(`require('electron').clipboard.readText()`)
      try {
        await main.evaluate(
          `(globalThis.__opened = [], require('electron').shell.openExternal = async (u) => { globalThis.__opened.push(u) }, true)`
        )
        await openAbout()
        const about = await attachPage('#about', scheme)
        try {
          await about.waitFor(`!!${about.$('about-version')}`)
          await openAbout()
          await sleep(300)
          const [win, ...others] = await windows()
          check(
            win?.visible &&
              win.child &&
              !win.resizable &&
              !win.minimizable &&
              win.size === '400x420' &&
              others.length === 0,
            `menu Bobine › À propos : une fenêtre de l’app, attachée, 400 × 420, non redimensionnable, une seule (${JSON.stringify(win)}, ${others.length} de plus)`
          )

          const info = await about.ev(`window.api.app.getInfo()`)
          const date = new Intl.DateTimeFormat(LANG, { dateStyle: 'long', timeZone: 'UTC' }).format(
            new Date(`${info.buildDate}T00:00:00Z`)
          )
          const shown = await about.ev(`${about.$('about')}.innerText`)
          const version = await about.ev(`${about.$('about-version')}.innerText`)
          check(
            version === L('aboutWindow.version', { version: VERSION, date }) &&
              shown.includes(L('settings.about.description')) &&
              shown.includes(L('aboutWindow.notAffiliated')) &&
              /^[0-9a-f]{7,}$/.test(info.commit),
            `nom, « ${version} », présentation, « projet indépendant » ; commit du build injecté (${info.commit})`
          )
          check(
            !/Electron|Chromium|darwin|arm64/.test(shown) && !shown.includes(info.commit),
            'aucune information technique affichée'
          )
          check(
            (await about.ev(`document.title`)) === L('menu.about', { app: 'Bobine' }),
            'titre de la fenêtre : « À propos de Bobine »'
          )
          await about.shot('o0-a-propos')

          // Copier les infos techniques : le bloc dans le presse-papiers, « Copié ».
          await about.click(about.$('about-copy'))
          await about.waitFor(`${about.$('about-copy')}.dataset.copied === 'true'`)
          const copied = await main.evaluate(`require('electron').clipboard.readText()`)
          check(
            copied.startsWith(
              `Bobine ${VERSION} (commit ${info.commit}, built ${info.buildDate})`
            ) &&
              /\nElectron \d/.test(copied) &&
              /\nChromium \d/.test(copied) &&
              /\nNode \d/.test(copied) &&
              /\nmacOS \d+(\.\d+)* \((arm64|x64)\)/.test(copied) &&
              copied.includes(`Interface language: ${LANG}`) &&
              copied.includes('\nAgents:\n- '),
            `« Copier les infos techniques » : version, commit, moteurs, macOS, langue, agents\n${copied}`
          )
          check(
            (await about.ev(`${about.$('about-copy')}.innerText`)).includes(
              L('aboutWindow.copied')
            ),
            '« Copié » affiché'
          )
          await about.shot('o1-a-propos-copie')
          await about.waitFor(`${about.$('about-copy')}.dataset.copied === 'false'`, 4000)
          check(true, '« Copié » s’efface au bout de deux secondes')

          // Liens : GitHub, licence, issue préremplie, dans le navigateur système.
          await about.click(about.$('about-github'))
          await about.click(about.$('about-license'))
          await about.click(about.$('about-report-issue'))
          await sleep(500)
          const [github, license, issue = ''] = await opened()
          check(
            github === REPOSITORY &&
              license === `${REPOSITORY}/blob/main/LICENSE` &&
              issue.startsWith(
                `${REPOSITORY}/issues/new?template=bug.yml&version=${VERSION}&report=`
              ) &&
              decodeURIComponent(issue.split('&report=')[1]).startsWith(`Bobine ${VERSION}`),
            `GitHub, licence et « Signaler un problème » ouverts dans le navigateur (${issue.slice(0, 120)}…)`
          )

          // Nouveautés : la fenêtre se ferme, Réglages › Nouveautés dans la fenêtre principale.
          // Comme Échap plus bas, le clic peut détruire sa cible avant sa réponse CDP. L'effet
          // est attendu dans la fenêtre principale, sans dépendre de l'accusé de la page fermée.
          void about.click(about.$('about-whats-new')).catch(() => {})
          await ui.waitFor(`!!${ui.$('settings-changelog')}`)
        } finally {
          about.close()
        }
        await ui.waitFor(`!!${ui.$('settings-changelog')}`)
        await sleep(300)
        check(
          (await windows()).length === 0 &&
            (await ui.ev(`document.querySelector('.settings-nav-item.active')?.innerText`)) ===
              L('settings.section.about'),
          '« Nouveautés » : fenêtre fermée, Réglages › Nouveautés ouverts'
        )
        await ui.shot('o2-nouveautes')
        await ui.key('Escape')

        // Échap la ferme.
        await openAbout()
        const again = await attachPage('#about', scheme)
        try {
          await again.waitFor(`!!${again.$('about-version')}`)
          // Fermée dès l'appui : le relâchement n'a plus de page pour répondre, on ne l'attend pas.
          void again.press('Escape')
          let left = 1
          for (let i = 0; i < 30 && left; i++) {
            await sleep(100)
            // Fenêtre en train de se fermer : le main peut ne rien rendre, on réessaie.
            left = (await windows())?.length ?? 1
          }
          check(left === 0, 'Échap : fenêtre fermée')
        } finally {
          again.close()
        }
      } finally {
        await main.evaluate(
          `require('electron').clipboard.writeText(${JSON.stringify(saved ?? '')}), true`
        )
        main.close()
      }
    },
    undefined,
    'demo',
    {},
    [`--inspect=${MAIN_PORT}`]
  )
}
