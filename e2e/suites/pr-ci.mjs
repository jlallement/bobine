import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'
import {
  FILES,
  JOB_URL,
  PR_URL,
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
        check(
          !(await ui.ev(`!!${ui.$('pr-card')}`)) &&
            state().calls.filter((c) => c[1] === 'view').length >= 1,
          'sans PR pour la branche : pas de carte (gh interrogé)'
        )
        await ui.shot('176-pr-avant')

        // « Ouvrir une PR » : la carte apparaît ; GitHub n'a pas encore signalé les contrôles
        // (0.9.1, D16 : plus « Aucun contrôle de CI »).
        await openPr(ui)
        await ui.waitFor(
          `${ui.$('pr-checks-line')}?.innerText === ${JSON.stringify(L('prTrack.checksAwaited'))}`
        )
        check(
          (await ui.ev(`${ui.$('pr-checks-line')}.dataset.ci`)) === 'awaited',
          'PR neuve, CI dans le dépôt, aucun contrôle encore : « Contrôles en attente »'
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
        check(
          !(await ui.ev(`!!${ui.$('worktree-pr-link')}`)) &&
            !(await ui.ev(`!!${ui.$('worktree-pr')}`)),
          'PR ouverte : la note du lien n’est pas répétée sous la carte, pas de bouton sans rien à pousser'
        )
        const card = await ui.ev(`({
          link: ${ui.$('pr-link')}.innerText,
          href: ${ui.$('pr-link')}.href,
          state: ${ui.$('pr-state')}.innerText,
          line: ${ui.$('pr-checks-line')}.innerText,
          checks: [...document.querySelectorAll('[data-testid=pr-check]')].map((c) => c.dataset.state),
          fix: !!${ui.$('pr-fix')},
          autoFix: ${ui.$('pr-auto-fix')}.checked,
          autoMerge: ${ui.$('pr-auto-merge')}.checked
        })`)
        check(
          card.link === '#7 Fais les modifications' &&
            card.href === PR_URL &&
            card.state === L('prTrack.state.open') &&
            card.line === L('prTrack.checks.pending', { count: 2 }) &&
            card.checks.join() === 'pending,pending' &&
            !card.fix &&
            !card.autoFix &&
            !card.autoMerge,
          `PR ouverte : carte avec contrôles en cours, choix d’office décochés (${JSON.stringify(card)})`
        )
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
        const failed = await ui.ev(`({
          line: ${ui.$('pr-checks-line')}.innerText,
          first: document.querySelector('[data-testid=pr-check] a')?.innerText,
          firstHref: document.querySelector('[data-testid=pr-check] a')?.href,
          meta: ${ui.$('pr-meta')}.innerText
        })`)
        check(
          failed.line ===
            `${L('prTrack.checks.failed', { count: 1 })} · ${L('prTrack.checks.passed', { count: 1 })}` &&
            failed.first === 'CI / test' &&
            failed.firstHref === JOB_URL &&
            failed.meta ===
              [
                L('prTrack.comments', { count: 2 }),
                L('prTrack.review.changes-requested'),
                L('prTrack.mergeable.conflicting')
              ].join(' · '),
          `contrôle en échec d’abord, avec son lien ; commentaires, relecture, conflit (${JSON.stringify(failed)})`
        )
        await ui.shot('176-pr-echec')
        // 0.9.1, D20 : « Fusionner quand tout est vert » cochée, la carte dit pourquoi elle attend.
        await ui.click(ui.$('pr-auto-merge'))
        await ui.waitFor(`${ui.$('pr-waiting')}?.dataset.wait === 'conflicting'`)
        check(
          (await ui.ev(`${ui.$('pr-waiting')}.innerText`)) ===
            L('prTrack.wait.conflicting', { base: 'main' }) &&
            !state().calls.some((c) => c[1] === 'merge'),
          'fusion d’office cochée sur une PR en conflit : la raison est dite, rien ne part'
        )
        await ui.shot('176-pr-attente')
        await ui.click(ui.$('pr-auto-merge'))
        await ui.waitFor(`!${ui.$('pr-waiting')}`)
        const prompts = await ui.ev(
          `[...document.querySelectorAll('.msg-user')].filter((m) => m.innerText.includes('CI checks')).length`
        )
        check(prompts === 0, 'rien n’est envoyé à l’agent sans clic')

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
        check(
          !(await ui.ev(`!!${ui.$('worktree-pr')}`)),
          'commit hors de la barre : pas encore vu sans relecture'
        )
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
        check(
          (await ui.ev(`${ui.$('session-pr-line')}.innerText`)).includes(
            `#7 · ${L('prTrack.checks.failed', { count: 1 })}`
          ),
          'onglet Session : ligne « Pull request » avec l’état des contrôles'
        )
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
        check(
          !state().calls.some((c) => c[1] === 'merge') && !(await ui.ev(`!!${ui.$('pr-event')}`)),
          'tout est vert, case décochée : rien n’est fusionné ; la note « envoyé à l’agent » est partie (D17)'
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
        const views = state().calls.filter((c) => c[1] === 'view').length
        await sleep(2000)
        check(
          state().calls.filter((c) => c[1] === 'view').length === views,
          'PR fusionnée : plus de relève'
        )

        // 0.9.1, D19 : « Nettoyer » supprime aussi la branche distante, qui porte la PR fusionnée.
        await ui.click(ui.$('worktree-cleanup'))
        await ui.waitFor(`!!${ui.$('worktree-cleanup-ask')}`)
        check(
          (await ui.ev(`${ui.$('worktree-cleanup-ask')}.innerText`)).includes('GitHub'),
          'PR fusionnée : la question dit que la branche part aussi sur GitHub'
        )
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
        check(
          true,
          '« Nouvelle conversation » après le nettoyage : dans le dépôt principal, pas dans le worktree supprimé'
        )
      },
      undefined,
      'conflits',
      { BOBINE_WORKSPACE: workspace, BOBINE_GH: gh }
    )
  } finally {
    repo.dispose()
  }
}
