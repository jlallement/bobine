import { L, MAIN_PORT, NEUTRAL_AGENT_ENV, check, mainProcess, withApp } from '../lib.mjs'
import { formatKeys } from '../../src/shared/shortcuts.ts'

/**
 * Capacités de la plateforme (fiche 145) : la même app, lancée avec les capacités du Mac puis avec
 * celles de Linux (`BOBINE_PLATFORM`), montre ou masque ce qui n'existe que sur macOS : onglet du
 * simulateur dans le « + » du panneau, capture d'écran de la zone de saisie, groupe iOS du
 * Diagnostic ; forme du menu, cadre de la fenêtre, notation des raccourcis (lot 2). Sur le Mac, les deux ; sous Linux, Linux seulement : les capacités du Mac y
 * appelleraient des fonctions d'Electron propres à macOS (`getMediaAccessStatus`).
 */
export async function platformSuite() {
  console.log('\n— Capacités de la plateforme')
  for (const platform of process.platform === 'darwin' ? ['darwin', 'linux'] : ['linux']) {
    const mac = platform === 'darwin'
    await withApp(
      'light',
      async (ui) => {
        await ui.ready()
        // Menu, cadre de fenêtre, raccourcis et barres de défilement de la plateforme (lot 2).
        const main = await mainProcess()
        try {
          const shape = await main.evaluate(`(() => {
            const { BrowserWindow, Menu } = require('electron')
            const win = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('#'))
            return {
              top: Menu.getApplicationMenu().items.length,
              window: Menu.getApplicationMenu().items.some((i) => String(i.role).toLowerCase() === 'windowmenu'),
              bar: win.isMenuBarVisible(),
              labels: Menu.getApplicationMenu().items.map((i) => i.label),
              appRoles: Menu.getApplicationMenu().items[0].submenu.items.map((i) => i.role).filter(Boolean),
              lights: win.getWindowButtonPosition?.() ?? null
            }
          })()`)
          check(
            mac
              ? shape.top === 7 &&
                  shape.window &&
                  // Barre du système du Mac à l'identique : menu « Bobine » et ses rôles, feux.
                  JSON.stringify(shape.labels) ===
                    JSON.stringify([
                      'Bobine',
                      ...['file', 'edit', 'view', 'conversation', 'window', 'help'].map((m) =>
                        L(`menu.${m}`)
                      )
                    ]) &&
                  JSON.stringify(shape.appRoles.map((r) => r.toLowerCase())) ===
                    JSON.stringify(['services', 'hide', 'hideothers', 'unhide', 'quit']) &&
                  (process.platform !== 'darwin' ||
                    JSON.stringify(shape.lights) === JSON.stringify({ x: 18, y: 19 }))
              : shape.top === 5 &&
                  !shape.window &&
                  // Barre d'Electron jamais montrée (fiche 145, variante D) : vue sous Linux ;
                  // macOS n'a pas de barre dans la fenêtre (toujours « visible » pour Electron).
                  (!shape.bar || process.platform === 'darwin'),
            `${platform} : menu ${mac ? 'de macOS' : 'Linux, sans barre'} (${JSON.stringify(shape)})`
          )
        } finally {
          main.close()
        }
        const page = await ui.ev(`({
          appMenu: !!document.querySelector('[data-testid=app-menu]'),
          activity: document.querySelector('.sidebar-kbd')?.innerText,
          frame: document.documentElement.classList.contains('native-frame'),
          scrollbars: document.documentElement.classList.contains('classic-scrollbars'),
          noGlass: document.documentElement.classList.contains('no-glass'),
          lights: getComputedStyle(document.querySelector('.sidebar-header')).paddingLeft
        })`)
        const names = { ctrl: L('keys.ctrl'), alt: L('keys.alt'), shift: L('keys.shift') }
        check(
          page.activity === formatKeys('⇧⌘U', mac ? null : names) &&
            page.appMenu === !mac &&
            page.frame === !mac &&
            page.scrollbars === !mac &&
            page.noGlass === !mac &&
            page.lights === (mac ? '84px' : '10px'),
          `${platform} : raccourcis ${page.activity}, ${mac ? 'feux de macOS' : 'cadre du système, ☰, barres fines'} (${JSON.stringify(page)})`
        )
        check(
          (await ui.ev(`!!${ui.$('capture')}`)) === mac,
          `${platform} : capture d’écran ${mac ? 'proposée' : 'masquée'} dans la zone de saisie`
        )

        await ui.click(ui.$('panel-toggle'))
        await ui.waitFor(`!!${ui.$('side-panel')}`)
        await ui.click(ui.$('panel-more'))
        await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
        const tabs = await ui.ev(
          `[...${ui.$('panel-more-menu')}.querySelectorAll('[data-tab]')].map((i) => i.dataset.tab).join(' ')`
        )
        check(
          tabs.split(' ').includes('simulator') === mac && tabs.split(' ').includes('browser'),
          `${platform} : simulateur iOS ${mac ? 'proposé' : 'absent'} dans le « + » du panneau (${tabs})`
        )
        await ui.key('Escape')

        await ui.click(ui.$('open-settings'))
        await ui.click(ui.$('settings-diagnostics'))
        await ui.waitFor(
          `!!${ui.$('diagnostics')} && !document.querySelector('[data-testid=diag-check][data-level=pending]')`,
          30_000
        )
        const groups = await ui.ev(
          `[...document.querySelectorAll('[data-testid^=diag-group-]')].map((g) => g.dataset.testid.slice(11)).join(' ')`
        )
        check(
          groups.split(' ').includes('ios') === mac && groups.split(' ').includes('android'),
          `${platform} : groupe iOS du Diagnostic ${mac ? 'présent' : 'absent'} (${groups})`
        )
      },
      undefined,
      'demo',
      { ...NEUTRAL_AGENT_ENV, BOBINE_PLATFORM: platform },
      [`--inspect=${MAIN_PORT}`]
    )
  }
}
