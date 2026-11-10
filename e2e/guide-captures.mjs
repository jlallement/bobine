/**
 * Captures du guide de l'utilisateur (fiche 186), en thème clair, contre l'app buildée et l'agent
 * factice. Les images vont dans `docs/guide/images/<langue>/`, celles que citent les pages :
 *
 *   pnpm build && node e2e/guide-captures.mjs              français
 *   pnpm build && node e2e/guide-captures.mjs --lang en    anglais
 *
 * Ce n'est pas une suite : rien n'est vérifié ici au-delà de ce qu'il faut pour arriver à l'écran
 * voulu (les suites `aparte`, `worktree-setup`, `scheduled`, `permissions` le vérifient). À relancer
 * quand l'interface montrée change.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, captures, root, withApp } from './lib.mjs'

const SCHEME = 'light'
// Nom du dossier de projet affiché sous la zone de saisie et dans les tâches.
const PROJECT = LANG === 'fr' ? 'mon-projet' : 'my-project'
const out = join(root, 'docs', 'guide', 'images', LANG)
mkdirSync(out, { recursive: true })

/** Capture de l'app, copiée sous son nom dans le guide (`ui.shot` écrit dans `e2e/captures`). */
async function shot(ui, name) {
  await ui.shot(`guide-${name}`)
  const file = `${LANG === 'fr' ? '' : `${LANG}-`}guide-${name}-${SCHEME}.png`
  copyFileSync(join(captures, file), join(out, `${name}.png`))
  console.log(`  ✓ ${name}.png`)
}

/** Dossier de projet jetable, en dépôt git avec un commit. */
function project(name, files = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-guide-')))
  const dir = join(base, name)
  mkdirSync(dir)
  for (const [path, content] of Object.entries({ 'README.md': '# Démo\n', ...files })) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'user.name=guide', '-c', 'user.email=guide@example.invalid', ...args],
      {
        cwd: dir
      }
    )
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return { dir, base, git }
}

const sizes = (ui) => ui.viewport(1280, 800)

// 1. Accueil (premiers pas) et demande d'autorisation (conversations).
{
  const { dir, base } = project(PROJECT)
  try {
    await withApp(
      SCHEME,
      async (ui) => {
        await sizes(ui)
        await ui.ready()
        await ui.closePanel()
        await ui.waitFor(`!!${ui.$('welcome')}`)
        await shot(ui, 'premiers-pas-accueil')

        await ui.send(LANG === 'en' ? 'Change the configuration' : 'Modifie la configuration')
        await ui.waitFor(`!!${ui.$('permission')}`, 20_000)
        await shot(ui, 'conversations-autorisation')

        // Aparté pendant le tour (fiche 180).
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type(
          LANG === 'en' ? '/btw What does this flag do again?' : '/btw C’est quoi déjà ce flag ?'
        )
        await ui.waitFor(`!${ui.$('command-menu')}`)
        await ui.enter()
        await ui.waitFor(
          `${ui.$('aside-card')}?.dataset.status === 'ready' && !!${ui.$('aside-answer')}`,
          20_000
        )
        await shot(ui, 'aparte-carte')
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: dir }
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

// 2. Préparation d'un worktree en attente d'accord (fiche 175).
{
  const { dir, base } = project(PROJECT, {
    '.gitignore': '.env\n',
    '.worktreeinclude': '.env\n',
    '.bobine/worktree.json': JSON.stringify({
      setup: 'pnpm install',
      archive: 'docker compose down'
    })
  })
  writeFileSync(join(dir, '.env'), 'TOKEN=essai\n')
  try {
    await withApp(
      SCHEME,
      async (ui) => {
        await sizes(ui)
        await ui.ready()
        await ui.closePanel()
        for (let attempt = 0; ; attempt++) {
          await ui.click(ui.$('workspace-menu'))
          const opened = await ui
            .waitFor(`!!${ui.$('workspace-worktree')}`, 3000)
            .then(() => true)
            .catch(() => false)
          if (opened) break
          if (attempt === 2)
            throw new Error(`menu du dossier : « ${L('workspaceMenu.worktree')} » absent`)
        }
        await ui.click(ui.$('workspace-worktree'))
        await ui.waitFor(`${ui.$('worktree-setup')}?.dataset.state === 'approval'`, 20_000)
        await shot(ui, 'worktrees-preparation')
      },
      undefined,
      'streaming-texte',
      { BOBINE_WORKSPACE: dir }
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

// 3. Page des tâches planifiées, avec deux tâches et leur historique (fiche 178).
{
  const userData = mkdtempSync(join(tmpdir(), 'bobine-guide-planifiees-'))
  const { dir, base } = project(PROJECT)
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  // Prochain 9 h d'un jour de semaine, comme l'app le calculerait.
  const nextNine = () => {
    const d = new Date(now)
    d.setHours(9, 0, 0, 0)
    do d.setDate(d.getDate() + 1)
    while (d.getDay() === 0 || d.getDay() === 6)
    return d.toISOString()
  }
  const en = LANG === 'en'
  const run = (id, days, amount) => ({
    id,
    at: iso(now - days * 86_400_000),
    endedAt: iso(now - days * 86_400_000 + 240_000),
    outcome: 'done',
    cost: { amount, currency: 'USD' }
  })
  writeFileSync(
    join(userData, 'scheduled-tasks.json'),
    JSON.stringify({
      version: 1,
      tasks: [
        {
          id: 'revue',
          name: en ? 'Morning review' : 'Revue du matin',
          instruction: en
            ? 'Review yesterday’s commits and list what needs a test.'
            : 'Relis les commits d’hier et liste ce qui mérite un test.',
          folder: dir,
          profileId: 'mock',
          worktree: false,
          paused: false,
          createdAt: iso(now - 5 * 86_400_000),
          schedule: { kind: 'weekdays', time: '09:00' },
          catchUp: true,
          cap: { amount: 2 },
          nextRunAt: nextNine(),
          runs: [run('r3', 1, 0.42), run('r2', 2, 0.58), run('r1', 3, 0.37)]
        },
        {
          id: 'deps',
          name: en ? 'Dependency check' : 'Vérification des dépendances',
          instruction: en
            ? 'Run pnpm outdated and propose the safe updates.'
            : 'Lance pnpm outdated et propose les mises à jour sans risque.',
          folder: dir,
          profileId: 'mock',
          worktree: true,
          paused: false,
          createdAt: iso(now - 2 * 86_400_000),
          schedule: { kind: 'interval', hours: 6 },
          catchUp: false,
          nextRunAt: iso(now + 2 * 3_600_000),
          runs: []
        }
      ]
    })
  )
  try {
    await withApp(
      SCHEME,
      async (ui) => {
        await sizes(ui)
        await ui.ready()
        await ui.closePanel()
        await ui.click(ui.$('open-scheduled'))
        await ui.waitFor(`!!${ui.$('scheduled-page')}`)
        await shot(ui, 'taches-planifiees-page')
      },
      userData,
      'demo',
      { BOBINE_WORKSPACE: dir }
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
