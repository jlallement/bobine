import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { L, LANG, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/** Réponses de l'agent factice (il parle la langue des essais, fiche 167 ; l'app ne traduit pas). */
const NONE = LANG === 'en' ? 'No other folder received.' : 'Aucun autre dossier reçu.'
const NO_LINE =
  LANG === 'en'
    ? 'No line about folders in this message.'
    : 'Pas de ligne sur les dossiers dans ce message.'
/** Ligne de contexte de l'app (en anglais, pour l'agent : ADR-0014), fiche 179 D13. */
const LINE = 'Additional working directories for this conversation:'

/**
 * Plusieurs dossiers par conversation (fiche 179) : un agent qui annonce `additionalDirectories`
 * (agent factice `--dossiers-en-plus`) reçoit les dossiers ajoutés dans l'onglet Session ; la
 * session est rouverte à chaque changement. Puis le même historique avec un agent qui ne l'annonce
 * pas (comme Bob) : dossiers gardés, grisés, « non transmis », pas d'ajout.
 */
export async function dossiersSuite(scheme) {
  console.log(`\n— Plusieurs dossiers par conversation (${scheme})`)
  const root = mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-'))
  const workspace = join(root, 'application')
  const library = join(root, 'bibliotheque')
  mkdirSync(workspace)
  mkdirSync(library)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-dossiers-data-'))
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
        check(
          (await ui.lastAgentText()).includes(NONE) &&
            (await ui.lastAgentText()).includes(NO_LINE) &&
            (await ui.ev(`!!${ui.$('session-add-folder')}`)) &&
            (await folders(ui)) === '',
          'agent qui prend d’autres dossiers : « Ajouter un dossier… », aucun dossier pour l’instant'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-1-avant')

        // Dialogue natif simulé : il rend le dossier de la bibliothèque.
        const main = await mainProcess()
        try {
          await main.evaluate(`(() => {
            require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(library)}] })
            return true
          })()`)
        } finally {
          main.close()
        }
        await ui.click(ui.$('session-add-folder'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=session-extra-folder] [data-folder]')].length === 1`
        )
        await ui.ready()
        check(
          (await folders(ui)) === library &&
            (await ui.ev(`${ui.$('session-extra-folder')}.innerText`)).includes(basename(library)),
          'dossier ajouté : listé sous le dossier de travail, par son nom'
        )
        await ui.send('Et maintenant ?')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(library),
          'session rouverte : l’agent a reçu le dossier ajouté (`additionalDirectories`)'
        )
        check(
          (await ui.lastAgentText()).includes(`${LINE} ${library}`),
          'le message dit à l’agent l’autre dossier (ligne de contexte, D13)'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-2-apres')
        await ui.send('Encore ?')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(NO_LINE),
          'liste inchangée : pas de ligne au message suivant'
        )

        // Retiré : la session repart sans lui.
        await ui.click(ui.$('session-remove-folder'))
        await ui.waitFor(`!${ui.$('session-extra-folder')}`)
        await ui.ready()
        await ui.send('Et sans ?')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(NONE) &&
            (await ui.lastAgentText()).includes(`${LINE} none (removed ${library})`),
          'dossier retiré : l’agent ne le reçoit plus, et le message le lui dit'
        )

        // Remis pour la suite : la conversation le garde.
        await ui.click(ui.$('session-add-folder'))
        await ui.waitFor(`!!${ui.$('session-extra-folder')}`)
        await ui.ready()
      },
      userData,
      'dossiers',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_DIRECTORIES: '1' },
      args
    )

    // Même historique, agent qui n'annonce pas la capacité (comme Bob 2.0.9).
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(`document.querySelector('[data-testid=history-item] .history-open')`)
        await ui.ready()
        // Conversation rouverte : le panneau s'ouvre de lui-même sur « Session » (fiche 166).
        await ui.waitFor(`!!${ui.$('session-folders')}`)
        check(
          (await folders(ui)) === library &&
            !(await ui.ev(`!!${ui.$('session-add-folder')}`)) &&
            (await ui.ev(`${ui.$('session-folders-unsupported')}.innerText`)).includes(
              L('profiles.mock.label')
            ),
          'agent sans la capacité : dossier gardé, « non transmis », pas d’ajout'
        )
        await ui.send('Quels dossiers ?')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(NONE),
          'agent sans la capacité : rien envoyé (l’agent factice refuserait la session)'
        )
        await ui.hover({ x: 5, y: 400 })
        await ui.shot('dossiers-3-non-transmis')
      },
      userData,
      'dossiers',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
