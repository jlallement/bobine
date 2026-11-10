import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp, M } from '../lib.mjs'

/** Raison donnée par le scénario `filles-tech-lead` pour son choix de modèle. */
const WHY = 'import délicat, modèle précis'

/**
 * La mère tech lead (fiche 160), dans un dépôt git jetable. Scénario `filles-tech-lead` : un agent
 * inconnu refusé, puis « Import CSV » proposée avec un modèle et une raison (présélectionnés sur la
 * carte) ; au réveil, correction par `message_child` et « pas prête » ; au réveil suivant,
 * « prête ». Une deuxième fille, lancée à la main et non recommandée, ne part qu'après
 * confirmation. Puis `filles-bavarde` : le compte rendu reçu par la mère reste borné.
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
        check(
          (await ui.ev(`document.body.innerText`)).includes('Unknown agent "agent-inconnu"'),
          'start_child : agent inconnu refusé avec la liste des agents, sans carte'
        )
        check(
          (await ui.ev(`${pending}.querySelector('[data-testid=proposal-why]')?.innerText`)) ===
            `${L('children.proposals.proposed', { choice: M('Factice précis') })} — ${WHY}`,
          'carte : modèle proposé par la mère et sa raison'
        )
        // Suggestion : sélecteurs ouverts d'emblée, à confirmer ou changer.
        await ui.waitFor(`!!${ui.$('proposal-model')}`)
        check(
          (await ui.ev(`${ui.$('proposal-agent')}.value`)) === 'mock' &&
            (await ui.ev(`${ui.$('proposal-model')}.value`)) === 'factice-precis',
          'carte : agent de la mère et modèle proposé présélectionnés'
        )
        await ui.shot('filles-tech-lead-1-proposition')
        await ui.hover(await ui.center(`${pending}.querySelector('[data-testid=proposal-start]')`))
        await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
        await ui.waitFor(`!${pending}`)

        // Deux réveils : la correction, puis la recommandation ; aucune fusion par l'agent.
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=child-recommendation]').length === 2`,
          90000
        )
        await ui.ready()
        const verdicts = await ui.ev(
          `[...document.querySelectorAll('[data-testid=child-recommendation]')].map((r) => r.dataset.ready)`
        )
        check(
          verdicts.join() === 'false,true' &&
            (await ui.ev(`!!${ui.$('child-instruction')}`)) &&
            (await ui.ev(`document.body.innerText`)).includes('Correction faite'),
          'correction renvoyée par message_child, puis recommandation « prête »'
        )
        check(git(workspace, 'rev-list', '--count', 'main') === '1', 'rien de fusionné par l’agent')

        // Une seconde fille, lancée à la main, que la mère ne recommande pas.
        await ui.ev(
          `window.api.conversations.startChild('${mother}', ${JSON.stringify({ text: '/scenario echo Notes', title: 'Notes' })}).then(() => true)`
        )
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=child-report]').length >= 3`,
          60000
        )
        const folders = Object.fromEntries(
          await ui.ev(
            `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
          )
        )
        await commitAll(folders['Import CSV'], 'feat: import CSV')
        writeFileSync(join(folders['Notes'], 'NOTES.md'), '# Notes\n')
        await commitAll(folders['Notes'], 'docs: notes')
        // Revenir à la mère depuis une fille : la carte relit les branches.
        await ui.click(
          `document.querySelector('[data-testid=subtask-row] [data-testid=subtask-open]')`
        )
        await ui.waitFor(`!!${ui.$('title-origin')}`)
        await ui.click(ui.$('title-origin'))
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === '${mother}'`
        )
        await ui.waitFor(`!!${ui.$('subtasks-merge-others')}`, 30000)
        check(
          (await ui.ev(
            `[...document.querySelectorAll('[data-testid=subtask-recommendation]')].map((b) => b.dataset.state).join()`
          )) === 'ready' &&
            (await ui.ev(`${ui.$('subtasks-merge-start')}.innerText`)) ===
              L('childrenMerge.recommended.action', { count: 1, base: 'main' }) &&
            (await ui.ev(`${ui.$('subtasks-merge-others')}.innerText`)) ===
              L('childrenMerge.recommended.others', { count: 1 }),
          'Sous-tâches : pastille « Recommandée », seule la recommandée proposée'
        )
        await ui.shot('filles-tech-lead-2-recommandee')
        await ui.click(ui.$('subtasks-merge-others'))
        await ui.waitFor(`!!${ui.$('subtasks-merge-confirm')}`)
        await ui.shot('filles-tech-lead-3-confirmation')
        await ui.click(ui.$('subtasks-merge-confirm-cancel'))
        await ui.click(ui.$('subtasks-merge-start'))
        await ui.waitFor(`!!${ui.$('subtasks-merge-result')}`, 60000)
        check(
          git(workspace, 'log', '--format=%s', 'main').includes('feat: import CSV') &&
            !git(workspace, 'log', '--format=%s', 'main').includes('docs: notes'),
          'fusion par l’utilisateur : la recommandée seulement'
        )
        await ui.shot('filles-tech-lead-4-fusionnee')
      },
      undefined,
      'filles-tech-lead',
      env
    )

    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending] [data-testid=proposal-start]')`
        await ui.send('Fais le relevé')
        await ui.waitFor(`!!${pending}`, 30000)
        await ui.click(pending)
        await ui.waitFor(`(document.body.innerText).includes('Compte rendu borné')`, 90000)
        await ui.click(ui.$('child-report-toggle'))
        const excerpt = await ui.ev(`${ui.$('child-report-excerpt')}?.innerText ?? ''`)
        check(
          (await ui.ev(`${ui.$('child-report')}.innerText`)).includes(
            L('children.files', { count: 30 })
          ) &&
            excerpt.startsWith('Récapitulatif') &&
            !excerpt.includes('MARQUEUR-FIN-DE-REPONSE'),
          'fille bavarde : 30 fichiers comptés, début du récapitulatif, contexte de la mère borné'
        )
        await ui.shot('filles-tech-lead-5-bavarde')
      },
      undefined,
      'filles-bavarde',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
