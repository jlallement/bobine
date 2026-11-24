import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * La mère tech lead (fiche 160), dans un dépôt git jetable. Scénario `filles-tech-lead` : un agent
 * inconnu refusé, puis « Import CSV » proposée avec un modèle et une raison (présélectionnés sur la
 * carte) ; au réveil, correction par `message_child` et « pas prête » ; au réveil suivant,
 * « prête », la pastille sur sa ligne de la carte de groupe (fiche 264). Une deuxième fille,
 * lancée à la main, a sa propre carte : la fusion de la carte de groupe ne prend que la sienne.
 * Puis `filles-bavarde` : le compte rendu reçu par la mère reste borné.
 */
export async function fillesTechLeadSuite(scheme) {
  console.log(`\n— Mère tech lead (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-tech-lead-')))
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  git(workspace, 'init', '-q', '-b', 'main')
  git(workspace, 'add', '.')
  git(workspace, 'commit', '-q', '-m', 'init')
  /** Commit de tout un worktree, comme « Committer » ; réessayé si l'app lit l'index au même moment. */
  const commitAll = async (cwd, message) => {
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
  const env = { BOBINE_WORKSPACE: workspace }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const activeId = () => ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        const pending = `document.querySelector('[data-testid=proposal-row][data-title="Import CSV"][data-outcome=pending]')`
        await ui.send('Ajoute l’import CSV')
        await ui.waitFor(`!!${pending}`, 30000)
        const mother = await activeId()
        // Suggestion : sélecteurs ouverts d'emblée, à confirmer ou changer.
        await ui.waitFor(`!!${ui.$('proposal-model')}`)
        await ui.shot('filles-tech-lead-1-proposition')
        // « Lancer » armé une fois le dossier de la mère lu (fiches 240, 262).
        await ui.waitFor(
          `!${pending}.querySelector('[data-testid=proposal-start]').disabled`,
          30000
        )
        await ui.hover(await ui.center(`${pending}.querySelector('[data-testid=proposal-start]')`))
        await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
        await ui.waitFor(`!${pending}`)

        // Deux réveils : la correction, puis la recommandation ; aucune fusion par l'agent. Une
        // seule mention de la recommandation (fiche 264) : la pastille de la ligne de la carte.
        const row = `document.querySelector('[data-testid=work-group] [data-testid=work-row]')`
        await ui.waitFor(
          `${row}?.querySelector('[data-testid=subtask-recommendation]')?.dataset.state === 'ready'`,
          90000
        )
        await ui.waitFor(`document.body.innerText.includes('à toi de la fusionner')`, 30000)
        await ui.ready()
        await ui.reveal(`${row}.querySelector('[data-testid=work-row-toggle]')`)
        await ui.click(`${row}.querySelector('[data-testid=work-row-toggle]')`)
        await ui.waitFor(`!!${row}.querySelector('[data-testid=work-note]')`)

        // Un second travail, lancé à la main (« Lancer en parallèle… ») : sa propre carte.
        await ui.ev(
          `window.api.conversations.startChild('${mother}', ${JSON.stringify({ text: '/scenario echo Notes', title: 'Notes' })}).then(() => true)`
        )
        const solo = `document.querySelector('[data-testid=work-card][data-state=replied]:not(.in-group)')`
        await ui.waitFor(`!!${solo}`, 60000)
        const folders = Object.fromEntries(
          await ui.ev(
            `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
          )
        )
        await commitAll(folders['Import CSV'], 'feat: import CSV')
        writeFileSync(join(folders['Notes'], 'NOTES.md'), '# Notes\n')
        await commitAll(folders['Notes'], 'docs: notes')
        // Revenir à la mère depuis un travail : les cartes relisent les branches.
        const open = `${row}.querySelector('[data-testid=work-open]')`
        await ui.reveal(open)
        await ui.click(open)
        await ui.waitFor(`!!${ui.$('title-origin')}`)
        await ui.click(ui.$('title-origin'))
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === '${mother}'`
        )
        // Le plan relu : la carte montre d'abord le dernier plan lu (avant les commits, « 3
        // modifications non commitées »), le temps de relire les branches. L'essai attend le plan
        // de ces commits, pas seulement le bouton (Linux, fiche 250).
        const recommended = L('workGroup.merge.recommended.action', { count: 1, base: 'main' })
        await ui.waitFor(
          `${ui.$('subtasks-merge-start')}?.innerText === ${JSON.stringify(recommended)}`,
          30000
        )
        await ui.waitFor(`!!${solo}?.querySelector('[data-testid=work-merge-start]')`, 30000)
        check(
          (await ui.ev(`${ui.$('subtasks-merge-start')}.innerText`)) === recommended &&
            !(await ui.ev(`!!${ui.$('subtasks-merge-others')}`)),
          'carte de groupe : pastille « Recommandée », le recommandé proposé ; l’autre travail a sa carte'
        )
        await ui.reveal(ui.$('work-group'))
        await ui.shot('filles-tech-lead-2-recommandee')
        await ui.click(ui.$('subtasks-merge-start'))
        await ui.waitFor(`!!${ui.$('subtasks-merge-result')}`, 60000)
        check(
          git(workspace, 'log', '--format=%s', 'main').includes('feat: import CSV') &&
            !git(workspace, 'log', '--format=%s', 'main').includes('docs: notes'),
          'fusion depuis la carte : son travail seulement'
        )
        await ui.reveal(ui.$('subtasks-merge-result'))
        await ui.shot('filles-tech-lead-4-fusionnee')
      },
      undefined,
      'filles-tech-lead',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
