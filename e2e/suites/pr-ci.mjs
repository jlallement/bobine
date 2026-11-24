import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'
import {
  FILES,
  JOB_URL,
  checkRun as run,
  openPr,
  openWorktreeAndCommit,
  prJson,
  prRepo
} from '../pr-repo.mjs'

/**
 * Suivi de la PR et de la CI (fiche 176) avec un faux `gh` (`BOBINE_GH`, jamais GitHub) : « Ouvrir
 * une PR » puis carte « Pull request » (contrôles attendus, en cours, puis en échec avec
 * commentaires et conflit, et la raison de l'attente de la fusion), « Corriger les contrôles en
 * échec » (consigne et extrait du journal dans le fil), un commit fait dans un terminal vu par
 * « Actualiser », ligne de l'onglet Session, puis « Fusionner quand tout est vert » et « Nettoyer »
 * (branche supprimée aussi sur le dépôt distant). Dépôt sans CI : `pr-ci-sans-ci.mjs`.
 */
export async function prCiSuite(scheme) {
  console.log(`\n— Suivi de la PR et de la CI (${scheme})`)
  // Une CI GitHub dans le dépôt ; GitHub n'a encore attaché aucun contrôle à la PR neuve.
  const repo = prRepo({
    workflows: true,
    fakeState: {
      onCreate: prJson([]),
      // Le dépôt ne permet que le squash : la carte le dit, la fusion le prend.
      repo: { mergeCommitAllowed: false, squashMergeAllowed: true, rebaseMergeAllowed: false },
      logs: {
        42: 'test\tRun tests\t2026-11-06T10:00:01.0000000Z ^[[31mFAIL^[[0m src/app.test.js\ntest\tRun tests\t2026-11-06T10:00:01.1000000Z   expected "Version 2" to be "Version 3"\n'
      }
    }
  })
  const { workspace, gh, state, setState } = repo
  const files = FILES

  try {
    await withApp(
      scheme,
      async (ui) => {
        await openWorktreeAndCommit(ui)
        await sleep(300)
        await ui.shot('176-pr-avant')

        // « Ouvrir une PR » : la carte apparaît ; GitHub n'a pas encore signalé les contrôles
        // (0.9.1, D16 : plus « Aucun contrôle de CI »).
        await openPr(ui)
        await ui.waitFor(
          `${ui.$('pr-checks-line')}?.innerText === ${JSON.stringify(L('prTrack.checksAwaited'))}`
        )
        await ui.shot('176-pr-attendus')
        // Les contrôles arrivent : relève rapprochée après le push (10 s), ou « Actualiser ».
        setState({ pr: prJson([run('test', 'IN_PROGRESS'), run('lint', 'QUEUED')]) })
        await ui.click(ui.$('pr-refresh'))
        await ui.waitFor(
          `${ui.$('pr-checks-line')}?.innerText === ${JSON.stringify(L('prTrack.checks.pending', { count: 2 }))}`
        )
        // La carte a le lien : ni la note « PR ouverte », ni « Ouvrir une PR » (rien à pousser).
        await ui.waitFor(`!${ui.$('worktree-pr')}`)
        await ui.shot('176-pr-en-cours')

        // La CI échoue, un relecteur commente, la base a bougé : « Actualiser ».
        setState({
          pr: prJson(
            [run('test', 'COMPLETED', 'FAILURE', JOB_URL), run('lint', 'COMPLETED', 'SUCCESS')],
            {
              mergeable: 'CONFLICTING',
              reviewDecision: 'CHANGES_REQUESTED',
              comments: [{ body: 'Le test échoue' }],
              reviews: [{ state: 'CHANGES_REQUESTED', body: 'À revoir' }]
            }
          )
        })
        await ui.click(ui.$('pr-refresh'))
        await ui.waitFor(`!!${ui.$('pr-fix')}`)
        await ui.shot('176-pr-echec')
        // 0.9.1, D20 : « Fusionner quand tout est vert » cochée, la carte dit pourquoi elle attend.
        await ui.click(ui.$('pr-auto-merge'))
        await ui.waitFor(`${ui.$('pr-waiting')}?.dataset.wait === 'conflicting'`)
        await ui.shot('176-pr-attente')
        await ui.click(ui.$('pr-auto-merge'))
        await ui.waitFor(`!${ui.$('pr-waiting')}`)

        // « Corriger les contrôles en échec » : la consigne part dans le fil, avec l'extrait.
        await ui.click(ui.$('pr-fix'))
        await ui.waitFor(
          `${ui.$('pr-event')}?.innerText === ${JSON.stringify(L('prTrack.event.fixSent', { count: 1 }))}`
        )
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-user')].some((m) => m.innerText.includes('FAIL src/app.test.js'))`
        )
        const asked = await ui.ev(
          `[...document.querySelectorAll('.msg-user')].find((m) => m.innerText.includes('CI checks')).innerText`
        )
        check(
          asked.includes('pull request #7') &&
            asked.includes(`CI / test — ${JOB_URL}`) &&
            asked.includes('expected "Version 2" to be "Version 3"') &&
            !asked.includes('^[') &&
            !asked.includes('[0m') &&
            state().calls.some((c) => c.join(' ') === 'run view --job 42 --log-failed'),
          'consigne envoyée : contrôle, lien et extrait du journal sans couleurs (gh run view --log-failed)'
        )
        await ui.ready()

        // L'agent a modifié des fichiers : un commit, puis « Pousser vers la PR ».
        await ui.waitFor(`${files}.length > 0`)
        await ui.click(ui.$('worktree-commit'))
        await ui.waitFor(`!!${ui.$('worktree-commit-form')}`)
        // Fiche 246 : le message est rédigé par l'agent (factice) ; le bouton attend sa réponse.
        await ui.waitFor(`!${ui.$('worktree-commit-confirm')}.disabled`, 15000)
        await ui.click(ui.$('worktree-commit-confirm'))
        await ui.waitFor(`${files}.length === 0`)
        await ui.waitFor(
          `${ui.$('worktree-pr')}?.innerText === ${JSON.stringify(L('worktreeCycle.pr.pushToPr'))}`
        )
        await ui.shot('176-pr-pousser')
        const creates = state().calls.filter((c) => c[1] === 'create').length
        await ui.click(ui.$('worktree-pr'))
        await ui.waitFor(`!${ui.$('worktree-pr')}`, 30000)
        check(
          state().pr.statusCheckRollup.length === 2 &&
            state().calls.filter((c) => c[1] === 'create').length === creates + 1 &&
            !(await ui.ev(`!!${ui.$('worktree-pr-link')}`)),
          '« Pousser vers la PR » : branche poussée, PR existante gardée, bouton caché ensuite'
        )

        // 0.9.1, D15 : un commit fait dans un terminal, hors de la barre. « Actualiser » de
        // l'onglet relit la barre : « Pousser vers la PR » revient.
        const { path: worktreePath, branch } = repo.worktree()
        writeFileSync(join(worktreePath, 'NOTES.md'), 'Commit fait dans un terminal\n')
        const inWorktree = (...args) =>
          execFileSync('git', args, { cwd: worktreePath, encoding: 'utf8' }).trim()
        inWorktree('add', 'NOTES.md')
        inWorktree('commit', '-q', '-m', 'docs: notes (terminal)')
        await sleep(500)
        await ui.click(
          `document.querySelector('.changes-tab button[aria-label=${JSON.stringify(L('changes.refresh'))}]')`
        )
        await ui.waitFor(
          `${ui.$('worktree-pr')}?.innerText === ${JSON.stringify(L('worktreeCycle.pr.pushToPr'))}`
        )
        check(
          true,
          '« Actualiser » : le commit fait dans un terminal est vu, « Pousser vers la PR » revient'
        )
        await ui.click(ui.$('worktree-pr'))
        await ui.waitFor(`!${ui.$('worktree-pr')}`, 30000)

        // Onglet Session : une ligne « Pull request ».
        await ui.click(`document.querySelector('.side-panel-tab[data-tab=session] [role=tab]')`)
        await ui.waitFor(`!!${ui.$('session-pr-line')}`)
        await ui.shot('176-pr-session')
        await ui.click(ui.$('session-pr-line'))
        await ui.waitFor(`!!${ui.$('pr-card')}`)

        // Tout passe au vert sur le dernier commit poussé : « Fusionner quand tout est vert »,
        // cochée, fusionne.
        const head = repo.remoteHead(branch)
        setState({
          pr: prJson(
            [run('test', 'COMPLETED', 'SUCCESS', JOB_URL), run('lint', 'COMPLETED', 'SUCCESS')],
            { headRefOid: head, reviewDecision: 'APPROVED' }
          )
        })
        await ui.click(ui.$('pr-refresh'))
        await ui.waitFor(
          `${ui.$('pr-checks-line')}?.innerText === ${JSON.stringify(L('prTrack.checks.passed', { count: 2 }))}`
        )
        await ui.click(ui.$('pr-auto-merge'))
        await ui.waitFor(
          `${ui.$('pr-state')}?.innerText === ${JSON.stringify(L('prTrack.state.merged'))}`,
          30000
        )
        check(
          (await ui.ev(`${ui.$('pr-event')}.innerText`)) ===
            L('prTrack.event.merged', { method: L('prTrack.method.squash') }) &&
            state().calls.some(
              (c) => c.join(' ') === `pr merge 7 --squash --match-head-commit ${head}`
            ) &&
            (await ui.ev(`!!${ui.$('worktree-cleanup')}`)) &&
            !(await ui.ev(`!!${ui.$('worktree-pr')}`)) &&
            !(await ui.ev(`!!${ui.$('pr-fix')}`)),
          'cochée : PR fusionnée par gh pr merge --squash, seule méthode du dépôt, dite sur la carte ; « Nettoyer » proposé'
        )
        await ui.shot('176-pr-fusionnee')
        await sleep(2000)

        // 0.9.1, D19 : « Nettoyer » supprime aussi la branche distante, qui porte la PR fusionnée.
        await ui.click(ui.$('worktree-cleanup'))
        await ui.waitFor(`!!${ui.$('worktree-cleanup-ask')}`)
        await ui.click(ui.$('worktree-cleanup-confirm'))
        await ui.waitFor(`!!${ui.$('worktree-cleaned')}`, 30000)
        check(
          (await ui.ev(`${ui.$('worktree-cleaned')}.dataset.remote`)) === 'deleted' &&
            repo.remoteHead(branch) === '' &&
            !(await ui.ev(`!!${ui.$('worktree-bar')}`)),
          'nettoyée : worktree supprimé, branche supprimée aussi sur le dépôt distant, et c’est dit'
        )
        await ui.shot('176-pr-nettoyee')

        // 0.9.1, D21 : la conversation affichée après le nettoyage, et la suivante, partent du
        // dépôt principal, pas du worktree supprimé (plus de « spawn git ENOENT »).
        const folder = workspace.split('/').at(-1)
        const inRepo = `${ui.$('workspace-menu')}?.innerText.trim() === ${JSON.stringify(folder)}`
        await ui.waitFor(inRepo)
        check(
          !(await ui.ev(
            `[...document.querySelectorAll('.browser-error')].some((e) => e.innerText.includes('ENOENT'))`
          )),
          'après « Nettoyer » : la conversation affichée est dans le dépôt principal, sans erreur git'
        )
        await ui.click(ui.$('new-conversation'))
        await ui.ready()
        await ui.waitFor(inRepo)
      },
      undefined,
      'conflits',
      { BOBINE_WORKSPACE: workspace, BOBINE_GH: gh }
    )
  } finally {
    repo.dispose()
  }
}
