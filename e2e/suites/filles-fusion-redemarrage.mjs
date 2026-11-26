import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, sleep, withApp } from '../lib.mjs'

const README = '# Démo\n\nVersion 1\n\n## Utilisation\n'
/** Ce qu'écrit le scénario `conflits` de l'agent factice quand on lui demande de résoudre. */
const RESOLVED = '# Démo\n\nVersion 2 et 3\n\n## Utilisation\n\nLancer `node src/app.js`.\n'
const MOTHER = 'Organise le carnet'

/**
 * Fiche 289, rapport du testeur (T11) : l'app se ferme pendant le tour où l'agent résout le
 * conflit (marqueurs déjà retirés, tour retenu par le verrou de l'agent factice). Au redémarrage,
 * « Fusionner » ne fait rien entrer dans main : la résolution s'arrête « à relire » ; le clic
 * suivant la fusionne. Vrai dépôt git jetable, scénarios `fusion-trois` et `conflits`.
 */
export async function fillesFusionRedemarrageSuite(scheme) {
  console.log(`\n— Fusion : redémarrage pendant la résolution d’un conflit (${scheme})`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-redemarrage-')))
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-redemarrage-data-'))
  const locks = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-redemarrage-verrou-')))
  const turnLock = join(locks, 'verrou')
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(workspace, 'README.md'), README)
  git(workspace, 'init', '-q', '-b', 'main')
  git(workspace, 'add', '.')
  git(workspace, 'commit', '-q', '-m', 'init')
  git(workspace, 'config', 'user.name', 'e2e')
  git(workspace, 'config', 'user.email', 'e2e@example.invalid')
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
  const held = () =>
    existsSync(`${turnLock}.retenus`)
      ? readFileSync(`${turnLock}.retenus`, 'utf8').split('\n').filter(Boolean).length
      : 0
  const env = { BOBINE_WORKSPACE: workspace, MOCK_AGENT_TURN_LOCK: turnLock }
  let mainAtTurn = ''
  let help = ''
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send(`/scenario echo ${MOTHER}`)
        await ui.ready()
        await ui.send('/scenario fusion-trois')
        await ui.waitFor(`!!${ui.$('work-group-start-all')}`, 30000)
        const mother = await ui.ev(`document.querySelector('.history-item.active')?.dataset.id`)
        await ui.ev(`window.api.conversations.rename('${mother}', ${JSON.stringify(MOTHER)})`)
        await ui.click(ui.$('work-group-start-all'))
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=work-row][data-state=replied]').length === 3`,
          60000
        )
        await ui.ready()
        const folders = Object.fromEntries(
          await ui.ev(
            `window.api.conversations.get().then((s) => s.conversations.filter((c) => c.startedFrom?.id === '${mother}').map((c) => [c.title, c.workspace]))`
          )
        )
        help = folders['Page d’aide']
        if (!folders['Import CSV'] || !help || !folders['Notes de version']) {
          throw new Error('worktrees des travaux introuvables')
        }
        await commitAll(folders['Import CSV'], 'feat: import CSV')
        writeFileSync(join(help, 'README.md'), '# Démo\n\nVersion 3\n\n## Utilisation\n')
        await commitAll(help, 'docs: page d’aide')
        writeFileSync(join(folders['Notes de version'], 'NOTES.md'), '# Notes de version\n')
        await commitAll(folders['Notes de version'], 'docs: notes de version')
        // La carte relit les branches quand on revient à la mère.
        const row = `document.querySelector('[data-testid=work-row]')`
        await ui.reveal(`${row}.querySelector('[data-testid=work-row-toggle]')`)
        await ui.click(`${row}.querySelector('[data-testid=work-row-toggle]')`)
        await ui.waitFor(`!!${row}.querySelector('[data-testid=work-open]')`)
        await ui.click(`${row}.querySelector('[data-testid=work-open]')`)
        await ui.waitFor(`!!${ui.$('title-origin')}`)
        await ui.click(ui.$('title-origin'))
        // Les trois branches relues (commits faits) : le bouton les prend toutes.
        await ui.waitFor(
          `${ui.$('subtasks-merge-start')}?.innerText === ${JSON.stringify(L('workGroup.merge.action', { count: 3, base: 'main' }))}`,
          30000
        )
        // Le tour de résolution sera retenu par le verrou, ses écritures faites.
        const before = held()
        writeFileSync(turnLock, '')
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.click(ui.$('subtasks-merge-start'))
        // Le tour retenu est celui de la résolution : ses écritures faites (un autre tour, le réveil
        // de la mère, peut être retenu aussi).
        const resolved = () =>
          existsSync(join(help, 'README.md')) &&
          readFileSync(join(help, 'README.md'), 'utf8') === RESOLVED
        for (let i = 0; i < 600 && !(held() > before && resolved()); i++) await sleep(100)
        mainAtTurn = git(workspace, 'rev-parse', 'main')
        check(
          held() > before && readFileSync(join(help, 'README.md'), 'utf8') === RESOLVED,
          'tour de résolution retenu, marqueurs déjà retirés par l’agent'
        )
        // L'app se ferme ici, le tour toujours en cours.
      },
      userData,
      'conflits',
      env
    )
    unlinkSync(turnLock)

    await withApp(
      scheme,
      async (ui) => {
        const item = `[...document.querySelectorAll('[data-testid=history-item]')].find((r) => r.innerText.includes(${JSON.stringify(MOTHER)}))`
        await ui.waitFor(`!!${item}`, 20000)
        await ui.click(`${item}.querySelector('.history-open') ?? ${item}`)
        const start = ui.$('subtasks-merge-start')
        await ui.waitFor(`!!${start} && !${start}.hasAttribute('aria-disabled')`, 30000)
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.click(start)
        await ui.waitFor(
          `['review', 'done'].includes(${ui.$('subtasks-merge-result')}?.dataset.status)`,
          60000
        )
        check(
          (await ui.ev(`${ui.$('subtasks-merge-result')}?.dataset.status`)) === 'review' &&
            git(workspace, 'rev-parse', 'main') === mainAtTurn &&
            readFileSync(join(workspace, 'README.md'), 'utf8') !== RESOLVED,
          'après redémarrage, « Fusionner » s’arrête « à relire » : rien de la résolution dans main'
        )
        await ui.ev(`${ui.$('work-group')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('289-redemarrage-a-relire')
        // Après relecture, le clic suivant fusionne.
        await ui.waitFor(`!!${start} && !${start}.hasAttribute('aria-disabled')`, 30000)
        await ui.click(start)
        await ui.waitFor(`${ui.$('subtasks-merge-result')}?.dataset.status === 'done'`, 60000)
        check(
          readFileSync(join(workspace, 'README.md'), 'utf8') === RESOLVED &&
            existsSync(join(workspace, 'NOTES.md')),
          'au clic suivant : main a la résolution et les travaux restants'
        )
      },
      userData,
      'conflits',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
    rmSync(locks, { recursive: true, force: true })
  }
}
