import { L, check, withApp } from '../lib.mjs'
import { openPr, openWorktreeAndCommit, prJson, prRepo } from '../pr-repo.mjs'

/**
 * Dépôt sans CI (fiche 176, 0.9.1, D20) avec un faux `gh` (jamais GitHub) : ni workflow, ni
 * contrôle requis par la base, rien de bloqué. La carte dit « Aucune CI détectée », la fusion
 * d'office cochée dit qu'elle n'aura jamais lieu, « Fusionner maintenant » est refusé tant que
 * GitHub s'y oppose (branche à reprendre), puis fusionne au clic.
 */
export async function prCiNoCiSuite(scheme) {
  console.log(`\n— Suivi de la PR, dépôt sans CI (${scheme})`)
  const repo = prRepo({ workflows: false, fakeState: { onCreate: prJson([]) } })
  const { workspace, gh, state, setState } = repo
  try {
    await withApp(
      scheme,
      async (ui) => {
        await openWorktreeAndCommit(ui)
        await openPr(ui)
        await ui.waitFor(`${ui.$('pr-checks-line')}?.dataset.ci === 'none'`)
        check(
          (await ui.ev(`${ui.$('pr-checks-line')}.innerText`)) === L('prTrack.checksNoCi') &&
            (await ui.ev(`!!${ui.$('pr-merge-now')} && !${ui.$('pr-merge-now')}.disabled`)) &&
            state().calls.some((c) => c.join(' ') === 'api repos/{owner}/{repo}/branches/main') &&
            state().calls.some(
              (c) => c.join(' ') === 'api repos/{owner}/{repo}/rules/branches/main'
            ),
          'ni workflow ni contrôle requis : « Aucune CI détectée », « Fusionner maintenant » proposé'
        )
        await ui.click(ui.$('pr-auto-merge'))
        await ui.waitFor(`${ui.$('pr-waiting')}?.dataset.wait === 'no-ci'`)
        check(
          (await ui.ev(`${ui.$('pr-waiting')}.innerText`)) === L('prTrack.wait.no-ci') &&
            !state().calls.some((c) => c[1] === 'merge'),
          'fusion d’office cochée : jamais sans contrôle, et la carte le dit'
        )
        await ui.shot('176-pr-sans-ci')

        // GitHub exige de reprendre la base : le clic est refusé d'avance, avec la raison.
        setState({ pr: prJson([], { mergeStateStatus: 'BEHIND' }) })
        await ui.click(ui.$('pr-refresh'))
        await ui.waitFor(`${ui.$('pr-waiting')}?.dataset.wait === 'behind'`)
        check(
          (await ui.ev(`${ui.$('pr-merge-now')}.disabled`)) &&
            (await ui.ev(`${ui.$('pr-merge-now')}.title`)) ===
              L('prTrack.wait.behind', { base: 'main' }),
          'branche à reprendre : « Fusionner maintenant » refusé, la raison est dite'
        )
        await ui.shot('176-pr-sans-ci-refus')

        // Base reprise : la fusion part au clic, avec la méthode du dépôt.
        setState({ pr: prJson([]) })
        await ui.click(ui.$('pr-refresh'))
        await ui.waitFor(`!${ui.$('pr-merge-now')}?.disabled`)
        await ui.click(ui.$('pr-merge-now'))
        await ui.waitFor(
          `${ui.$('pr-state')}?.innerText === ${JSON.stringify(L('prTrack.state.merged'))}`,
          30000
        )
        check(
          state().calls.some((c) => c.join(' ') === 'pr merge 7 --merge --match-head-commit h1') &&
            (await ui.ev(`${ui.$('pr-event')}.innerText`)) ===
              L('prTrack.event.mergedNoCi', { method: L('prTrack.method.merge') }) &&
            (await ui.ev(`!!${ui.$('worktree-cleanup')}`)),
          '« Fusionner maintenant » : PR fusionnée (commit de fusion), « Nettoyer » proposé'
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
