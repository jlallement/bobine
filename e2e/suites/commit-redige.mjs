import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Message de commit rédigé par l'agent (fiche 246, ADR-0056), dans un dépôt git jetable, contre
 * l'agent factice :
 * 1. « Committer » dans la vue Git d'une mère : le message est rédigé par l'agent (session à part,
 *    rien dans le fil), modifiable ; puis D4 : « Committer puis fusionner » depuis la carte
 *    « Sous-tâches » — la vue Git ouverte se relit d'elle-même, sans « Actualiser ».
 * 2. Agent qui ne répond pas (`MOCK_AGENT_COMMIT=message-commit-lent`, délai raccourci) :
 *    « Rédaction par… », puis le repli en anglais déduit des fichiers et sa raison ; « Réessayer »
 *    puis « Arrêter ». Aucun processus de rédaction ne survit.
 */
export async function commitRedigeSuite(scheme) {
  console.log(`\n— Message de commit rédigé par l’agent (${scheme})`)
  await withMergeCard(scheme)
  await withSlowAgent(scheme)
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

const userMessages = (ui) => ui.ev(`document.querySelectorAll('.msg-user').length`)

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
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=child-report]').length === 1`,
          60000
        )
        const [help] = await ui.ev(
          `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => c.workspace))`
        )
        writeFileSync(join(help, 'AIDE.md'), '# Aide\n')
        git(help, 'add', '-A')
        git(help, 'commit', '-q', '-m', 'docs: aide')
        // Revenir à la mère depuis la fille : la carte relit les branches.
        const open = `document.querySelector('[data-testid=subtask-row] [data-testid=subtask-open]')`
        await ui.reveal(open)
        await ui.click(open)
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
        const said = await userMessages(ui)
        await ui.click(ui.$('changes-commit'))
        await ui.waitFor(`${ui.$('changes-commit-draft')}?.dataset.state === 'agent'`, 15000)
        const message = await ui.ev(`${ui.$('changes-commit-message')}.value`)
        check(
          message.startsWith('feat: update app.js and filters.js\n\nMock agent draft: 2 file(s)') &&
            message.includes('first request received'),
          `message rédigé par l’agent, d’après les fichiers cochés et la demande de départ (${JSON.stringify(message.split('\n')[0])})`
        )
        // « Rédigé par Agent factice en N s, d'après 2 fichiers » : la durée varie.
        const [head, tail] = L('worktreeCycle.commit.draft.receivedNoMemory', {
          agent: L('profiles.mock.label'),
          count: 2,
          seconds: '§'
        }).split('§')
        const line = await ui.ev(`${ui.$('changes-commit-draft')}.innerText`)
        check(
          line.startsWith(head) &&
            line.includes(tail) &&
            !(await ui.ev(`${ui.$('changes-commit-confirm')}.disabled`)),
          `« Rédigé par Agent factice… », « Committer » disponible (${JSON.stringify(line)})`
        )
        check(
          (await userMessages(ui)) === said,
          'rien dans le fil : la rédaction se fait dans une session à part'
        )
        await ui.shot('246-message-redige')
        const gone = await draftAgentsGone(pids, before)
        check(
          gone.length === 1 && gone.every((pid) => pid > 0),
          `l’agent de la rédaction est arrêté après la réponse (${gone.join(', ')})`
        )
        await ui.click(ui.$('changes-commit-cancel'))

        // D4 : « Committer puis fusionner » depuis la carte, la vue Git restant ouverte.
        await ui.reveal(ui.$('subtasks-merge-start'))
        await ui.click(ui.$('subtasks-merge-start'))
        await ui.waitFor(`!!${ui.$('main-dirty')}`, 20000)
        await ui.click(ui.$('main-dirty-commit'))
        await ui.waitFor(`${ui.$('main-dirty-commit-draft')}?.dataset.state === 'agent'`, 15000)
        await ui.click(ui.$('main-dirty-commit-confirm'))
        await ui.waitFor(
          `document.querySelector('[data-testid=subtask-merge-state]')?.dataset.state === 'merged'`,
          30000
        )
        // Sans « Actualiser » : la vue Git se relit d'elle-même (évènement `changes:gitChanged`).
        await ui.waitFor(`!${ui.$('changes-commit')}`, 10000)
        check(
          git(workspace, 'status', '--porcelain') === '' &&
            git(workspace, 'log', '-2', '--format=%s').includes(
              'feat: update app.js and filters.js'
            ) &&
            (await ui.ev(`!${ui.$('changes-commit')}`)),
          'D4 : après « Committer puis fusionner », la vue Git est à jour sans « Actualiser »'
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

async function withSlowAgent(scheme) {
  const { workspace, git, work, pids } = repo('bob-e2e-commit-lent-')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario echo Ajoute le filtre par statut')
        await ui.ready()
        work()
        await openGitView(ui)
        await ui.waitFor(`!!${ui.$('changes-commit')}`, 15000)
        const before = pidsIn(pids)
        await ui.click(ui.$('changes-commit'))
        const state = `${ui.$('changes-commit-draft')}?.dataset.state`
        await ui.waitFor(`${state} === 'drafting'`, 10000)
        check(
          (await ui.ev(`${ui.$('changes-commit-draft')}.innerText`)).startsWith(
            L('worktreeCycle.commit.draft.drafting', { agent: L('profiles.mock.label') })
          ) &&
            (await ui.ev(`${ui.$('changes-commit-message')}.disabled`)) &&
            (await ui.ev(`${ui.$('changes-commit-confirm')}.disabled`)),
          'rédaction en cours : « Rédaction par Agent factice… », champ en attente, « Committer » désactivé'
        )
        await ui.shot('246-redaction-en-cours')
        // Pas de réponse dans le délai (4 s ici) : le repli.
        await ui.waitFor(`${state} === 'fallback'`, 15000)
        const fallback =
          'chore: update app.js and filters.js\n\n- public/app.js\n- public/filters.js (new)'
        check(
          (await ui.ev(`${ui.$('changes-commit-message')}.value`)) === fallback &&
            (await ui.ev(`${ui.$('changes-commit-draft')}.dataset.reason`)) === 'timeout' &&
            (await ui.ev(`${ui.$('changes-commit-draft')}.innerText`)).startsWith(
              L('worktreeCycle.commit.draft.reason.timeout', {
                agent: L('profiles.mock.label'),
                seconds: 4
              })
            ),
          'délai dépassé : message en anglais déduit des fichiers, la raison dite'
        )
        await ui.shot('246-repli')
        // « Réessayer », puis « Arrêter » : la rédaction s'arrête, le repli revient.
        await ui.click(ui.$('changes-commit-draft-again'))
        await ui.waitFor(`${state} === 'drafting'`, 10000)
        await sleep(500)
        await ui.click(ui.$('changes-commit-draft-stop'))
        await ui.waitFor(`${state} === 'fallback'`, 10000)
        check(
          (await ui.ev(`${ui.$('changes-commit-draft')}.dataset.reason`)) === 'stopped',
          '« Arrêter » : rédaction arrêtée, message déduit des fichiers'
        )
        const gone = await draftAgentsGone(pids, before)
        check(
          gone.length === 2 && gone.every((pid) => pid > 0),
          `délai dépassé puis « Arrêter » : aucun agent de rédaction ne survit (${gone.join(', ')})`
        )
        await ui.click(ui.$('changes-commit-confirm'))
        await ui.waitFor(`!!${ui.$('changes-commit-undo')}`, 15000)
        check(
          git(workspace, 'log', '-1', '--format=%s') === 'chore: update app.js and filters.js',
          'commit fait avec le message du repli'
        )
      },
      undefined,
      'echo',
      {
        BOBINE_WORKSPACE: workspace,
        MOCK_AGENT_PID_FILE: pids,
        MOCK_AGENT_COMMIT: 'message-commit-lent',
        BOBINE_COMMIT_DRAFT_TIMEOUT_MS: '4000'
      }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
