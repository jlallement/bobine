import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * `@Code reviewer` « Relis ce qui a été fait » après une fusion (fiche 267, recette N1 et N2) : la
 * portée d'office est celle des commits de la conversation — pas le dernier commit, ici un commit
 * de fusion de `main` dans la branche d'un travail, qui n'apporte qu'un côté. La carte dit ce qui a
 * été relu ; un clic sur `fichier:ligne` ouvre le diff relu (début et fin de la plage), et dit quand
 * le fichier a changé depuis. Dépôt git jetable rejouant celui de la recette ; l'agent factice joue
 * `relecture` pour le relecteur (consigne reconnue). Captures `267-relecture-*`.
 */
export async function relectureCommitsSuite(scheme) {
  console.log(`\n— Relecture des commits de la conversation (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-relecture-commits-'))
  // Le commit d'avant la conversation : daté de la veille (git compte à la seconde).
  const yesterday = `@${Math.floor(Date.now() / 1000) - 86_400} +0000`
  const git = (args, date) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {})
      }
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Courses\n')
  git(['init', '-q', '-b', 'main'])
  git(['add', '.'])
  git(['commit', '-q', '-m', 'init'], yesterday)
  try {
    await withApp(scheme, (ui) => run(ui, { workspace, git }), undefined, 'echo', {
      BOBINE_WORKSPACE: workspace
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

const card = `document.querySelector('[data-testid=work-card][data-role=code-reviewer]')`
const input = `document.querySelector('[data-testid="composer-input"]')`

async function run(ui, { workspace, git }) {
  await ui.ready()
  await ui.send('Bonjour')
  await ui.ready()
  // Les commits faits pendant la conversation (après sa création, à la seconde près).
  await sleep(1100)
  const init = git(['rev-parse', 'HEAD'])
  const commit = (file, content, message) => {
    mkdirSync(join(workspace, 'src'), { recursive: true })
    writeFileSync(join(workspace, file), content)
    git(['add', '.'])
    git(['commit', '-q', '-m', message])
  }
  commit('src/app.js', 'export function main() {\n  console.log("bonjour")\n}\n', 'feat: app')
  // Deux travaux : l'édition sur sa branche, le thème sombre sur main ; puis, comme dans la
  // recette, main fusionné dans la branche du travail (premier parent : la branche) et main avancé.
  git(['checkout', '-q', '-b', 'bobine/edition'])
  commit('src/storage.js', 'export const save = () => {}\n', 'feat: edition')
  git(['checkout', '-q', 'main'])
  commit('src/style.css', 'body { color: black }\n', 'feat: theme')
  git(['checkout', '-q', 'bobine/edition'])
  git(['merge', '-q', '--no-ff', '-m', "Merge branch 'main' into bobine/edition", 'main'])
  git(['checkout', '-q', 'main'])
  git(['merge', '-q', '--ff-only', 'bobine/edition'])
  const head = git(['rev-parse', 'HEAD'])
  check(
    git(['diff', '--name-only', `${head}^1`, head]) === 'src/style.css',
    'le dernier commit est la fusion : contre son premier parent, le thème seul (ce que la recette relisait)'
  )

  await ui.ev(`${input}.focus()`)
  await ui.type('@code-reviewer Relis ce qui a été fait.')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  await ui.waitFor(`${card}?.dataset.state === 'replied'`, 30000)
  await ui.waitFor(`${card}.dataset.findings === '2'`, 30000)
  const scope = await ui.ev(`${card}.querySelector('[data-testid=work-review-scope]')?.innerText`)
  const expected = L('review.read.commits', {
    commits: L('review.scope.commits', { count: 4 }),
    files: L('review.card.files', { count: 3 }),
    range: L('review.scope.range', { from: init.slice(0, 7), to: head.slice(0, 7) })
  })
  check(
    scope === expected,
    `la carte dit ce qui a été relu : « ${scope} » (attendu « ${expected} »)`
  )
  await ui.reveal(card)
  await ui.shot('267-relecture-portee')

  // `fichier:ligne` : le diff relu, de init à la fusion, la ligne mise en avant.
  await ui.click(
    `${card}.querySelector('[data-testid=work-finding] [data-testid=work-finding-where]')`
  )
  const block = `document.querySelector('[data-testid=review-file-diff]')`
  await ui.waitFor(`!!${block}?.querySelector('tr.diff-focus')`, 20000)
  const shown = await ui.ev(`(() => ({
    reviewed: ${block}.dataset.reviewed !== undefined,
    head: ${block}.querySelector('.review-file-diff-head')?.innerText,
    changed: !!${block}.querySelector('[data-testid=review-file-changed]')
  }))()`)
  check(
    shown.reviewed &&
      shown.head ===
        L('review.fileDiffReviewed', {
          path: 'src/app.js',
          range: L('review.scope.range', { from: init.slice(0, 7), to: head.slice(0, 7) })
        }) &&
      !shown.changed,
    `clic sur \`fichier:ligne\` : le diff relu, jamais « Aucune modification » (${JSON.stringify(shown)})`
  )
  await ui.shot('267-relecture-diff-relu')

  // Corrigé depuis (non commité) : la vue montre toujours ce qui a été relu, et le dit.
  writeFileSync(
    join(workspace, 'src/app.js'),
    'export function main(name) {\n  console.log(`bonjour ${name}`)\n}\n'
  )
  await ui.click(
    `[...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(L('changes.refresh'))})`
  )
  await ui.waitFor(`!!${block}?.querySelector('[data-testid=review-file-changed]')`, 20000)
  // « Actualiser » est au bout d'une barre plus large que le panneau à cette largeur : son clic
  // fait défiler le panneau de côté (constat à part, hors de cette fiche) ; on le remet.
  await ui.ev(
    `[...document.querySelectorAll('*')].filter((e) => e.scrollLeft > 0).forEach((e) => (e.scrollLeft = 0))`
  )
  check(
    (await ui.ev(`${block}.innerText`)).includes('console.log("bonjour")'),
    'corrigé depuis : le diff relu reste, la vue dit que le fichier a changé'
  )
  await ui.shot('267-relecture-corrige-depuis')
}
