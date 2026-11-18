import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Filles en worktree et non commité de la mère (fiche 240), contre l'agent factice, dans un dépôt
 * jetable où `plan.md` n'est pas commité. Chaque fille joue `voit-le-plan` : elle dit si elle voit
 * `plan.md`.
 *
 * (a) Rôle : `@ux-ui-expert` sur un dossier modifié, l'avertissement paraît avant l'envoi, Entrée
 *     n'envoie rien ; « Partir quand même » : la fille ne voit pas le plan, la mère le rappelle ;
 *     avis en lecture seule : les filles voient le plan.
 * (b) Tâches proposées : la carte attend le choix ; « Committer d'abord », puis « Lancer » : la
 *     fille voit le plan.
 */
export async function fillesNonCommiteSuite(scheme) {
  console.log(`\n— Filles et non commité de la mère (${scheme})`)
  for (const run of [roleRun, proposalsRun]) {
    const { workspace, git } = repository()
    try {
      await withApp(scheme, (ui) => run(ui, git), undefined, 'echo', {
        BOBINE_WORKSPACE: workspace
      })
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  }
}

/** Dépôt jetable : un commit, puis `plan.md` écrit par « la mère », pas commité. */
function repository() {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-non-commite-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Tâches\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'chore: initial commit')
  writeFileSync(join(workspace, 'plan.md'), '# Plan\n')
  return { workspace, git }
}

const input = `document.querySelector('[data-testid="composer-input"]')`
const reports = `[...document.querySelectorAll('[data-testid=child-report]')]`
const leads = `${reports}.map((r) => r.querySelector('[data-testid=child-report-lead]')?.innerText ?? '')`

async function typeRoles(ui, text) {
  await ui.ev(`${input}.focus()`)
  await ui.type(text)
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
}

async function roleRun(ui) {
  await ui.ready()
  await ui.send('Écris le plan')
  await ui.ready()

  // L'avertissement paraît dès les rôles cités, avant tout envoi.
  await typeRoles(ui, '@ux-ui-expert construisez la page\n/scenario voit-le-plan')
  await ui.waitFor(`!!${ui.$('launch-dirty')}`, 10000)
  check(
    (await ui.ev(`${ui.$('launch-dirty')}.dataset.count`)) === '1' &&
      (await ui.ev(`${ui.$('launch-dirty-file')}.innerText`)) === 'plan.md',
    'rôle : avertissement avant l’envoi, avec le fichier non commité'
  )
  await ui.shot('filles-non-commite-1-avertissement')
  await ui.enter()
  await sleep(800)
  check(
    (await ui.ev(`document.querySelectorAll('[data-testid=role-launch]').length`)) === 0 &&
      (await ui.ev(`${input}.value`)).includes('construisez la page'),
    'rôle : Entrée n’envoie rien tant qu’aucun choix n’est fait'
  )

  // « Partir quand même » : la fille part du commit, sans le plan ; la mère le rappelle.
  await ui.click(ui.$('launch-dirty-anyway'))
  await ui.waitFor(`!!${ui.$('role-launch')}`, 30000)
  await ui.waitFor(`${reports}.length === 1`, 30000)
  check(
    (await ui.ev(`${leads}[0]`)).includes('je ne trouve pas plan.md'),
    'partie quand même : la fille ne voit pas le travail non commité'
  )
  check(
    !!(await ui.ev(`!!${ui.$('child-report-left-behind')}`)) &&
      !!(await ui.ev(`!!${ui.$('role-launch-left-behind')}`)),
    'partie quand même : rappel sur sa carte et sur son compte rendu, dans la mère'
  )
  await ui.shot('filles-non-commite-2-rappel')

  // Avis en lecture seule : dans le dossier de la mère, les filles voient le plan.
  await typeRoles(
    ui,
    '@ux-ui-expert @back-architect votre avis sur le plan\n/scenario voit-le-plan'
  )
  await ui.waitFor(`!!${ui.$('launch-dirty-opinion')}`, 10000)
  await ui.click(ui.$('launch-dirty-opinion'))
  await ui.waitFor(`${ui.$('role-destination')}?.hasAttribute('data-opinion')`)
  check(
    !(await ui.ev(`!!${ui.$('launch-dirty')}`)) &&
      (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes(
        L('roleWork.destination.sameFolder')
      ),
    'avis : plus d’avertissement, les rôles partent dans ce dossier'
  )
  await ui.shot('filles-non-commite-3-avis')
  await ui.enter()
  await ui.waitFor(`document.querySelectorAll('[data-testid=role-launch]').length === 3`, 30000)
  await ui.waitFor(`${reports}.length === 3`, 30000)
  const opinions = (await ui.ev(`JSON.stringify(${leads}.slice(1))`)) ?? '[]'
  check(
    JSON.parse(opinions).every((lead) => lead.includes('je vois plan.md')),
    'avis en lecture seule : les deux filles voient le travail non commité'
  )
}

async function proposalsRun(ui, git) {
  await ui.ready()
  await ui.send('Découpe la suite\n/scenario tache-plan')
  const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending]')`
  await ui.waitFor(`!!${pending}`, 30000)
  await ui.waitFor(`!!${ui.$('launch-dirty')}`, 10000)
  check(
    await ui.ev(`${pending}.querySelector('[data-testid=proposal-start]').disabled`),
    'Tâches proposées : « Lancer » attend le choix'
  )
  await ui.shot('filles-non-commite-4-taches-proposees')
  await ui.click(ui.$('launch-dirty-commit'))
  await ui.waitFor(`!!${ui.$('launch-dirty-commit-confirm')}`)
  await ui.shot('filles-non-commite-5-committer')
  await ui.click(ui.$('launch-dirty-commit-confirm'))
  await ui.waitFor(`!${ui.$('launch-dirty')}`, 10000)
  check(git('status', '--porcelain') === '', 'Committer d’abord : le dossier de la mère est propre')
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  await ui.waitFor(`${reports}.length === 1`, 30000)
  check(
    (await ui.ev(`${leads}[0]`)).includes('je vois plan.md') &&
      !(await ui.ev(`!!${ui.$('child-report-left-behind')}`)),
    'Committer d’abord puis Lancer : la fille voit le travail de la mère, aucun rappel'
  )
  await ui.shot('filles-non-commite-6-fille-voit')
}
