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
 * session est rouverte à chaque changement. Fiche 287 : la fenêtre de choix s'ouvre à côté du
 * dossier de travail (son parent). Fiche 290 : un chemin saisi (refus avec sa raison, puis ajout),
 * un dossier glissé (vrai glisser-déposer de Chromium), plusieurs éléments refusés, le panneau le
 * plus étroit ; pendant un tour, champ et bouton disent pourquoi ils attendent, au clavier, et un
 * dépôt n'ajoute rien.
 */
export async function dossiersSuite(scheme) {
  console.log(`\n— Plusieurs dossiers par conversation (${scheme})`)
  const root = mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-'))
  const workspace = join(root, 'application')
  const library = join(root, 'bibliotheque')
  const server = join(root, 'serveur')
  mkdirSync(workspace)
  mkdirSync(library)
  mkdirSync(server)
  writeFileSync(join(root, 'notes-de-version-tres-longues-pour-voir-le-retour-a-la-ligne.txt'), 'x')
  // Fiche 290 : le dossier retenu est le dossier réel, liens suivis (sous macOS, le dossier
  // temporaire `/var/…` est un lien vers `/private/var/…`).
  const libraryReal = realpathSync.native(library)
  const serverReal = realpathSync.native(server)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-data-'))
  const turnLock = join(mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-verrou-')), 'verrou')
  const args = [`--inspect=${MAIN_PORT}`]
  const folders = (ui) =>
    ui.ev(
      `[...document.querySelectorAll('[data-testid=session-extra-folder] [data-folder]')].map((b) => b.dataset.folder).join()`
    )
  const count = (ui) =>
    ui.ev(`document.querySelectorAll('[data-testid=session-extra-folder]').length`)
  const field = (ui) => ui.$('session-folder-path')
  const noteOf = (ui) => ui.ev(`${ui.$('session-folder-note')}.textContent`)
  /** Tape un chemin dans le champ et l'envoie (Entrée). */
  const typePath = async (ui, text) => {
    await ui.ev(`${field(ui)}.focus(), true`)
    await ui.type(text)
    await ui.press('Enter')
  }
  const fieldCenter = (ui) =>
    ui.ev(
      `(() => { const b = ${field(ui)}.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`
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

        // Fiche 290 : un chemin relatif tapé est refusé avec sa raison ; le texte reste.
        await typePath(ui, 'bibliotheque')
        await ui.waitFor(`${ui.$('session-folder-note')}.dataset.reason === 'notAbsolute'`)
        check(
          (await noteOf(ui)) === L('sessionTab.folderRefusal.notAbsolute') &&
            (await ui.ev(`${field(ui)}.value`)) === 'bibliotheque' &&
            (await ui.ev(`${field(ui)}.getAttribute('aria-invalid')`)) === 'true' &&
            (await count(ui)) === 0,
          'chemin relatif tapé : refusé, la raison sous le champ, le texte gardé, rien d’ajouté'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-1b-refus')

        // Échap vide le champ ; le chemin complet (non résolu) est ajouté, dossier réel retenu.
        await ui.press('Escape')
        await typePath(ui, library)
        // La réponse du main arrive une fois la session repartie : la ligne « Ajouté » d'abord.
        await ui.waitFor(
          `${ui.$('session-folder-note')}.textContent === ${JSON.stringify(L('sessionTab.folderAdded'))}`
        )
        check(
          (await folders(ui)) === libraryReal &&
            (await ui.ev(`${ui.$('session-extra-folder')}.innerText`)).includes(
              basename(library)
            ) &&
            (await ui.ev(`${field(ui)}.value`)) === '',
          'chemin tapé : ajouté, listé par son nom (dossier réel), champ vidé (fiche 290)'
        )
        check(
          (await noteOf(ui)) === L('sessionTab.folderAdded'),
          `ajout : « ${L('sessionTab.folderAdded')} » sous le champ`
        )
        await ui.ready()
        await ui.send('Et maintenant ?')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(libraryReal),
          'session rouverte : l’agent a reçu le dossier ajouté (`additionalDirectories`)'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-2-apres')

        // Fiche 290 : un dossier glissé depuis le système (vrai glisser-déposer de Chromium).
        await ui.dragFiles([server], await fieldCenter(ui))
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=session-extra-folder]').length === 2`
        )
        check(
          (await folders(ui)) === `${libraryReal},${serverReal}`,
          'dossier glissé sur le champ : ajouté (dossier réel)'
        )
        await ui.ready()
        // Plusieurs éléments à la fois : refusés, rien d'ajouté.
        await ui.dragFiles([library, server], await fieldCenter(ui))
        await ui.waitFor(
          `${ui.$('session-folder-note')}.textContent === ${JSON.stringify(L('sessionTab.oneFolder'))}`
        )
        check((await count(ui)) === 2, 'plusieurs éléments glissés : « un seul dossier à la fois »')
        // Le dossier glissé est retiré (même comparaison que l'ajout).
        await ui.click(`document.querySelectorAll('[data-testid=session-remove-folder]')[1]`)
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=session-extra-folder]').length === 1`
        )
        await ui.ready()

        // Panneau le plus étroit (280 px) : un refus au long chemin passe à la ligne, rien ne déborde.
        const handle = await ui.ev(
          `(() => { const b = document.querySelector('.side-panel-resize').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + 200 } })()`
        )
        await ui.drag(handle, { x: handle.x + 400, y: handle.y })
        await ui.waitFor(`${ui.$('side-panel')}.getBoundingClientRect().width < 290`)
        await typePath(
          ui,
          join(root, 'notes-de-version-tres-longues-pour-voir-le-retour-a-la-ligne.txt')
        )
        await ui.waitFor(`${ui.$('session-folder-note')}.dataset.reason === 'notDirectory'`)
        const narrow = await ui.ev(`(() => {
          const box = ${ui.$('session-folder-field')}.getBoundingClientRect()
          const panel = ${ui.$('side-panel')}.getBoundingClientRect()
          const note = ${ui.$('session-folder-note')}
          return {
            field: Math.round(${field(ui)}.getBoundingClientRect().width),
            inside: box.right <= panel.right - 8,
            wraps: note.scrollWidth <= note.clientWidth + 1 && note.getBoundingClientRect().height > 20
          }
        })()`)
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-5-etroit')
        check(
          narrow.field >= 140 && narrow.inside && narrow.wraps,
          `panneau à 280 px : champ de ${narrow.field} px dans le panneau, refus passé à la ligne`
        )
        await ui.press('Escape')
        await ui.ev(
          `document.querySelector('.side-panel-resize').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`
        )
        await ui.waitFor(`${ui.$('side-panel')}.getBoundingClientRect().width > 300`)

        // Retiré : la session repart sans lui.
        await ui.click(ui.$('session-remove-folder'))
        await ui.waitFor(`!${ui.$('session-extra-folder')}`)
        await ui.ready()
        await ui.send('Et sans ?')
        await ui.ready()

        // Remis par la fenêtre du système (simulée) : elle rend `library` ; fiche 287 : elle
        // s'ouvre à côté du dossier de travail, pas sur Téléchargements (recette Bricole, 22:22).
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
        await ui.waitFor(`!!${ui.$('session-extra-folder')}`)
        const opened = await mainProcess()
        let start
        try {
          start = await opened.evaluate(`globalThis.__e2eOpenOptions?.defaultPath ?? null`)
        } finally {
          opened.close()
        }
        check(
          start === root || start === realpathSync(root),
          `« Choisir un dossier… » : la fenêtre s’ouvre sur le dossier parent du dossier de travail (${start})`
        )
        check((await folders(ui)) === libraryReal, 'fenêtre du système : dossier réel retenu')
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
        // Fiche 290 : le champ aussi, en lecture seule mais atteignable ; un dépôt n'ajoute rien.
        check(
          (await ui.ev(
            `${field(ui)}.readOnly && ${field(ui)}.getAttribute('aria-disabled') === 'true'`
          )) &&
            (await ui.ev(`${field(ui)}.getAttribute('aria-description')`)) ===
              L('sessionTab.foldersBusy'),
          'pendant un tour : champ en lecture seule, atteignable, la raison décrite'
        )
        await ui.dragFiles([server], await fieldCenter(ui))
        await sleep(300)
        check(
          (await count(ui)) === 1 &&
            !(await ui.ev(`${ui.$('session-folder-field')}.classList.contains('dropping')`)),
          'pendant un tour : dossier glissé sans effet, pas de zone de dépôt'
        )
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
