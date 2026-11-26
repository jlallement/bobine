import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, check, sleep, withApp } from '../lib.mjs'

const MOTHER = 'Carnet de courses'
/** Travaux du scénario `travaux-groupe` qui écrivent (le troisième est un avis en lecture seule). */
const SORT = 'Tri des articles par rayon'
const TESTS = 'Tests de la sauvegarde locale'

/**
 * Retouches de la recette Bricole (fiche 287), contre l'agent factice, dans un dépôt git jetable.
 * Rejoue les traces du journal de l'évaluation :
 * - 21:13 : « Fusionner le travail prêt » grisé sans raison → la raison au clavier (infobulle) ;
 * - 21:55 : « Committer puis fusionner » pendant que l'agent de la conversation écrit encore dans
 *   le dossier principal → refusé avant tout commit, la raison dite, aucun commit nulle part ;
 * - 02:05 : fusion puis « Nettoyer » depuis l'onglet Git d'une fille → sa ligne dans la carte de
 *   la mère dit « fusionné », plus sa recommandation d'avant.
 * Les contrôles ne lèvent pas : sur une version sans les correctifs, la suite va au bout et les
 * captures montrent l'« avant ». Captures `287-*`.
 */
export async function fillesRetouchesSuite(scheme) {
  console.log(`\n— Tâches filles : retouches de la recette (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-retouches-')))
  const locks = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-retouches-verrou-')))
  const turnLock = join(locks, 'verrou')
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), '# Carnet de courses\n')
  git(workspace, 'init', '-q', '-b', 'main')
  git(workspace, 'add', '.')
  git(workspace, 'commit', '-q', '-m', 'init')
  /** Commit de tout un dossier, comme « Committer » ; réessayé si l'app lit l'index en même temps. */
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
  const env = { BOBINE_WORKSPACE: workspace, MOCK_AGENT_TURN_LOCK: turnLock }
  try {
    await withApp(
      scheme,
      (ui) => run(ui, { workspace, git, commitAll, turnLock }),
      undefined,
      'travaux-groupe',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(locks, { recursive: true, force: true })
  }
}

const rows = `[...document.querySelectorAll('[data-testid=work-row]')]`
const rowOf = (title) =>
  `${rows}.find((r) => r.querySelector('[data-testid=work-row-name]')?.innerText === ${JSON.stringify(title)})`
const activeId = `document.querySelector('.history-item.active')?.dataset.id`

/** Tours retenus par le verrou de l'agent factice (une ligne chacun dans `<verrou>.retenus`). */
const heldCount = (turnLock) => {
  const file = `${turnLock}.retenus`
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0
}
async function heldTurns(turnLock, count, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (heldCount(turnLock) < count) {
    if (Date.now() > deadline)
      throw new Error(`tours retenus : ${heldCount(turnLock)} sur ${count}`)
    await sleep(50)
  }
}

/** Vrai si l'expression le devient à temps ; jamais d'exception (contrôle qui ne lève pas). */
const becomes = (ui, expression, ms = 15000) =>
  ui.waitFor(expression, ms).then(
    () => true,
    () => false
  )

/**
 * Amène le focus sur ce bouton au clavier (Maj+Tab puis Tab : `:focus-visible`, comme un
 * utilisateur), puis rend le texte de l'infobulle ouverte, ou `null`.
 */
async function keyboardTip(ui, selector) {
  await ui.reveal(selector)
  await ui.ev(`${selector}.focus(), true`)
  await ui.press('Tab', 8)
  await ui.press('Tab')
  const focused = await becomes(ui, `document.activeElement === ${selector}`, 3000)
  if (!focused) return null
  const opened = await becomes(ui, `!!document.querySelector('[role=tooltip]')`, 5000)
  return opened ? ui.ev(`document.querySelector('[role=tooltip]').textContent`) : null
}

/** Ouvre la conversation d'un travail puis revient : les cartes relisent les branches. */
async function reread(ui, mother, row) {
  const toggle = `${row}.querySelector('[data-testid=work-row-toggle]')`
  if ((await ui.ev(`${toggle}?.getAttribute('aria-expanded')`)) !== 'true') {
    await ui.reveal(toggle)
    await ui.click(toggle)
  }
  const open = `${row}.querySelector('[data-testid=work-open]')`
  await ui.waitFor(`!!${open}`)
  await ui.reveal(open)
  await ui.click(open)
  await ui.waitFor(`!!${ui.$('title-origin')}`)
  await ui.click(ui.$('title-origin'))
  await ui.waitFor(`${activeId} === '${mother}'`)
}

/** Titres entre guillemets de la langue, en liste : « A » et « B ». */
const titles = (list) =>
  new Intl.ListFormat(LANG, { type: 'conjunction' }).format(
    list.map((title) => L('childrenMerge.quote', { title }))
  )

async function run(ui, { workspace, git, commitAll, turnLock }) {
  await ui.ready()
  await ui.closePanel()
  await ui.send('/scenario echo Écris le carnet')
  await ui.ready()
  const mother = await ui.ev(activeId)
  await ui.ev(`window.api.conversations.rename('${mother}', ${JSON.stringify(MOTHER)})`)
  await ui.send('Découpe la suite en travaux indépendants.')
  const group = ui.$('work-group')
  await ui.waitFor(`${group}?.dataset.pending === '3'`, 30000)
  await ui.click(ui.$('work-group-start-all'))
  await ui.waitFor(
    `${rows}.length === 3 && ${rows}.every((r) => r.dataset.state === 'replied')`,
    60000
  )
  // Au réveil, l'agent recommande le tri, pas encore les tests.
  await ui.waitFor(
    `document.querySelectorAll('[data-testid=work-row] [data-testid=subtask-recommendation]').length === 2`,
    60000
  )
  await ui.ready()
  const folders = Object.fromEntries(
    await ui.ev(
      `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
    )
  )
  if (!folders[SORT] || !folders[TESTS]) throw new Error('worktrees des travaux introuvables')

  // 1 · 21:13 : rien de commité dans les travaux, « Fusionner » grisé ; il dit pourquoi, au clavier.
  await reread(ui, mother, rowOf(SORT))
  const start = ui.$('subtasks-merge-start')
  await ui.waitFor(`!!${start}`, 30000)
  const order = await ui.ev(
    `${rows}.map((r) => r.querySelector('[data-testid=work-row-name]')?.innerText).filter((t) => t === ${JSON.stringify(SORT)} || t === ${JSON.stringify(TESTS)})`
  )
  const why = L('childrenMerge.why.dirty', { count: 2, titles: titles(order) })
  const tip = await keyboardTip(ui, start)
  await ui.shot('287-fusion-grisee-raison')
  check(
    (await ui.ev(`${start}.getAttribute('aria-disabled')`)) === 'true' &&
      (await ui.ev(`${start}.getAttribute('aria-description')`)) === why &&
      tip === why,
    `« Fusionner » grisé : la raison au focus clavier, dans l’infobulle (« ${tip} »)`
  )

  // 2 · 21:55 : « Committer puis fusionner » pendant que l'agent de la conversation écrit encore
  // dans le dossier principal (tour retenu par le verrou, après ses écritures).
  await commitAll(folders[SORT], 'feat: tri par rayon')
  await commitAll(folders[TESTS], 'test: sauvegarde locale')
  writeFileSync(join(workspace, 'TODO.md'), '- [ ] relire\n')
  await reread(ui, mother, rowOf(SORT))
  await ui.waitFor(`!!${ui.$('main-dirty')}`, 30000)
  await ui.reveal(ui.$('main-dirty-commit'))
  await ui.click(ui.$('main-dirty-commit'))
  await ui.waitFor(`${ui.$('main-dirty-commit-draft')}?.dataset.state === 'agent'`, 15000)
  const heads = () => ({
    main: git(workspace, 'rev-parse', 'main'),
    sort: git(folders[SORT], 'rev-parse', 'HEAD'),
    tests: git(folders[TESTS], 'rev-parse', 'HEAD')
  })
  const before = heads()
  const held = heldCount(turnLock)
  writeFileSync(turnLock, '')
  // `modifications` : l'agent écrit README.md et src/app.js dans le dossier principal, puis le
  // verrou retient la fin de son tour.
  await ui.send('/scenario modifications')
  await heldTurns(turnLock, held + 1)
  const confirm = ui.$('main-dirty-commit-confirm')
  await ui.reveal(confirm)
  await ui.click(confirm)
  const refusal = L('worktreeCycle.error.turnRunning', { title: MOTHER })
  const said = await becomes(
    ui,
    `${ui.$('subtasks-merge-error')}?.innerText === ${JSON.stringify(refusal)}`
  )
  // Le temps qu'un commit ou une fusion partis à tort se voient dans le dépôt.
  await sleep(1500)
  const after = heads()
  await ui.ev(
    `(${ui.$('subtasks-merge-error')} ?? ${group})?.scrollIntoView({ block: 'center' }), true`
  )
  await ui.shot('287-committer-refuse-tour')
  check(said, `refusé avant tout commit, la raison dite (« ${refusal} »)`)
  check(
    JSON.stringify(after) === JSON.stringify(before) &&
      git(workspace, 'status', '--porcelain', '--', 'TODO.md') === '?? TODO.md',
    `aucun commit : ni dans le dossier principal, ni dans les worktrees des travaux (${JSON.stringify({ before, after })})`
  )
  rmSync(turnLock)
  await ui.ready()

  // 3 · 02:05 : fusion puis « Nettoyer » depuis l'onglet Git d'un travail (« Tests », pas
  // recommandé) ; l'utilisateur a d'abord commité le dossier principal.
  if (git(workspace, 'status', '--porcelain')) await commitAll(workspace, 'chore: carnet')
  const testsId = await ui.ev(`${rowOf(TESTS)}?.dataset.childId`)
  const toggle = `${rowOf(TESTS)}.querySelector('[data-testid=work-row-toggle]')`
  if ((await ui.ev(`${toggle}?.getAttribute('aria-expanded')`)) !== 'true') {
    await ui.reveal(toggle)
    await ui.click(toggle)
  }
  const open = `${rowOf(TESTS)}.querySelector('[data-testid=work-open]')`
  await ui.waitFor(`!!${open}`)
  await ui.reveal(open)
  await ui.click(open)
  await ui.waitFor(`${activeId} === '${testsId}'`)
  await ui.waitFor(`!!${ui.$('changes-toggle')}`, 15000)
  await ui.click(ui.$('changes-toggle'))
  await ui.waitFor(`!!${ui.$('changes-view-git')}`, 15000)
  await ui.click(ui.$('changes-view-git'))
  await ui.waitFor(`!!${ui.$('worktree-bar')}`)
  const merge = ui.$('worktree-merge')
  await ui.waitFor(`!${merge}.disabled && !${merge}.hasAttribute('aria-disabled')`, 15000)
  await ui.click(merge)
  await ui.waitFor(
    `${ui.$('worktree-state')}?.innerText === ${JSON.stringify(L('worktreeCycle.state.merged', { base: 'main' }))}`,
    30000
  )
  // L'onglet Git : « Fusionner » grisé dit aussi pourquoi (rien à fusionner), au clavier.
  const nothing = L('worktreeCycle.merge.nothing', { base: 'main' })
  const gitTip = await keyboardTip(ui, merge)
  await ui.shot('287-onglet-git-fusion-grisee')
  check(
    gitTip === nothing,
    `onglet Git : « Fusionner » grisé, la raison au clavier (« ${gitTip} »)`
  )
  await ui.waitFor(`!!${ui.$('worktree-cleanup')}`)
  await ui.click(ui.$('worktree-cleanup'))
  await ui.waitFor(`!!${ui.$('worktree-cleanup-ask')}`)
  await ui.click(ui.$('worktree-cleanup-confirm'))
  await ui.waitFor(`${activeId} !== '${testsId}'`, 20000)
  if ((await ui.ev(activeId)) !== mother) {
    const item = `document.querySelector('[data-testid=history-item][data-id="${mother}"]')`
    await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
    await ui.waitFor(`${activeId} === '${mother}'`)
  }
  const badge = `${rowOf(TESTS)}?.querySelector('[data-testid=subtask-merge-state]')`
  const merged = await becomes(ui, `${badge}?.dataset.state === 'merged'`, 20000)
  await ui.ev(`${rowOf(TESTS)}?.scrollIntoView({ block: 'center' }), true`)
  await ui.shot('287-carte-apres-nettoyage-onglet-git')
  check(
    merged &&
      !(await ui.ev(`!!${rowOf(TESTS)}?.querySelector('[data-testid=subtask-recommendation]')`)),
    `fusionné et nettoyé depuis l’onglet Git : la carte de la mère dit « fusionné » (« ${await ui.ev(`${rowOf(TESTS)}?.querySelector('[data-testid=work-row-state], [data-testid=subtask-merge-state], [data-testid=subtask-recommendation]')?.innerText`)} »)`
  )
}
