import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'

/**
 * Plusieurs dossiers par conversation (fiche 179) : un agent qui annonce `additionalDirectories`
 * (agent factice `--dossiers-en-plus`) reçoit les dossiers ajoutés dans l'onglet Session ; la
 * session est rouverte à chaque changement. Puis le même historique avec un agent qui ne l'annonce
 * pas (comme Bob) : dossiers gardés, grisés, « non transmis », pas d'ajout. Fiche 287 : la fenêtre
 * de choix s'ouvre à côté du dossier de travail (son parent) ; pendant un tour, « Ajouter un
 * dossier… » dit pourquoi il attend, au clavier.
 */
export async function dossiersSuite(scheme) {
  console.log(`\n— Plusieurs dossiers par conversation (${scheme})`)
  const root = mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-'))
  const workspace = join(root, 'application')
  const library = join(root, 'bibliotheque')
  mkdirSync(workspace)
  mkdirSync(library)
  // Fiche 290 : le dossier retenu est le dossier réel, liens suivis (sous macOS, le dossier
  // temporaire `/var/…` est un lien vers `/private/var/…`) ; la fenêtre simulée rend `library`.
  const libraryReal = realpathSync.native(library)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-data-'))
  const turnLock = join(mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-verrou-')), 'verrou')
  const args = [`--inspect=${MAIN_PORT}`]
  const folders = (ui) =>
    ui.ev(
      `[...document.querySelectorAll('[data-testid=session-extra-folder] [data-folder]')].map((b) => b.dataset.folder).join()`
    )
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Quels dossiers ?')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('session-folders')}`)
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-1-avant')

        // Dialogue natif simulé : il rend le dossier de la bibliothèque.
        const main = await mainProcess()
        try {
          await main.evaluate(`(() => {
            require('electron').dialog.showOpenDialog = async (...args) => {
              globalThis.__e2eOpenOptions = args.at(-1)
              return { canceled: false, filePaths: [${JSON.stringify(library)}] }
            }
            return true
          })()`)
        } finally {
          main.close()
        }
        await ui.click(ui.$('session-add-folder'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=session-extra-folder] [data-folder]')].length === 1`
        )
        // Fiche 287 : à côté du dossier de travail, pas sur Téléchargements (recette Bricole, 22:22).
        const opened = await mainProcess()
        let start
        try {
          start = await opened.evaluate(`globalThis.__e2eOpenOptions?.defaultPath ?? null`)
        } finally {
          opened.close()
        }
        check(
          start === root || start === realpathSync(root),
          `« Ajouter un dossier… » : la fenêtre s’ouvre sur le dossier parent du dossier de travail (${start})`
        )
        await ui.ready()
        check(
          (await folders(ui)) === libraryReal &&
            (await ui.ev(`${ui.$('session-extra-folder')}.innerText`)).includes(basename(library)),
          'dossier ajouté : listé sous le dossier de travail, par son nom (dossier réel, fiche 290)'
        )
        await ui.send('Et maintenant ?')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(libraryReal),
          'session rouverte : l’agent a reçu le dossier ajouté (`additionalDirectories`)'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-2-apres')
        await ui.send('Encore ?')
        await ui.ready()

        // Retiré : la session repart sans lui.
        await ui.click(ui.$('session-remove-folder'))
        await ui.waitFor(`!${ui.$('session-extra-folder')}`)
        await ui.ready()
        await ui.send('Et sans ?')
        await ui.ready()

        // Remis pour la suite : la conversation le garde.
        await ui.click(ui.$('session-add-folder'))
        await ui.waitFor(`!!${ui.$('session-extra-folder')}`)
        await ui.ready()

        // Fiche 287 (recette Bricole, 21:12) : pendant un tour, « Ajouter un dossier… » attend la
        // fin de la réponse et le dit, au survol et au clavier (plus un bouton muet).
        const retained = () =>
          existsSync(`${turnLock}.retenus`)
            ? readFileSync(`${turnLock}.retenus`, 'utf8').split('\n').filter(Boolean).length
            : 0
        const held = retained()
        writeFileSync(turnLock, '')
        await ui.send('Pendant le tour ?')
        for (let i = 0; retained() <= held && i < 600; i++) await sleep(50)
        const add = ui.$('session-add-folder')
        await ui.waitFor(`${add}?.getAttribute('aria-disabled') === 'true'`, 15000).catch(() => {})
        await ui.ev(`${add}.focus(), true`)
        await ui.press('Tab', 8)
        await ui.press('Tab')
        const tip = await ui
          .waitFor(`!!document.querySelector('[role=tooltip]')`, 5000)
          .then(() => ui.ev(`document.querySelector('[role=tooltip]').textContent`))
          .catch(() => null)
        await ui.shot('dossiers-4-pendant-tour')
        check(
          tip === L('sessionTab.foldersBusy') && (await ui.ev(`document.activeElement === ${add}`)),
          `pendant un tour : « Ajouter un dossier… » dit pourquoi, au clavier (« ${tip} »)`
        )
        rmSync(turnLock)
        await ui.ready()
      },
      userData,
      'dossiers',
      {
        BOBINE_WORKSPACE: workspace,
        MOCK_AGENT_DIRECTORIES: '1',
        MOCK_AGENT_TURN_LOCK: turnLock
      },
      args
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(turnLock), { recursive: true, force: true })
  }
}
