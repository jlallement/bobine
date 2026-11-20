import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Carte de groupe et fusion dans la carte (fiche 264, écrans C et D des maquettes de la fiche
 * 260), contre l'agent factice, dans un dépôt git jetable. Scénario `travaux-groupe` : trois
 * travaux proposés à la fois (un rôle qui écrit, un sans rôle, un avis) ; « Tout lancer » ; en
 * cours (retenus par le verrou de fin de tour), finis ; au réveil, l'agent recommande les deux
 * branches ; la carte les fusionne. Puis un travail qui écrit, demandé par une bulle `@rôle` :
 * « Fusionner dans main » dans sa carte. Captures `264-groupe-*` et `264-travail-ecrit-*`.
 */
export async function travauxGroupeSuite(scheme) {
  console.log(`\n— Carte de groupe et fusion dans la carte (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-travaux-')))
  const locks = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-travaux-verrou-')))
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
  /** Commit de tout un worktree, comme « Committer » ; réessayé si l'app lit l'index en même temps. */
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
      (ui) => groupRun(ui, { workspace, git, commitAll, turnLock }),
      undefined,
      'travaux-groupe',
      env
    )
    await withApp(scheme, (ui) => writerRun(ui, { workspace, git, commitAll }), undefined, 'echo', {
      BOBINE_WORKSPACE: workspace
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(locks, { recursive: true, force: true })
  }
}

const rows = `[...document.querySelectorAll('[data-testid=work-row]')]`

/** Tours retenus par le verrou de l'agent factice (une ligne chacun dans `<verrou>.retenus`). */
async function heldTurns(turnLock, count, timeoutMs = 30000) {
  const file = `${turnLock}.retenus`
  const read = () =>
    existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0
  const deadline = Date.now() + timeoutMs
  while (read() < count) {
    if (Date.now() > deadline) {
      throw new Error(`tours retenus par le verrou : ${read()} sur ${count} après ${timeoutMs} ms`)
    }
    await sleep(50)
  }
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
  await ui.waitFor(`document.querySelector('.history-item.active')?.dataset.id === '${mother}'`)
}

async function groupRun(ui, { workspace, git, commitAll, turnLock }) {
  await ui.ready()
  await ui.closePanel()
  await ui.send('/scenario echo Écris le carnet')
  await ui.ready()
  const mother = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)

  // 1 · Proposés : une seule carte, trois lignes, « Tout lancer ».
  await ui.send('Découpe la suite en travaux indépendants.')
  const group = ui.$('work-group')
  await ui.waitFor(`${group}?.dataset.pending === '3'`, 30000)
  check(
    (await ui.ev(`${ui.$('work-group-title')}.innerText`)) ===
      L('workGroup.titleProposed', { count: 3 }) &&
      (await ui.ev(
        `[...document.querySelectorAll('[data-testid=proposal-row]')].map((r) => r.dataset.title).join(' / ')`
      )) ===
        'Tri des articles par rayon / Tests de la sauvegarde locale / Relire l’accessibilité de l’écran' &&
      (await ui.ev(`!!${ui.$('work-group-start-all')}`)),
    'proposés : une carte de groupe, trois lignes (rôle, sans rôle, avis), « Tout lancer »'
  )
  await ui.reveal(group)
  await ui.shot('264-groupe-proposes')

  // 2 · En cours : retenus par le verrou ; la carte reste à sa place et change sur place.
  writeFileSync(turnLock, '')
  const place = await ui.ev(`${group}.previousElementSibling ? 1 : 0`)
  await ui.click(ui.$('work-group-start-all'))
  await ui.waitFor(`${rows}.length === 3`, 30000)
  await heldTurns(turnLock, 3)
  await ui.waitFor(`${rows}.every((r) => r.dataset.state === 'running')`, 15000)
  check(
    (await ui.ev(`document.querySelectorAll('[data-testid=work-group]').length`)) === 1 &&
      (await ui.ev(`${ui.$('work-group-counts')}.innerText`)).includes(
        L('workGroup.count.running', { count: 3 })
      ) &&
      (await ui.ev(`${group}.previousElementSibling ? 1 : 0`)) === place &&
      !(await ui.ev(
        `!!document.querySelector('[data-testid=subtasks], [data-testid=child-started], [data-testid=child-report]')`
      )),
    'en cours : la même carte, « 3 en cours », ni « Sous-tâches » ni lancement séparé'
  )
  await ui.reveal(group)
  await ui.shot('264-groupe-en-cours')
  rmSync(turnLock)

  // 3 · Finis : au réveil, l'agent recommande les deux branches ; l'avis se déplie sur sa réponse.
  await ui.waitFor(`${rows}.every((r) => r.dataset.state === 'replied')`, 60000)
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
  await commitAll(folders['Tri des articles par rayon'], 'feat: tri par rayon')
  await commitAll(folders['Tests de la sauvegarde locale'], 'test: sauvegarde locale')
  await reread(ui, mother, `${rows}[0]`)
  await ui.waitFor(
    `${ui.$('subtasks-merge-start')}?.innerText === ${JSON.stringify(L('workGroup.merge.recommended.action', { count: 2, base: 'main' }))}`,
    30000
  )
  const advice = `${rows}[2]`
  await ui.click(`${advice}.querySelector('[data-testid=work-row-toggle]')`)
  await ui.waitFor(`!!${advice}.querySelector('[data-testid=work-body]')`)
  check(
    (await ui.ev(`${ui.$('work-group-counts')}.innerText`)).includes(
      L('workGroup.count.done', { count: 3 })
    ) && (await ui.ev(`${advice}.querySelector('[data-testid=work-body]').innerText`)).length > 200,
    'finis : « 3 finis », l’avis déplié sur sa réponse entière, « Fusionner les 2 recommandés »'
  )
  await ui.reveal(group)
  await ui.shot('264-groupe-finis')

  // Fusion dans la carte : les deux branches, l'avis n'a rien à fusionner.
  await ui.click(ui.$('subtasks-merge-start'))
  await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'done'`, 60000)
  check(
    git(workspace, 'log', '--format=%s', 'main').includes('feat: tri par rayon') &&
      git(workspace, 'log', '--format=%s', 'main').includes('test: sauvegarde locale') &&
      (await ui.ev(`${group}.contains(${ui.$('subtasks-merge-result')})`)),
    'fusion : les deux branches dans main, le résultat dans la carte'
  )
  await ui.reveal(ui.$('subtasks-merge-result'))
  await ui.shot('264-groupe-fusionne-carte')
}

async function writerRun(ui, { workspace, git, commitAll }) {
  await ui.ready()
  await ui.closePanel()
  await ui.send('Bonjour')
  await ui.ready()
  const mother = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
  await ui.ev(`${ui.$('composer-input')}.focus()`)
  await ui.type('@front-architect Ajoute un tri des articles par rayon.\n/scenario rayons')
  await ui.press('Escape')
  await ui.waitFor(`!!${ui.$('role-destination')}`)
  await ui.enter()
  const card = `document.querySelector('[data-testid=work-card][data-role=front-architect]')`
  await ui.waitFor(`${card}?.dataset.state === 'replied'`, 30000)
  const [[folder, branch]] = await ui.ev(
    `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.workspace, c.branch]))`
  )
  // Le tri du groupe est déjà dans main (même dépôt) : ce travail-ci ajoute son ordre de tri.
  writeFileSync(join(folder, 'src', 'ordre.js'), "export const ORDRE = 'rayon'\n")
  await commitAll(folder, 'feat: rayons')
  // Revenir de sa conversation : la carte relit sa branche.
  await ui.click(`${card}.querySelector('[data-testid=work-open]')`)
  await ui.waitFor(`!!${ui.$('title-origin')}`)
  await ui.click(ui.$('title-origin'))
  await ui.waitFor(`document.querySelector('.history-item.active')?.dataset.id === '${mother}'`)
  const start = `${card}.querySelector('[data-testid=work-merge-start]')`
  await ui.waitFor(`!!${start}`, 30000)
  check(
    (await ui.ev(`${start}.innerText`)) === L('workMerge.action', { base: 'main' }) &&
      (await ui.ev(`!!${card}.querySelector('[data-testid=work-review]')`)) &&
      (await ui.ev(`!!${card}.querySelector('[data-testid=work-changes-open]')`)),
    'travail qui écrit : « Voir les modifications », « Faire relire », « Fusionner dans main »'
  )
  await ui.reveal(card)
  await ui.shot('264-travail-ecrit')
  await ui.click(start)
  await ui.waitFor(
    `${card}.querySelector('[data-testid=work-merge-result]')?.dataset.state === 'merged'`,
    60000
  )
  const result = await ui.ev(`${card}.querySelector('[data-testid=work-merge-result]').innerText`)
  check(
    result.includes(L('workMerge.doneCleaned', { base: 'main' })) &&
      git(workspace, 'log', '--format=%s', 'main').includes('feat: rayons') &&
      !!branch &&
      git(workspace, 'branch', '--list', branch) === '' &&
      !/bougé|tests de la branche/i.test(result),
    `fusionné dans la carte : « ${result.split('\n')[0]} », branche supprimée, aucune étape inventée`
  )
  await ui.reveal(card)
  await ui.shot('264-travail-ecrit-fusion')
}
