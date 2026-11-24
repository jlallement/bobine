import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, MAIN_PORT, check, mainProcess, sleep, withApp } from '../lib.mjs'
import {
  ROWS,
  activeId,
  closeSettings,
  day,
  git,
  open,
  openSettings,
  project,
  quitApp,
  row,
  userCount
} from '../parcours.mjs'

const MOTHER = '/scenario echo Organise le carnet'
/** Ce qu'écrit le scénario `conflits` de l'agent factice quand on lui demande de résoudre. */
const RESOLVED = '# Démo\n\nVersion 2 et 3\n\n## Utilisation\n\nLancer `node src/app.js`.\n'
const workRow = (title) =>
  `[...document.querySelectorAll('[data-testid=work-row]')].find((r) => r.querySelector('[data-testid=work-row-name]')?.innerText === ${JSON.stringify(title)})`

/** Commit de tout un worktree, comme « Committer » ; réessayé si l'app lit l'index au même moment. */
async function commitAll(cwd, message) {
  for (let attempt = 0; ; attempt++) {
    try {
      git(cwd, 'add', '-A')
      git(cwd, 'commit', '-q', '-m', message)
      return
    } catch (error) {
      if (attempt >= 5 || !String(error.message).includes('index.lock')) throw error
      await sleep(200)
    }
  }
}

/** Ouvre la conversation d'un travail depuis sa ligne de la carte (dépliée s'il le faut). */
async function openWork(ui, title) {
  const open = `${workRow(title)}?.querySelector('[data-testid=work-open]')`
  if (!(await ui.ev(`!!${open}`))) {
    await ui.reveal(`${workRow(title)}.querySelector('[data-testid=work-row-toggle]')`)
    await ui.click(`${workRow(title)}.querySelector('[data-testid=work-row-toggle]')`)
  }
  await ui.waitFor(`!!${open}`)
  await ui.reveal(open)
  await ui.click(open)
  await ui.waitFor(`!!${ui.$('title-origin')}`)
}

/** Retour à la mère par le lien du titre de la fille. */
async function backToMother(ui, mother) {
  await ui.click(ui.$('title-origin'))
  await ui.waitFor(`document.querySelector('.history-item.active')?.dataset.id === '${mother}'`)
}

/** Supprime la conversation de la barre latérale qui porte ce titre (corbeille). */
async function trash(ui, title, { keepChildren = false } = {}) {
  await ui.click(`${row(title)}.querySelector('[data-testid=history-more]')`)
  await ui.waitFor(`!!${ui.$('history-delete')}`)
  await ui.click(ui.$('history-delete'))
  await ui.waitFor(`!!${ui.$('delete-dialog')}`)
  if (keepChildren && (await ui.ev(`${ui.$('delete-children')}?.checked === true`))) {
    await ui.click(ui.$('delete-children'))
    await ui.waitFor(`!${ui.$('delete-children')}.checked`)
  }
  await ui.click(ui.$('delete-confirm'))
  await ui.waitFor(`!${ui.$('delete-dialog')}`)
}

/**
 * « Déléguer » (fiche 277) : une mère lance trois travaux, on en ouvre un pour lui répondre, on
 * revient ; l'utilisateur committe dans les worktrees ; fusion des trois depuis la carte, dont un
 * conflit résolu par le travail ; un travail supprimé ; la mère supprimée, puis restaurée depuis la
 * corbeille, et l'on continue d'y converser ; l'app relancée garde tout.
 */
export async function parcoursDeleguerSuite(scheme) {
  console.log(`\n— Parcours : déléguer (${scheme})`)
  const workspace = project('bob-e2e-deleguer-')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-deleguer-data-'))
  const journee = day('déléguer')
  let mother
  let folders = {}
  let motherMessages = 0
  try {
    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        const main = await mainProcess()
        await journee.step('demander, puis lancer trois travaux', async () => {
          await ui.ready()
          await ui.send(MOTHER)
          await ui.ready()
          await ui.send('/scenario fusion-trois')
          await ui.waitFor(`!!${ui.$('work-group-start-all')}`, 30000)
          mother = await activeId(ui)
          await ui.click(ui.$('work-group-start-all'))
          await ui.waitFor(
            `document.querySelectorAll('[data-testid=work-row][data-state=replied]').length === 3`,
            60000
          )
          folders = Object.fromEntries(
            await ui.ev(
              `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
            )
          )
          check(
            Object.keys(folders).length === 3 &&
              Object.values(folders).every((f) => f !== workspace && existsSync(f)) &&
              (await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)) ===
                mother,
            'trois travaux finis, chacun dans son worktree ; la mère reste affichée'
          )
          await ui.shot('276-deleguer-travaux')
        })

        await journee.step('ouvrir un travail, lui répondre, revenir à la mère', async () => {
          await openWork(ui, 'Page d’aide')
          const before = await userCount(ui)
          await ui.send('/scenario echo Ajoute aussi une FAQ')
          await ui.ready()
          check(
            (await userCount(ui)) === before + 1 &&
              (await ui.lastAgentText()).includes('Ajoute aussi une FAQ') &&
              (await ui.ev(`${ui.$('title-origin')}?.innerText ?? ''`)).length > 0,
            'le travail répond dans sa conversation, le lien vers la mère est là'
          )
          await backToMother(ui, mother)
          await ui.waitFor(`${workRow('Page d’aide')}?.dataset.state === 'replied'`, 20000)
          check(true, 'retour à la mère : la ligne du travail dit qu’il a répondu')
        })

        await journee.step('committer dans les worktrees (dont un conflit à venir)', async () => {
          await commitAll(folders['Import CSV'], 'feat: import CSV')
          writeFileSync(
            join(folders['Page d’aide'], 'README.md'),
            '# Démo\n\nVersion 3\n\n## Utilisation\n'
          )
          await commitAll(folders['Page d’aide'], 'docs: page d’aide')
          writeFileSync(join(folders['Notes de version'], 'NOTES.md'), '# Notes de version\n')
          await commitAll(folders['Notes de version'], 'docs: notes de version')
          // La carte relit les branches quand on revient à la mère.
          await openWork(ui, 'Notes de version')
          await backToMother(ui, mother)
          await ui.waitFor(
            `${ui.$('subtasks-merge-start')}?.innerText === ${JSON.stringify(L('workGroup.merge.action', { count: 3, base: 'main' }))}`,
            20000
          )
          check(true, '« Fusionner les 3 dans main » proposé')
        })

        await journee.step(
          'fusionner les trois : le conflit est résolu par le travail',
          async () => {
            await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
            await ui.click(ui.$('subtasks-merge-start'))
            await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'done'`, 90000)
            check(
              readFileSync(join(workspace, 'README.md'), 'utf8') === RESOLVED &&
                existsSync(join(workspace, 'NOTES.md')) &&
                git(workspace, 'status', '--porcelain') === '',
              'main a les trois travaux, conflit résolu, dossier propre'
            )
            await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
            await ui.shot('276-deleguer-fusion')
          }
        )

        await journee.step('supprimer un travail', async () => {
          await ui.waitFor(`!!${row('Notes de version')}`)
          await trash(ui, 'Notes de version')
          await ui.waitFor(`!${row('Notes de version')}`)
          check(
            (await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)) === mother,
            'travail supprimé : il quitte la barre latérale, la mère reste affichée'
          )
        })

        await journee.step('supprimer la mère (et ses travaux)', async () => {
          await trash(ui, MOTHER)
          await ui.waitFor(`!${row(MOTHER)}`)
          await ui.waitFor(`!${row('Import CSV')} && !${row('Page d’aide')}`)
          check(
            !(await ui.ev(
              `window.api.conversations.get().then((s) => s.conversations.some((c) => c.id === '${mother}'))`
            )),
            'mère et travaux à la corbeille : plus dans la barre latérale'
          )
          // Inventaire `restart` n° 4 : la suppression se confirme dans l'app (fiche 026), jamais
          // par une boîte du navigateur (`confirm()`).
          check(ui.dialogs.length === 0, 'suppression confirmée dans l’app : aucune boîte native')
        })

        await journee.step('restaurer la mère depuis la corbeille', async () => {
          await openSettings(ui, 'settings-data')
          await ui.waitFor(`!!${ui.$('trash')}`)
          const entry = `[...document.querySelectorAll('[data-testid=trash-item]')].find((i) => i.innerText.includes(${JSON.stringify(MOTHER)}))`
          await ui.waitFor(`!!${entry}`)
          await ui.shot('276-deleguer-corbeille')
          await ui.click(`${entry}.querySelector('[data-testid=trash-restore]')`)
          await ui.waitFor(`!${entry}`)
          await closeSettings(ui)
          await ui.waitFor(`!!${row(MOTHER)}`)
          check(true, 'restaurée : de retour dans la barre latérale')
        })

        await journee.step('rouvrir la mère restaurée et continuer à converser', async () => {
          await open(ui, MOTHER)
          await ui.waitFor(`document.querySelectorAll('.msg-user').length >= 2`)
          motherMessages = await userCount(ui)
          await ui.ready()
          await ui.send('/scenario echo On reprend après la corbeille')
          await ui.ready()
          check(
            (await userCount(ui)) === motherMessages + 1 &&
              (await ui.lastAgentText()).includes('On reprend après la corbeille'),
            'mère restaurée : son fil, et l’agent répond'
          )
          motherMessages = await userCount(ui)
          await ui.shot('276-deleguer-restauree')
        })

        await journee.step(
          'quitter l’app',
          async () => {
            await quitApp(main, MAIN_PORT)
            check(true, 'app quittée')
          },
          { closing: true }
        )
      },
      userData,
      'conflits',
      { BOBINE_WORKSPACE: workspace },
      [`--inspect=${MAIN_PORT}`]
    )

    await withApp(
      scheme,
      async (ui) => {
        await journee.attach(ui)
        await journee.step('relancer : la mère restaurée est là et répond', async () => {
          await ui.waitFor(`!!${row(MOTHER)}`, 20000)
          await open(ui, MOTHER)
          await ui.waitFor(`document.querySelectorAll('.msg-user').length === ${motherMessages}`)
          await ui.ready()
          await ui.send('/scenario echo Toujours là ?')
          await ui.ready()
          check(
            (await ui.lastAgentText()).includes('Toujours là ?') &&
              (await ui.ev(`${ROWS}.length`)) >= 1,
            'après relance : la mère restaurée garde son fil et répond'
          )
        })
      },
      userData,
      'echo',
      { BOBINE_AGENT_PROFILE: '', BOBINE_MOCK_AGENT: '1' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
