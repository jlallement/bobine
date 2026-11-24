import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

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
  const { workspace, git } = repository()
  try {
    await withApp(scheme, (ui) => roleRun(ui, git), undefined, 'echo', {
      BOBINE_WORKSPACE: workspace
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
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
// Réponses dans l'ordre du fil : cartes-réponses (bulle « @Rôle … », fiche 263) et lignes des
// cartes de groupe dépliées (fiche 264).
const reports = `[...document.querySelectorAll('[data-testid=work-answer]')]`
const leads = `${reports}.map((r) => r.innerText ?? '')`
/** Lignes des cartes de groupe qui ont répondu, dépliées sur leur réponse (fiche 264). */
async function unfold(ui, count) {
  const replied = `[...document.querySelectorAll('[data-testid=work-row][data-state=replied]')]`
  await ui.waitFor(`${replied}.length === ${count}`, 30000)
  await ui.ev(
    `${replied}.forEach((r) => { const b = r.querySelector('[data-testid=work-row-toggle][aria-expanded=false]'); if (b) b.click() })`
  )
}

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
  await change(ui, 'launch-line-show', 'filles-non-commite-1b-menu')
  await ui.shot('filles-non-commite-1-ligne')

  // Entrée envoie, avec le choix affiché : la fille part du commit, sans le plan (R2).
  await ui.enter()
  await ui.waitFor(`!!${ui.$('work-card')}`, 30000)
  await ui.waitFor(`${reports}.length === 1`, 30000)
  check(
    (await ui.ev(`${leads}[0]`)).includes('je ne trouve pas plan.md'),
    'Entrée : partie sans elles, la fille ne voit pas le travail non commité'
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
  await ui.shot('filles-non-commite-3-avis')
  await ui.enter()
  // Deux rôles d'un message : une carte de groupe sous la bulle (fiche 264).
  await unfold(ui, 2)
  await ui.waitFor(`${reports}.length === 3`, 30000)
}
