import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Message de commit rédigé par l'agent (fiche 246, ADR-0056), dans un dépôt git jetable, contre
 * l'agent factice :
 * 1. « Committer » dans la vue Git d'une mère : le message est rédigé par l'agent (session à part,
 *    rien dans le fil), modifiable ; puis D4 : « Committer puis fusionner » depuis la carte du
 *    travail (fiche 264) — la vue Git ouverte se relit d'elle-même, sans « Actualiser ».
 * 2. Agent qui ne répond pas (`MOCK_AGENT_COMMIT=message-commit-lent`, délai raccourci) :
 *    « Rédaction par… », puis le repli en anglais déduit des fichiers et sa raison ; « Réessayer »
 *    relance un agent, qui tombe à son tour au délai.
 * 3. Même agent, délai habituel : « Arrêter » pendant la rédaction. Aucun processus de rédaction
 *    ne survit.
 */
export async function commitRedigeSuite(scheme) {
  console.log(`\n— Message de commit rédigé par l’agent (${scheme})`)
  await withMergeCard(scheme)
}

function repo(prefix) {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd,
      encoding: 'utf8'
    }).trim()
  mkdirSync(join(workspace, 'public'))
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  writeFileSync(
    join(workspace, 'public', 'app.js'),
    "const list = document.getElementById('books')\n"
  )
  git(workspace, 'init', '-q', '-b', 'main')
  git(workspace, 'add', '.')
  git(workspace, 'commit', '-q', '-m', 'init')
  git(workspace, 'config', 'user.name', 'e2e')
  git(workspace, 'config', 'user.email', 'e2e@example.invalid')
  /** Le travail de la conversation, pas encore commité. */
  const work = () => {
    writeFileSync(
      join(workspace, 'public', 'app.js'),
      "const list = document.getElementById('books')\nconst select = document.getElementById('status')\n"
    )
    writeFileSync(join(workspace, 'public', 'filters.js'), 'export const statuses = []\n')
  }
  const pids = join(mkdtempSync(join(tmpdir(), 'bob-e2e-commit-pids-')), 'pids')
  writeFileSync(pids, '')
  return { workspace, git, work, pids }
}

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const pidsIn = (file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map(Number)

/** Processus lancés depuis `before` (agents des rédactions) : tous finissent, sans orphelin. */
async function draftAgentsGone(file, before) {
  const started = Date.now()
  for (;;) {
    const fresh = pidsIn(file).filter((pid) => !before.includes(pid))
    if (fresh.every((pid) => !alive(pid))) return fresh
    if (Date.now() - started > 10_000) return fresh.filter(alive).map((pid) => -pid)
    await sleep(100)
  }
}

/** Panneau, onglet Modifications (« + » s'il a été fermé), vue Git. */
async function openGitView(ui) {
  const tab = `document.querySelector('.side-panel-tab[data-tab=changes]')`
  if (!(await ui.ev(`!!${ui.$('side-panel')}`))) await ui.click(ui.$('panel-toggle'))
  await ui.waitFor(`!!${ui.$('side-panel')}`)
  if (await ui.ev(`!!${tab}`)) await ui.click(tab)
  else {
    await ui.click(ui.$('panel-more'))
    await ui.waitFor(`!!${ui.$('panel-more-menu')}`)
    await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=changes]')`)
  }
  await ui.waitFor(`!!${ui.$('changes-view-git')}`)
  await ui.click(ui.$('changes-view-git'))
}

async function withMergeCard(scheme) {
  const { workspace, git, work, pids } = repo('bob-e2e-commit-redige-')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario echo Ajoute le filtre par statut')
        await ui.ready()
        const mother = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        // Une fille, dans son worktree, qui a commité son travail.
        await ui.ev(
          `window.api.conversations.startChild('${mother}', ${JSON.stringify({ title: 'Page d’aide', text: '/scenario echo Page d’aide' })}).then(() => true)`
        )
        // Sa carte seule (fiche 264) : « Fusionner dans main » s'y fera.
        await ui.waitFor(
          `document.querySelector('[data-testid=work-card]')?.dataset.state === 'replied'`,
          60000
        )
        const [help] = await ui.ev(
          `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => c.workspace))`
        )
        writeFileSync(join(help, 'AIDE.md'), '# Aide\n')
        git(help, 'add', '-A')
        git(help, 'commit', '-q', '-m', 'docs: aide')
        // Revenir à la mère depuis la fille : la carte relit les branches.
        const open = `document.querySelector('[data-testid=work-card] [data-testid=work-open]')`
        await ui.reveal(open)
        // Lien ordinaire : cliqué sans viser (la carte grandit quand sa branche est lue).
        await ui.ev(`${open}.click()`)
        await ui.waitFor(`!!${ui.$('title-origin')}`)
        await ui.click(ui.$('title-origin'))
        await ui.waitFor(
          `document.querySelector('.history-item.active')?.dataset.id === '${mother}'`
        )

        // La mère a travaillé dans le dossier principal, sans committer.
        work()
        await openGitView(ui)
        const commitButton = `${ui.$('changes-commit')}?.innerText`
        await ui.waitFor(
          `${commitButton} === ${JSON.stringify(L('worktreeCycle.commit.actionCount', { count: 2 }))}`,
          15000
        )
        const before = pidsIn(pids)
        await ui.click(ui.$('changes-commit'))
        await ui.waitFor(`${ui.$('changes-commit-draft')}?.dataset.state === 'agent'`, 15000)
        await ui.shot('246-message-redige')
        await draftAgentsGone(pids, before)
        await ui.click(ui.$('changes-commit-cancel'))

        // D4 : « Committer puis fusionner » depuis la carte, la vue Git restant ouverte. Le dossier
        // principal est modifié : la carte refuse la fusion d'avance (fiche 123).
        await ui.waitFor(`!!${ui.$('main-dirty')}`, 20000)
        await ui.reveal(ui.$('main-dirty-commit'))
        await ui.click(ui.$('main-dirty-commit'))
        await ui.waitFor(`${ui.$('main-dirty-commit-draft')}?.dataset.state === 'agent'`, 15000)
        await ui.click(ui.$('main-dirty-commit-confirm'))
        await ui.waitFor(
          `document.querySelector('[data-testid=work-merge-result]')?.dataset.state === 'merged'`,
          30000
        )
        // Sans « Actualiser » : la vue Git se relit d'elle-même (évènement `changes:gitChanged`).
        await ui.waitFor(`!${ui.$('changes-commit')}`, 10000)
        // La puce de branche sous la saisie aussi : plus de point « non commité ».
        await ui.waitFor(`${ui.$('git-branch')}?.dataset.dirty !== 'true'`, 10000)
        check(
          git(workspace, 'status', '--porcelain') === '' &&
            git(workspace, 'log', '-2', '--format=%s').includes(
              'feat: update app.js and filters.js'
            ) &&
            (await ui.ev(`!${ui.$('changes-commit')}`)) &&
            (await ui.ev(`${ui.$('git-branch')}?.dataset.dirty !== 'true'`)),
          'D4 : après « Committer puis fusionner », la vue Git et la puce de branche sont à jour sans « Actualiser »'
        )
        await ui.shot('246-vue-git-a-jour')
      },
      undefined,
      'echo',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_PID_FILE: pids }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
