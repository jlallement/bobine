import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Filles en worktree et non commité de la mère (fiches 240, 262), contre l'agent factice, dans un
 * dépôt jetable où `plan.md` n'est pas commité. Chaque fille joue `voit-le-plan` : elle dit si
 * elle voit `plan.md`.
 *
 * (a) Rôle : `@front-architect` sur un dossier modifié, aucun encadré : une ligne discrète, en orange,
 *     « Partira du dernier commit, sans votre modification » ; « Changer… › Voir » liste le
 *     fichier ; Entrée envoie : la fille ne voit pas le plan, la mère le rappelle. « Changer… ›
 *     Juste un avis » : les filles partent en lecture seule et voient le plan.
 * (b) Tâches proposées : la même ligne, « Lancer » n'attend pas ; « Changer… › Committer
 *     d'abord », puis « Lancer » : la fille voit le plan. Fiche 244 : un `.env` non suivi, non
 *     ignoré, est dans la liste à cocher ; décoché, il ne part pas : il reste dans le dossier, et
 *     la fille part sans lui (rappelé).
 * (c) Fiche 262, dépôt sans aucun commit (la recette du 2026-11-19 a fini sur un commit vide) : la
 *     ligne dit que le rôle travaillera dans ce dossier ; Entrée envoie, la fille voit le plan ; la
 *     proposition de l'agent (`start_child`) part aussi dans le dossier ; ni worktree ni commit.
 */
export async function fillesNonCommiteSuite(scheme) {
  console.log(`\n— Filles et non commité de la mère (${scheme})`)
  for (const run of [roleRun, proposalsRun, noCommitRun]) {
    const { workspace, git } = repository(run === proposalsRun, run !== noCommitRun)
    try {
      await withApp(scheme, (ui) => run(ui, git), undefined, 'echo', {
        BOBINE_WORKSPACE: workspace
      })
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  }
}

/**
 * Dépôt jetable : un commit (sauf `commit = false` : aucun), puis `plan.md` écrit par « la mère »,
 * pas commité (et un `.env`).
 */
function repository(env = false, commit = true) {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-non-commite-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Tâches\n')
  git('init', '-q', '-b', 'main')
  if (commit) {
    git('add', '.')
    git('commit', '-q', '-m', 'chore: initial commit')
  }
  writeFileSync(join(workspace, 'plan.md'), '# Plan\n')
  if (env) writeFileSync(join(workspace, '.env'), 'SECRET=1\n')
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

/** « Changer… » de la ligne du dossier, puis cette entrée du menu (vrais clics, menu Radix). */
async function change(ui, entry, shot) {
  await ui.click(ui.$('launch-line-change'))
  await ui.waitFor(`!!${ui.$(entry)}`, 5000)
  // Menu ouvert : capture pour la relecture UX (fiche 262).
  if (shot) await ui.shot(shot)
  await ui.click(ui.$(entry))
  await ui.waitFor(`!${ui.$('launch-line-menu')}`, 5000)
}

async function roleRun(ui) {
  await ui.ready()
  await ui.send('Écris le plan')
  await ui.ready()

  // Une ligne discrète dès le rôle cité ; ni encadré ni bouton (fiche 262, R1).
  await typeRoles(ui, '@front-architect construisez la page\n/scenario voit-le-plan')
  await ui.waitFor(`!!${ui.$('launch-line')}`, 10000)
  check(
    (await ui.ev(`${ui.$('launch-line')}.dataset.count`)) === '1' &&
      (await ui.ev(`${ui.$('launch-line')}.classList.contains('warn')`)) &&
      (await ui.ev(`${ui.$('launch-line')}.innerText`)).includes(
        L('launchLine.without', { count: 1 })
      ) &&
      !(await ui.ev(`!!document.querySelector('.main-dirty')`)),
    'rôle : une ligne en orange sous la saisie, aucun encadré'
  )
  await change(ui, 'launch-line-show', 'filles-non-commite-1b-menu')
  check(
    (await ui.ev(`${ui.$('launch-line-file')}.innerText`)) === 'plan.md',
    'rôle : « Changer… › Voir la modification » liste le fichier non commité'
  )
  await ui.shot('filles-non-commite-1-ligne')

  // Entrée envoie, avec le choix affiché : la fille part du commit, sans le plan (R2).
  await ui.enter()
  await ui.waitFor(`!!${ui.$('role-launch')}`, 30000)
  await ui.waitFor(`${reports}.length === 1`, 30000)
  check(
    (await ui.ev(`${leads}[0]`)).includes('je ne trouve pas plan.md'),
    'Entrée : partie sans elles, la fille ne voit pas le travail non commité'
  )
  check(
    !!(await ui.ev(`!!${ui.$('child-report-left-behind')}`)) &&
      !!(await ui.ev(`!!${ui.$('role-launch-left-behind')}`)),
    'partie sans elles : rappel sur sa carte et sur son compte rendu, dans la mère'
  )
  await ui.shot('filles-non-commite-2-rappel')

  // « Juste un avis » : appliqué sans renvoyer ; dans le dossier de la mère, ils voient le plan.
  await typeRoles(
    ui,
    '@front-architect @back-architect votre avis sur le plan\n/scenario voit-le-plan'
  )
  await ui.waitFor(`!!${ui.$('launch-line-change')}`, 10000)
  await change(ui, 'launch-line-opinion')
  await ui.waitFor(`${ui.$('role-destination')}?.hasAttribute('data-opinion')`)
  check(
    (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes(
      L('roleWork.destination.sameFolder')
    ),
    'avis : la ligne dit que les rôles partent dans ce dossier'
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
  await ui.waitFor(`!!${ui.$('launch-line')}`, 10000)
  check(
    (await ui.ev(`${ui.$('launch-line')}.innerText`)).includes(
      L('launchLine.withoutAlone.work', { count: 2 })
    ) && !(await ui.ev(`${pending}.querySelector('[data-testid=proposal-start]').disabled`)),
    'Tâches proposées : une ligne discrète ; « Lancer » n’attend pas (sans elles par défaut)'
  )
  await ui.shot('filles-non-commite-4-taches-proposees')
  await change(ui, 'launch-line-commit')
  await ui.waitFor(`!!${ui.$('launch-line-commit-confirm')}`)
  // Fiche 244 : la liste complète, cochée ; le `.env` décoché ne part pas.
  const rows = `[...document.querySelectorAll('[data-testid=launch-line-commit-file]')]`
  check(
    JSON.stringify(await ui.ev(`${rows}.map((li) => li.dataset.path).sort()`)) ===
      JSON.stringify(['.env', 'plan.md']) &&
      (await ui.ev(`${rows}.every((li) => li.querySelector('input').checked)`)),
    'Committer d’abord : la liste complète (.env compris), tout coché'
  )
  await ui.click(`${rows}.find((li) => li.dataset.path === '.env').querySelector('input')`)
  await ui.waitFor(`!!${ui.$('launch-line-commit-left')}`)
  // Fiche 246 : le message rédigé par l'agent ne suit pas les cases d'office ; refait sans le .env.
  await ui.waitFor(`${ui.$('launch-line-commit-draft')}?.dataset.state === 'agent'`, 15000)
  await ui.click(ui.$('launch-line-commit-draft-again'))
  await ui.waitFor(`${ui.$('launch-line-commit-draft')}?.dataset.state === 'drafting'`, 15000)
  await ui.waitFor(`${ui.$('launch-line-commit-draft')}?.dataset.state === 'agent'`, 15000)
  check(
    !(await ui.ev(`${ui.$('launch-line-commit-message')}.value`)).includes('.env') &&
      (await ui.ev(`${ui.$('launch-line-commit-left')}.innerText`)) ===
        L('launchLine.left', { count: 1 }),
    'le .env décoché : hors du message, la ligne dit que le travail partira sans lui'
  )
  await ui.shot('filles-non-commite-5-committer')
  await ui.click(ui.$('launch-line-commit-confirm'))
  await ui.waitFor(`!${ui.$('launch-line-commit-confirm')}`, 10000)
  await ui.waitFor(`${ui.$('launch-line')}?.dataset.count === '1'`, 10000)
  check(
    git('status', '--porcelain') === '?? .env' &&
      git('show', '--name-only', '--format=', 'HEAD') === 'plan.md',
    'Committer d’abord : plan.md commité seul, le .env reste non suivi dans le dossier'
  )
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  await ui.waitFor(`${reports}.length === 1`, 30000)
  check(
    (await ui.ev(`${leads}[0]`)).includes('je vois plan.md') &&
      !!(await ui.ev(`!!${ui.$('child-report-left-behind')}`)),
    'Committer d’abord puis Lancer : la fille voit plan.md, et part sans le .env (rappelé)'
  )
  await ui.shot('filles-non-commite-6-fille-voit')
}

async function noCommitRun(ui, git) {
  const noCommit = () => {
    try {
      git('rev-parse', '--verify', '--quiet', 'HEAD')
      return false
    } catch {
      return true
    }
  }
  await ui.ready()
  await ui.send('Écris le plan')
  await ui.ready()

  // Rôle qui écrit : la ligne dit « dans ce dossier », sans « dernier commit () » ni « Changer… ».
  await typeRoles(ui, '@front-architect construisez la page\n/scenario voit-le-plan')
  await ui.waitFor(`${ui.$('launch-line')}?.dataset.place === 'here'`, 10000)
  const line = await ui.ev(`${ui.$('role-destination')}.innerText`)
  check(
    line.includes(L('launchLine.noCommit.role')) &&
      !line.includes('()') &&
      !(await ui.ev(`!!${ui.$('launch-line-change')}`)),
    `dépôt sans commit : le rôle travaillera dans ce dossier, rien à choisir (${line})`
  )
  await ui.shot('filles-non-commite-7-sans-commit')
  await ui.enter()
  await ui.waitFor(`${reports}.length === 1`, 30000)
  check(
    (await ui.ev(`${leads}[0]`)).includes('je vois plan.md') &&
      noCommit() &&
      git('worktree', 'list').split('\n').length === 1,
    'dépôt sans commit : la fille travaille dans le dossier (elle voit le plan), ni worktree ni commit'
  )

  // Proposition de l'agent (`start_child`) : la même règle, dite sur la carte.
  await ui.send('Découpe la suite\n/scenario tache-plan')
  const pending = `document.querySelector('[data-testid=proposal-row][data-outcome=pending]')`
  await ui.waitFor(`!!${pending}`, 30000)
  await ui.waitFor(`!!${ui.$('proposals')}?.querySelector('[data-testid=launch-line]')`, 10000)
  check(
    (await ui.ev(`${ui.$('proposals')}.innerText`)).includes(L('launchLine.noCommit.works')),
    'Tâches proposées, dépôt sans commit : les travaux se feront dans ce dossier'
  )
  await ui.shot('filles-non-commite-8-sans-commit-proposition')
  await ui.click(`${pending}.querySelector('[data-testid=proposal-start]')`)
  await ui.waitFor(`${reports}.length === 2`, 30000)
  check(
    (await ui.ev(`${leads}[1]`)).includes('je vois plan.md') &&
      noCommit() &&
      git('worktree', 'list').split('\n').length === 1,
    'proposition lancée : dans le dossier, toujours aucun commit (jamais de commit vide)'
  )
}
