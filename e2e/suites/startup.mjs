import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Démarrage (fiche 093) : premier lancement sans dossier (aucun agent avant le choix), dossier
 * choisi par le dialogue (simulé), fenêtre retrouvée et ramenée sur un écran visible, menu Fenêtre.
 */
export async function startupSuite(scheme) {
  console.log(`\n— Démarrage (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-demarrage-'))
  const project = mkdtempSync(join(tmpdir(), 'bob-e2e-projet-'))
  const settingsFile = join(userData, 'settings.json')
  const settings = () => JSON.parse(readFileSync(settingsFile, 'utf8'))
  // Premier lancement réel, même en essai : pas de dossier par défaut.
  const env = { BOBINE_DEFAULT_WORKSPACE: '' }
  const args = [`--inspect=${MAIN_PORT}`]
  const mainWindow = `require('electron').BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('#quick'))`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(`!!${ui.$('blocker-workspace')}`)
        const card = await ui.ev(`${ui.$('blocker-workspace')}.innerText`)
        check(
          card.includes(L('blocker.workspace.title')) &&
            card.includes(L('blocker.workspace.subtitle')) &&
            card.includes(L('blocker.workspace.choose')),
          'premier lancement : « Choisissez le dossier de votre projet », un bouton pour le choisir'
        )
        check(
          await ui.ev(
            `${ui.$('composer-input')}.disabled && ${ui.$('composer-input')}.placeholder === ${JSON.stringify(L('composer.placeholder.needsFolder'))}`
          ),
          'zone de saisie inactive : « Choisissez d’abord un dossier »'
        )
        check(
          (await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)) === L('workspaceMenu.none') &&
            (await ui.ev(`!${ui.$('agent-menu')}.disabled`)),
          'puce du dossier « Choisir un dossier » ; l’agent reste au choix'
        )
        check(
          (await ui.ev(`${ui.$('agent-status')}?.innerText`)) ===
            L('sidebar.status.needs-action') &&
            !(await ui.ev(`!!document.querySelector('.status-dot.ready')`)),
          'aucun agent démarré avant le choix du dossier'
        )
        await ui.shot('44-premier-lancement')

        const main = await mainProcess()
        try {
          const windowMenu = await main.evaluate(`(() => {
            const menu = require('electron').Menu.getApplicationMenu()
            const window = menu.items.find((i) => i.label === ${JSON.stringify(L('menu.window'))})
            return window.submenu.items.filter((i) => i.type !== 'separator').map((i) => i.label)
          })()`)
          check(
            JSON.stringify(windowMenu) ===
              JSON.stringify([
                L('shortcuts.menu.activity'),
                L('menu.minimize'),
                L('menu.zoom'),
                L('menu.front')
              ]),
            `menu Fenêtre traduit : ${windowMenu?.join(', ')}`
          )
          // Dialogue natif simulé : il rend le dossier du projet.
          await main.evaluate(`(() => {
            require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(project)}] })
            ${mainWindow}.setBounds({ x: 120, y: 90, width: 1100, height: 760 })
            return true
          })()`)
        } finally {
          main.close()
        }
        await ui.click(ui.$('choose-workspace'))
        await ui.ready()
        check(
          (await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)) === basename(project) &&
            !(await ui.ev(`!!${ui.$('blocker-workspace')}`)),
          'dossier choisi : l’agent y démarre'
        )
        check(
          JSON.stringify(settings().recentWorkspaces) === JSON.stringify([project]),
          `dossiers récents : seulement celui choisi (${settings().recentWorkspaces})`
        )
        await ui.shot('45-dossier-choisi')
      },
      userData,
      'demo',
      env,
      args
    )

    const restored = settings().window
    check(
      restored?.x === 120 && restored?.width === 1100 && restored?.height === 760,
      `fenêtre enregistrée en quittant : ${JSON.stringify(restored)}`
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        check(
          (await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)) === basename(project),
          'relance : le dossier choisi est repris, l’agent démarre'
        )
        const main = await mainProcess()
        try {
          const bounds = await main.evaluate(`${mainWindow}.getBounds()`)
          check(
            bounds?.x === 120 && bounds?.width === 1100 && bounds?.height === 760,
            `relance : fenêtre à sa place (${JSON.stringify(bounds)})`
          )
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      env,
      args
    )

    // Écran débranché depuis : la fenêtre, agrandie, revient sur l'écran principal.
    writeFileSync(
      settingsFile,
      JSON.stringify({
        ...settings(),
        window: { x: 40000, y: 300, width: 1000, height: 700, maximized: true }
      })
    )
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const main = await mainProcess()
        try {
          const state = await main.evaluate(`(() => {
            const { screen } = require('electron')
            const win = ${mainWindow}
            const normal = win.getNormalBounds()
            const area = screen.getPrimaryDisplay().workArea
            const inside = normal.x >= area.x && normal.x + normal.width <= area.x + area.width
            return { maximized: win.isMaximized(), inside, normal }
          })()`)
          check(
            state?.maximized && state?.inside,
            `écran disparu : fenêtre ramenée sur l’écran principal, agrandie (${JSON.stringify(state)})`
          )
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      env,
      args
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(project, { recursive: true, force: true })
  }
}
