import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Faire relire avant de fusionner (fiche 177) : « Faire relire… » dans l'onglet Modifications,
 * dialogue (agent suggéré, coût), relecteur lancé en fille dans le même dossier, carte « Relecture »
 * du fil, remarques reprises sur le diff puis envoyées à l'auteur. Dépôt git jetable ; l'agent
 * factice joue `modifications` pour l'auteur, `relecture` pour le relecteur (consigne reconnue).
 */
export async function relectureSuite(scheme) {
  console.log(`\n— Relecture (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-relecture-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Démo\n\nVersion 1\n\n## Utilisation\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Fais les modifications')
        await ui.ready()
        const authorId = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        await ui.waitFor(`!!${ui.$('changes-toggle')}`)
        await ui.click(ui.$('changes-toggle'))
        await ui.waitFor(`!!${ui.$('changes-review')}`)
        check(true, 'onglet Modifications d’un dossier git : « Faire relire… »')
        await ui.shot('177-1-faire-relire')

        // Dialogue : agent de l'auteur suggéré, ce qui est relu, le coût ; rien ne part sans clic.
        await ui.click(ui.$('changes-review'))
        await ui.waitFor(`!!${ui.$('review-dialog')}`)
        check(
          (await ui.ev(`${ui.$('review-scope')}.innerText`)) ===
            L('review.dialog.scopeUncommitted') &&
            (await ui.ev(`${ui.$('review-suggested')}.innerText`)).includes(
              L('review.dialog.cost')
            ) &&
            !!(await ui.ev(`${ui.$('review-agent')}.value`)),
          'dialogue : non commité relu, agent présélectionné, coût annoncé'
        )
        await ui.shot('177-2-dialogue')
        await ui.click(ui.$('review-launch'))
        await ui.waitFor(`!${ui.$('review-dialog')}`)

        // Carte « Relecture » dans le fil de l'auteur ; le relecteur rend ses remarques par l'outil.
        const card = ui.$('review-card')
        await ui.waitFor(`${card}?.dataset.status === 'reported'`, 30_000)
        check(
          (await ui.ev(`${card}.dataset.count`)) === '2' &&
            (await ui.ev(`${ui.$('review-card-severe')}.innerText`)) ===
              L('review.card.severe', { count: 1 }),
          'carte : 2 remarques dont 1 grave, rendues par `report_findings`'
        )
        // Le relecteur est une fille de l'auteur, dans la barre latérale, sans worktree.
        const reviewerId = await ui.ev(`${card}.dataset.reviewId`)
        check(
          await ui.ev(
            `!!document.querySelector('[data-testid=history-item][data-id="${reviewerId}"]')`
          ),
          'relecteur listé dans la barre latérale'
        )
        check(!existsSync(join(workspace, 'relecture.txt')), 'dossier relu intact')

        // Remarques reprises sur le diff : liste « Relecture », barre d'envoi.
        const notes = `[...document.querySelectorAll('[data-testid=review-note]')]`
        await ui.waitFor(`${notes}.length === 2`)
        check(
          (await ui.ev(`${ui.$('diff-notes-bar')}.innerText`)).includes(
            L('diffNotes.count', { count: 2 })
          ) &&
            (await ui.ev(
              `${notes}[0].querySelector('[data-testid=review-note-severity]').innerText`
            )) === L('review.severity.high'),
          'remarques de la relecture reprises en remarques de diff (gravité affichée)'
        )
        await ui.shot('177-3-carte-et-remarques')
        // Un clic : la remarque sur son diff, vue Git.
        await ui.click(`${notes}[0].querySelector('.review-note-main')`)
        await ui.waitFor(`${ui.$('changes-view-git')}?.getAttribute('aria-selected') === 'true'`)
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=diff-note]')].some((n) => n.innerText.includes('process.argv'))`
        )
        check(
          await ui.ev(
            `[...document.querySelectorAll('[data-testid=diff-note-severity]')].some((s) => s.innerText === ${JSON.stringify(L('review.severity.high'))})`
          ),
          'remarque affichée sous sa ligne, vue Git, avec sa gravité'
        )
        await ui.shot('177-4-remarque-sur-le-diff')

        // La seconde retirée ; la première envoyée à l'auteur comme toute remarque.
        await ui.click(`${notes}[1].querySelector('[data-testid=review-note-remove]')`)
        await ui.waitFor(`${notes}.length === 1`)
        const lastUser = `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText ?? ''`
        await ui.click(ui.$('diff-notes-send'))
        await ui.waitFor(`(${lastUser}).includes('Remarques sur les modifications')`)
        const sent = await ui.ev(lastUser)
        check(
          sent.includes('1. src/app.js, ligne 2 :') &&
            sent.includes('Remarque de la relecture (gravité haute)') &&
            !sent.includes('Fonction exportée') &&
            !(await ui.ev(`!!${ui.$('review-notes')}`)),
          'envoi : la remarque gardée part à l’auteur, avec sa gravité ; liste vidée'
        )
        await ui.ready()

        // « Ouvrir la relecture » : le fil du relecteur, avec l'appel à l'outil.
        await ui.click(ui.$('review-card-open'))
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === ${JSON.stringify(reviewerId)}`
        )
        check(reviewerId !== authorId, 'le relecteur s’ouvre depuis la carte')
        await ui.shot('177-5-relecteur')
      },
      undefined,
      'modifications',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
